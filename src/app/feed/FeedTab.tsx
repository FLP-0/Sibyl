"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { awardXP, BADGE_NAMES, XP_LABELS } from "@/lib/rewards";
import UserPopup from "./UserPopup";
import ProfilePanel from "./ProfilePanel";


type Reaction = { id: string; user_id: string };
type Post = {
  id: string;
  title: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
  author_id: string;
  pinned: boolean;
  is_superadmin: boolean;
  profiles: { pseudo: string }[] | null;
  reactions: Reaction[];
  role?: string;
  prestigeBadge?: "resonance" | "magnetisme";
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}


type OnXpGained = (amount: number, label: string, badges: string[], leveledUp: boolean) => void;

export default function FeedTab({ userId, pseudo, spaceId, onXpGained }: { userId: string; pseudo: string; spaceId: string; onXpGained?: OnXpGained }) {
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ userId: string; anchor: HTMLElement } | null>(null);
  const [profilePanel, setProfilePanel] = useState<string | null>(null);
  const [allPseudos, setAllPseudos] = useState<string[]>([]);
  const [mentionFiltered, setMentionFiltered] = useState<string[]>([]);
  const [banInfo, setBanInfo] = useState<{ banned_until: string | null } | null>(null);
  const [censorError, setCensorError] = useState<string | null>(null);
  const censoredWordsRef = useRef<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (userId && userId !== "dev-user") {
      supabase.from("bans").select("banned_until").eq("user_id", userId).eq("space_id", spaceId).maybeSingle()
        .then(({ data }) => {
          if (!data) return;
          if (!data.banned_until || new Date(data.banned_until) > new Date()) setBanInfo(data);
        });
    }
  }, [userId, spaceId]);

  useEffect(() => {
    supabase.from("censored_words").select("word").eq("space_id", spaceId)
      .then(({ data }) => { censoredWordsRef.current = (data ?? []).map((r) => r.word); });
  }, [spaceId]);

  useEffect(() => {
    fetchPosts();
    supabase.from("space_members").select("profiles(pseudo)").eq("space_id", spaceId)
      .then(({ data }) => {
        const pseudos = (data ?? []).flatMap((m: { profiles: { pseudo: string } | { pseudo: string }[] | null }) => {
          if (!m.profiles) return [];
          return Array.isArray(m.profiles) ? m.profiles.map((p) => p.pseudo) : [m.profiles.pseudo];
        }).filter(Boolean) as string[];
        setAllPseudos(pseudos);
      });
  }, []);

  useEffect(() => {
    if (channelRef.current) return;
    channelRef.current = supabase
      .channel("feed-" + spaceId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts", filter: `space_id=eq.${spaceId}` }, () => fetchPosts())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts", filter: `space_id=eq.${spaceId}` }, () => fetchPosts())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts", filter: `space_id=eq.${spaceId}` }, () => fetchPosts())
      .subscribe();
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    };
  }, []);

  const fetchPosts = async () => {
    const { data: postsData } = await supabase
      .from("posts")
      .select("id, title, content, image_url, created_at, author_id, pinned, reactions(id, user_id)")
      .eq("space_id", spaceId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (!postsData || postsData.length === 0) { setPosts([]); return; }

    const authorIds = [...new Set(postsData.map((p) => p.author_id))];
    const [{ data: profilesData }, { data: membersData }, { data: badgeData }] = await Promise.all([
      supabase.from("profiles").select("id, pseudo, is_superadmin").in("id", authorIds),
      supabase.from("space_members").select("user_id, role").eq("space_id", spaceId).in("user_id", authorIds),
      supabase.from("user_badges").select("user_id, badge_id").in("user_id", authorIds).in("badge_id", ["magnetisme", "resonance"]),
    ]);

    const profileMap: Record<string, { pseudo: string; is_superadmin: boolean }> = {};
    (profilesData ?? []).forEach((p) => { profileMap[p.id] = { pseudo: p.pseudo, is_superadmin: p.is_superadmin ?? false }; });

    const roleMap: Record<string, string> = {};
    (membersData ?? []).forEach((m) => { roleMap[m.user_id] = m.role; });

    const prestigeMap: Record<string, "resonance" | "magnetisme"> = {};
    (badgeData ?? []).forEach((b: { user_id: string; badge_id: string }) => {
      if (b.badge_id === "magnetisme") prestigeMap[b.user_id] = "magnetisme";
      else if (b.badge_id === "resonance" && prestigeMap[b.user_id] !== "magnetisme") prestigeMap[b.user_id] = "resonance";
    });

    setPosts(postsData.map((p) => ({
      ...p,
      profiles: profileMap[p.author_id] ? [{ pseudo: profileMap[p.author_id].pseudo }] : null,
      is_superadmin: profileMap[p.author_id]?.is_superadmin ?? false,
      role: roleMap[p.author_id],
      prestigeBadge: prestigeMap[p.author_id],
    })) as Post[]);
  };

  const findCensoredWord = (text: string): string | null => {
    const lower = text.toLowerCase();
    return censoredWordsRef.current.find((w) => lower.includes(w)) ?? null;
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setCensorError(null);
    setContent(val);
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      const q = match[1].toLowerCase();
      setMentionFiltered(allPseudos.filter((p) => p.toLowerCase().startsWith(q) && p !== pseudo).slice(0, 6));
    } else {
      setMentionFiltered([]);
    }
  };

  const insertMention = (p: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const cursor = ta.selectionStart ?? content.length;
    const before = content.slice(0, cursor).replace(/@\w*$/, `@${p} `);
    const after = content.slice(cursor);
    setContent(before + after);
    setMentionFiltered([]);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(before.length, before.length); }, 0);
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePost = async () => {
    if (!title.trim()) return;
    if (userId === "dev-user") return;
    const forbidden = findCensoredWord(content) ?? findCensoredWord(title);
    if (forbidden) {
      setCensorError(`Le mot « ${forbidden} » est interdit dans cet espace.`);
      setTitle("");
      setContent("");
      setImageFile(null);
      setImagePreview(null);
      return;
    }
    setPosting(true);

    let image_url: string | null = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `${userId}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("post-images")
        .upload(path, imageFile, { upsert: false });
      if (!uploadError) {
        const { data: urlData } = supabase.storage.from("post-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
    }

    await supabase.from("posts").insert({
      title: title.trim(),
      content: content.trim(),
      image_url,
      author_id: userId,
      space_id: spaceId,
    });
    awardXP("post_created", { spaceId, contentLength: content.trim().length }).then((result) => {
      if (result && !result.skipped) {
        onXpGained?.(result.amount, XP_LABELS["post_created"], result.newBadges.map((b) => BADGE_NAMES[b] ?? b), result.leveledUp);
      }
    });
    setTitle("");
    setContent("");
    setImageFile(null);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await fetchPosts();
    setPosting(false);
  };

  const handleReaction = async (post: Post) => {
    if (userId === "dev-user") return;
    const hasLiked = post.reactions.some((r) => r.user_id === userId);
    if (hasLiked) {
      await supabase.from("reactions").delete().eq("post_id", post.id).eq("user_id", userId);
    } else {
      await supabase.from("reactions").insert({ post_id: post.id, user_id: userId });
      if (post.author_id !== userId) {
        awardXP("reaction_received", { spaceId, targetUserId: post.author_id, postId: post.id });
      }
    }
    await fetchPosts();
  };

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 16px" }}>

        {/* Live indicator */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 9, color: "#4caf6e", letterSpacing: "0.06em" }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4caf6e", display: "inline-block" }} />
            En direct
          </span>
        </div>

        {/* Erreur de censure */}
        {censorError && (
          <div style={{
            background: "rgba(201,76,76,0.07)", border: "1px solid rgba(201,76,76,0.28)",
            borderRadius: 8, padding: "10px 14px", marginBottom: 12,
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <span style={{ fontSize: 12, color: "#c94c4c" }}>⊘ {censorError}</span>
            <button onClick={() => setCensorError(null)} style={{
              background: "none", border: "none", cursor: "pointer",
              color: "rgba(201,76,76,0.5)", fontSize: 14, lineHeight: 1, padding: 0, flexShrink: 0,
            }}>×</button>
          </div>
        )}

        {/* Composer */}
        {banInfo ? (
          <div style={{
            background: "rgba(201,76,76,0.07)", border: "1px solid rgba(201,76,76,0.3)",
            borderRadius: 12, padding: "16px 18px", marginBottom: 32, textAlign: "center",
          }}>
            <span style={{ fontSize: 12, color: "#c94c4c" }}>
              {banInfo.banned_until
                ? `Vous êtes banni jusqu'au ${new Date(banInfo.banned_until).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}`
                : "Vous êtes banni définitivement de cet espace."}
            </span>
          </div>
        ) : (
        <div style={{
          background: "var(--glass)",
          backdropFilter: "blur(24px) saturate(160%)",
          WebkitBackdropFilter: "blur(24px) saturate(160%)",
          border: "1px solid var(--glass-border)",
          borderRadius: 12,
          padding: "16px 18px",
          marginBottom: 32,
          boxShadow: "var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost(); }}
            placeholder="Titre *"
            style={{
              width: "100%", background: "transparent", border: "none",
              borderBottom: "1px solid var(--border)", outline: "none",
              color: "var(--foreground)", fontSize: 15, fontWeight: 600,
              fontFamily: "Georgia, serif", padding: "0 0 10px",
              marginBottom: 10, letterSpacing: "0.01em", boxSizing: "border-box",
            }}
          />
          <div style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setMentionFiltered([]); return; }
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost();
              }}
              placeholder="Contenu (optionnel) — @pseudo pour mentionner"
              rows={2}
              style={{
                width: "100%", background: "transparent", border: "none",
                outline: "none", color: "var(--foreground)", fontSize: 13,
                lineHeight: 1.7, resize: "none", fontFamily: "inherit",
              }}
            />
            {mentionFiltered.length > 0 && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 4px)", left: 0,
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 6, zIndex: 50, minWidth: 180,
                boxShadow: "0 8px 24px rgba(0,0,0,0.4)", overflow: "hidden",
              }}>
                {mentionFiltered.map((p) => (
                  <button key={p} onMouseDown={(e) => { e.preventDefault(); insertMention(p); }} style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "8px 14px", background: "transparent", border: "none",
                    color: "var(--foreground)", fontSize: 13, cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,111,247,0.1)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ color: "var(--accent)" }}>@</span>{p}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Prévisualisation image */}
          {imagePreview && (
            <div style={{ position: "relative", display: "inline-block", marginTop: 10 }}>
              <img src={imagePreview} alt="preview" style={{ maxHeight: 200, maxWidth: "100%", borderRadius: 4, display: "block", border: "1px solid var(--border)" }} />
              <button onClick={handleRemoveImage} style={{
                position: "absolute", top: 4, right: 4,
                background: "rgba(0,0,0,0.6)", border: "none", borderRadius: "50%",
                color: "#fff", width: 22, height: 22, cursor: "pointer",
                fontSize: 14, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center",
              }}>×</button>
            </div>
          )}

          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                style={{ display: "none" }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Joindre une image"
                style={{
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 4, color: imagePreview ? "var(--accent)" : "var(--muted)",
                  cursor: "pointer", padding: "5px 8px", display: "flex", alignItems: "center",
                  transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--foreground)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = imagePreview ? "var(--accent)" : "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
                  <path d="M21 15l-5-5L5 21"/>
                </svg>
              </button>
              <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>
                Ctrl + Entrée pour publier
              </span>
            </div>
            <button
              onClick={handlePost}
              disabled={posting || !title.trim()}
              style={{
                background: posting || !title.trim() ? "var(--border)" : "var(--accent)",
                border: "none", borderRadius: 4,
                color: posting || !title.trim() ? "var(--muted)" : "#fff",
                fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "8px 20px", cursor: posting || !title.trim() ? "not-allowed" : "pointer",
                transition: "background 0.15s",
              }}
            >
              {posting ? "…" : "Publier"}
            </button>
          </div>
        </div>
        )}

        {/* Posts */}
        {posts.length === 0 ? (
          <p style={{
            textAlign: "center", color: "var(--muted)", fontSize: 12,
            fontStyle: "italic", fontFamily: "Georgia, serif",
            marginTop: 64, letterSpacing: "0.04em",
          }}>
            Le silence aussi est une forme de parole.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {posts.map((post) => {
              const hasLiked = post.reactions.some((r) => r.user_id === userId);
              const likeCount = post.reactions.length;
              const isSA = post.is_superadmin;
              return (
                <article
                  key={post.id}
                  onClick={() => router.push(`/post/${post.id}?space=${spaceId}`)}
                  style={{
                    background: isSA
                      ? "linear-gradient(135deg, rgba(201,136,76,0.10) 0%, rgba(201,136,76,0.04) 100%)"
                      : "var(--glass)",
                    backdropFilter: "blur(20px) saturate(150%)",
                    WebkitBackdropFilter: "blur(20px) saturate(150%)",
                    border: isSA
                      ? "1.5px solid rgba(201,136,76,0.65)"
                      : post.pinned
                        ? "1px solid rgba(201,136,76,0.45)"
                        : "1px solid var(--glass-border)",
                    borderRadius: 12,
                    padding: "16px 20px",
                    boxShadow: isSA
                      ? "0 0 24px rgba(201,136,76,0.18), var(--shadow-sm)"
                      : "var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)",
                    cursor: "pointer",
                    transition: "border-color 0.15s, box-shadow 0.15s",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = isSA ? "rgba(201,136,76,0.9)" : "rgba(124,111,247,0.4)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = isSA ? "rgba(201,136,76,0.65)" : post.pinned ? "rgba(201,136,76,0.45)" : "var(--glass-border)"; }}
                >
                  {/* Ligne auteur + date */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      {isSA && (
                        <span style={{ fontSize: 8, color: "#c9884c", background: "rgba(201,136,76,0.12)", border: "1px solid rgba(201,136,76,0.5)", borderRadius: 3, padding: "2px 7px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                          ♔ Fondateur
                        </span>
                      )}
                      {!isSA && post.pinned && (
                        <span style={{ fontSize: 8, color: "#c9884c", border: "1px solid rgba(201,136,76,0.5)", borderRadius: 3, padding: "2px 6px", letterSpacing: "0.1em", textTransform: "uppercase" }}>Épinglé</span>
                      )}
                      <span
                        onClick={(e) => { e.stopPropagation(); setPopup({ userId: post.author_id, anchor: e.currentTarget as HTMLElement }); }}
                        style={{ fontSize: isSA ? 13 : 12, color: isSA ? "#c9884c" : "var(--accent)", fontWeight: 700, cursor: "pointer", letterSpacing: "0.04em" }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        {post.profiles?.[0]?.pseudo ?? (post.author_id === userId ? pseudo : "Membre")}
                      </span>
                      {!isSA && post.role === "admin" && (
                        <span style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: "#c9884c", background: "rgba(201,136,76,0.1)", border: "1px solid rgba(201,136,76,0.4)", borderRadius: 3, padding: "2px 6px" }}>admin</span>
                      )}
                      {!isSA && post.role === "moderator" && (
                        <span style={{ fontSize: 8, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700, color: "var(--accent)", background: "rgba(124,111,247,0.1)", border: "1px solid rgba(124,111,247,0.4)", borderRadius: 3, padding: "2px 6px" }}>modo</span>
                      )}
                      {post.prestigeBadge === "magnetisme" && (
                        <span title="Magnétisme" style={{ fontSize: 11, color: "#d4af37", lineHeight: 1, filter: "drop-shadow(0 0 5px rgba(212,175,55,0.7))" }}>✦</span>
                      )}
                      {post.prestigeBadge === "resonance" && (
                        <span title="Résonance" style={{ fontSize: 12, color: "#c9884c", lineHeight: 1, opacity: 0.85 }}>◈</span>
                      )}
                    </div>
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>{timeAgo(post.created_at)}</span>
                  </div>

                  {/* Titre */}
                  <h3 style={{
                    margin: "0 0 12px",
                    fontSize: isSA ? 17 : 15,
                    fontWeight: 600, fontFamily: "Georgia, serif",
                    color: isSA ? "rgba(234,230,248,0.95)" : "var(--foreground)",
                    lineHeight: 1.4, letterSpacing: "0.01em",
                  }}>
                    {post.title || "Sans titre"}
                  </h3>

                  {/* Bas : réaction + hint lecture */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleReaction(post); }}
                      style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: 5,
                        color: hasLiked ? "var(--accent)" : "var(--muted)",
                        fontSize: 13, padding: 0, transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = hasLiked ? "var(--accent)" : "var(--muted)")}
                    >
                      <span style={{ fontSize: 18 }}>{hasLiked ? "♥" : "♡"}</span>
                      {likeCount > 0 && <span style={{ fontSize: 12 }}>{likeCount}</span>}
                    </button>
                    <span style={{ fontSize: 10, color: "var(--muted)", marginLeft: "auto", letterSpacing: "0.06em" }}>
                      Lire →
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      {popup && (
        <UserPopup
          userId={popup.userId}
          anchorEl={popup.anchor}
          onClose={() => setPopup(null)}
          onViewProfile={(uid) => { setPopup(null); setProfilePanel(uid); }}
          spaceId={spaceId}
          currentUserId={userId}
        />
      )}
      {profilePanel && (
        <ProfilePanel userId={profilePanel} onClose={() => setProfilePanel(null)} spaceId={spaceId} />
      )}
    </div>
  );
}
