"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import UserPopup from "./UserPopup";
import ProfilePanel from "./ProfilePanel";


type Reaction = { id: string; user_id: string };
type Post = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  author_id: string;
  pinned: boolean;
  is_superadmin: boolean;
  profiles: { pseudo: string }[] | null;
  reactions: Reaction[];
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

function renderWithMentions(text: string) {
  return text.split(/(@\w+)/g).map((part, i) =>
    /^@\w+$/.test(part)
      ? <span key={i} style={{ color: "var(--accent)", fontWeight: 600 }}>{part}</span>
      : part
  );
}

export default function FeedTab({ userId, pseudo, spaceId }: { userId: string; pseudo: string; spaceId: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [popup, setPopup] = useState<{ userId: string; anchor: HTMLElement } | null>(null);
  const [profilePanel, setProfilePanel] = useState<string | null>(null);
  const [allPseudos, setAllPseudos] = useState<string[]>([]);
  const [mentionFiltered, setMentionFiltered] = useState<string[]>([]);
  const [banInfo, setBanInfo] = useState<{ banned_until: string | null } | null>(null);
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
      .select("id, content, image_url, created_at, author_id, pinned, reactions(id, user_id)")
      .eq("space_id", spaceId)
      .order("pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (!postsData || postsData.length === 0) { setPosts([]); return; }

    const authorIds = [...new Set(postsData.map((p) => p.author_id))];
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("id, pseudo, is_superadmin")
      .in("id", authorIds);

    const profileMap: Record<string, { pseudo: string; is_superadmin: boolean }> = {};
    (profilesData ?? []).forEach((p) => { profileMap[p.id] = { pseudo: p.pseudo, is_superadmin: p.is_superadmin ?? false }; });

    setPosts(postsData.map((p) => ({
      ...p,
      profiles: profileMap[p.author_id] ? [{ pseudo: profileMap[p.author_id].pseudo }] : null,
      is_superadmin: profileMap[p.author_id]?.is_superadmin ?? false,
    })) as Post[]);
  };

  const handleContentChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
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
    if (!content.trim() && !imageFile) return;
    if (userId === "dev-user") return;
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
      content: content.trim(),
      image_url,
      author_id: userId,
      space_id: spaceId,
    });
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
          <div style={{ position: "relative" }}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={handleContentChange}
              onKeyDown={(e) => {
                if (e.key === "Escape") { setMentionFiltered([]); return; }
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost();
              }}
              placeholder="Écrivez quelque chose… (@pseudo pour mentionner)"
              rows={3}
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
              disabled={posting || (!content.trim() && !imageFile)}
              style={{
                background: posting || (!content.trim() && !imageFile) ? "var(--border)" : "var(--accent)",
                border: "none", borderRadius: 4,
                color: posting || (!content.trim() && !imageFile) ? "var(--muted)" : "#fff",
                fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "8px 20px", cursor: posting || (!content.trim() && !imageFile) ? "not-allowed" : "pointer",
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
                <article key={post.id} style={{
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
                  padding: "18px 22px",
                  boxShadow: isSA
                    ? "0 0 24px rgba(201,136,76,0.18), 0 0 0 1px rgba(201,136,76,0.08) inset, var(--shadow-sm)"
                    : post.pinned
                      ? "0 0 0 1px rgba(201,136,76,0.1) inset, var(--shadow-sm)"
                      : "var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)",
                  transition: "border-color 0.2s, box-shadow 0.2s",
                }}>
                  <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center", marginBottom: 10,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {isSA && (
                      <span style={{
                        fontSize: 8, color: "#c9884c",
                        background: "rgba(201,136,76,0.12)",
                        border: "1px solid rgba(201,136,76,0.5)",
                        borderRadius: 3, padding: "2px 7px",
                        letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600,
                      }}>
                        ♔ Fondateur
                      </span>
                    )}
                    {!isSA && post.pinned && (
                      <span style={{ fontSize: 8, color: "#c9884c", border: "1px solid rgba(201,136,76,0.5)", borderRadius: 3, padding: "2px 6px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        Épinglé
                      </span>
                    )}
                    <span
                      onClick={(e) => setPopup({ userId: post.author_id, anchor: e.currentTarget as HTMLElement })}
                      style={{
                        fontSize: isSA ? 15 : 13,
                        color: isSA ? "#c9884c" : "var(--accent)",
                        letterSpacing: "0.06em", fontWeight: 700, cursor: "pointer",
                        textShadow: isSA ? "0 0 12px rgba(201,136,76,0.4)" : "none",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.7")}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                    >
                      {post.profiles?.[0]?.pseudo ?? (post.author_id === userId ? pseudo : "Membre")}
                    </span>
                    </div>
                    <span style={{ fontSize: 12, color: "var(--muted)", letterSpacing: "0.03em" }}>
                      {timeAgo(post.created_at)}
                    </span>
                  </div>
                  {post.content && (
                    <p style={{
                      color: isSA ? "rgba(234,230,248,0.95)" : "var(--foreground)",
                      fontSize: isSA ? 17 : 15,
                      lineHeight: 1.8,
                      margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-word",
                      fontWeight: isSA ? 500 : 400,
                    }}>
                      {renderWithMentions(post.content)}
                    </p>
                  )}
                  {post.image_url && (
                    <a href={post.image_url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: post.content ? 12 : 0 }}>
                      <img
                        src={post.image_url}
                        alt=""
                        style={{
                          maxWidth: "100%", borderRadius: 4,
                          border: "1px solid var(--border)", display: "block",
                          cursor: "zoom-in",
                        }}
                      />
                    </a>
                  )}
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 6 }}>
                    <button
                      onClick={() => handleReaction(post)}
                      style={{
                        background: "transparent", border: "none", cursor: "pointer",
                        padding: "4px 8px 4px 0",
                        display: "flex", alignItems: "center", gap: 5,
                        color: hasLiked ? "var(--accent)" : "var(--muted)",
                        fontSize: 13, transition: "color 0.15s",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = hasLiked ? "var(--accent)" : "var(--muted)")}
                    >
                      <span style={{ fontSize: 22, display: "inline-block", animation: hasLiked ? "heartBeat 0.4s ease" : "none" }}>{hasLiked ? "♥" : "♡"}</span>
                      {likeCount > 0 && (
                        <span style={{ fontSize: 13, letterSpacing: "0.04em" }}>{likeCount}</span>
                      )}
                    </button>
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
        />
      )}
      {profilePanel && (
        <ProfilePanel userId={profilePanel} onClose={() => setProfilePanel(null)} spaceId={spaceId} />
      )}
    </div>
  );
}
