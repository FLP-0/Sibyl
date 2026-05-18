"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { awardXP } from "@/lib/rewards";

type FullPost = {
  id: string;
  title: string | null;
  content: string;
  image_url: string | null;
  created_at: string;
  author_id: string;
  author_pseudo: string;
  is_superadmin: boolean;
  pinned: boolean;
  space_id: string;
  reactions: { id: string; user_id: string }[];
};

type Reply = {
  id: string;
  author_id: string;
  author_pseudo: string;
  content: string;
  created_at: string;
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

export default function PostPage() {
  return <Suspense><PostPageInner /></Suspense>;
}

function PostPageInner() {
  const params = useParams();
  const router = useRouter();
  const postId = params.id as string;

  const [post, setPost] = useState<FullPost | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [pseudo, setPseudo] = useState<string>("");
  const [replyContent, setReplyContent] = useState("");
  const [posting, setPosting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const repliesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (!data.session) { router.push("/"); return; }
      const uid = data.session.user.id;
      setUserId(uid);
      setPseudo(data.session.user.user_metadata?.pseudo ?? "");
      await fetchPost(uid);
      await fetchReplies();
      setLoading(false);
    });
  }, [postId]);

  useEffect(() => {
    if (!postId) return;
    channelRef.current = supabase
      .channel("post-page-" + postId)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "replies", filter: `post_id=eq.${postId}` }, () => fetchReplies())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "replies" }, () => fetchReplies())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reactions" }, () => fetchPost(userId))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "reactions" }, () => fetchPost(userId))
      .subscribe();
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [postId, userId]);

  const fetchPost = async (uid: string | null) => {
    const { data } = await supabase
      .from("posts")
      .select("id, title, content, image_url, created_at, author_id, pinned, space_id, reactions(id, user_id)")
      .eq("id", postId)
      .single();

    if (!data) { setNotFound(true); return; }

    // Vérifier membership
    if (uid) {
      const { data: member } = await supabase
        .from("space_members")
        .select("role")
        .eq("space_id", data.space_id)
        .eq("user_id", uid)
        .maybeSingle();
      if (!member) { router.push("/"); return; }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("pseudo, is_superadmin")
      .eq("id", data.author_id)
      .single();

    setPost({
      ...data,
      author_pseudo: profile?.pseudo ?? "—",
      is_superadmin: profile?.is_superadmin ?? false,
    } as FullPost);
  };

  const fetchReplies = async () => {
    const { data: repliesData } = await supabase
      .from("replies")
      .select("id, author_id, content, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (!repliesData || repliesData.length === 0) { setReplies([]); return; }

    const authorIds = [...new Set(repliesData.map((r) => r.author_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, pseudo")
      .in("id", authorIds);

    const pseudoMap: Record<string, string> = {};
    (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });

    setReplies(repliesData.map((r) => ({
      id: r.id,
      author_id: r.author_id,
      author_pseudo: pseudoMap[r.author_id] ?? "—",
      content: r.content,
      created_at: r.created_at,
    })));
  };

  const handleReaction = async () => {
    if (!post || !userId) return;
    const hasLiked = post.reactions.some((r) => r.user_id === userId);
    if (hasLiked) {
      await supabase.from("reactions").delete().eq("post_id", post.id).eq("user_id", userId);
    } else {
      await supabase.from("reactions").insert({ post_id: post.id, user_id: userId });
      if (post.author_id !== userId) {
        awardXP("reaction_received", { targetUserId: post.author_id, postId: post.id });
      }
    }
    await fetchPost(userId);
  };

  const handleReply = async () => {
    if (!replyContent.trim() || !post || !userId || posting) return;
    setPosting(true);
    await supabase.from("replies").insert({
      post_id: post.id,
      space_id: post.space_id,
      author_id: userId,
      content: replyContent.trim(),
    });
    awardXP("reply_created", { spaceId: post.space_id, postId: post.id, contentLength: replyContent.trim().length });
    setReplyContent("");
    await fetchReplies();
    setPosting(false);
    setTimeout(() => repliesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  if (loading) return (
    <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif" }}>Chargement…</p>
    </div>
  );

  if (notFound || !post) return (
    <div style={{ minHeight: "100vh", background: "var(--background)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
      <p style={{ color: "var(--muted)", fontSize: 13, fontStyle: "italic", fontFamily: "Georgia, serif" }}>Publication introuvable.</p>
      <button onClick={() => router.back()} style={{ background: "transparent", border: "1px solid var(--border)", borderRadius: 6, color: "var(--muted)", fontSize: 11, padding: "8px 16px", cursor: "pointer" }}>← Retour</button>
    </div>
  );

  const hasLiked = post.reactions.some((r) => r.user_id === userId);
  const likeCount = post.reactions.length;
  const isSA = post.is_superadmin;

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      <div style={{
        position: "fixed", top: "0%", left: "50%", transform: "translateX(-50%)",
        width: 700, height: 400,
        background: "radial-gradient(ellipse, rgba(124,111,247,0.05) 0%, transparent 65%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 20px 80px", position: "relative", zIndex: 1 }}>

        {/* Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <button
            onClick={() => router.push("/feed?space=" + post.space_id)}
            style={{
              background: "transparent", border: "1px solid var(--border)",
              borderRadius: 6, color: "var(--muted)", fontSize: 12,
              padding: "7px 14px", cursor: "pointer", transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "rgba(124,111,247,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >← Retour</button>
        </div>

        {/* Post complet */}
        <article style={{
          background: isSA
            ? "linear-gradient(135deg, rgba(201,136,76,0.10) 0%, rgba(201,136,76,0.04) 100%)"
            : "var(--glass)",
          backdropFilter: "blur(20px)",
          border: isSA
            ? "1.5px solid rgba(201,136,76,0.65)"
            : post.pinned
              ? "1px solid rgba(201,136,76,0.45)"
              : "1px solid var(--glass-border)",
          borderRadius: 16,
          padding: "28px 32px",
          marginBottom: 32,
          boxShadow: isSA
            ? "0 0 24px rgba(201,136,76,0.15), var(--shadow-sm)"
            : "var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}>
          {/* Auteur + date */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {isSA && (
                <span style={{ fontSize: 8, color: "#c9884c", background: "rgba(201,136,76,0.12)", border: "1px solid rgba(201,136,76,0.5)", borderRadius: 3, padding: "2px 7px", letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
                  ♔ Fondateur
                </span>
              )}
              {!isSA && post.pinned && (
                <span style={{ fontSize: 8, color: "#c9884c", border: "1px solid rgba(201,136,76,0.5)", borderRadius: 3, padding: "2px 6px", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  Épinglé
                </span>
              )}
              <span style={{ fontSize: isSA ? 15 : 13, color: isSA ? "#c9884c" : "var(--accent)", fontWeight: 700, letterSpacing: "0.04em" }}>
                {post.author_pseudo}
              </span>
            </div>
            <span style={{ fontSize: 11, color: "var(--muted)" }}>{timeAgo(post.created_at)}</span>
          </div>

          {/* Titre */}
          <h1 style={{
            margin: "0 0 20px",
            fontSize: 24, fontWeight: 700, fontFamily: "Georgia, serif",
            color: isSA ? "rgba(234,230,248,0.95)" : "var(--foreground)",
            lineHeight: 1.3, letterSpacing: "0.01em",
          }}>
            {post.title || "Sans titre"}
          </h1>

          {/* Contenu */}
          {post.content && (
            <p style={{
              margin: "0 0 20px",
              fontSize: 15, lineHeight: 1.85,
              color: isSA ? "rgba(234,230,248,0.9)" : "var(--foreground)",
              whiteSpace: "pre-wrap", wordBreak: "break-word",
            }}>
              {renderWithMentions(post.content)}
            </p>
          )}

          {/* Image */}
          {post.image_url && (
            <a href={post.image_url} target="_blank" rel="noreferrer" style={{ display: "block", marginBottom: 20 }}>
              <img src={post.image_url} alt="" style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid var(--border)", display: "block", cursor: "zoom-in" }} />
            </a>
          )}

          {/* Réactions */}
          <div style={{ paddingTop: 16, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={handleReaction}
              style={{
                background: "transparent", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", gap: 6,
                color: hasLiked ? "var(--accent)" : "var(--muted)",
                fontSize: 13, padding: "4px 0", transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = hasLiked ? "var(--accent)" : "var(--muted)")}
            >
              <span style={{ fontSize: 22 }}>{hasLiked ? "♥" : "♡"}</span>
              {likeCount > 0 && <span style={{ fontSize: 13, letterSpacing: "0.04em" }}>{likeCount}</span>}
            </button>
            {likeCount > 0 && (
              <span style={{ fontSize: 11, color: "var(--muted)" }}>
                {likeCount} réaction{likeCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </article>

        {/* Séparateur réponses */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", flexShrink: 0 }}>
            {replies.length} réponse{replies.length !== 1 ? "s" : ""}
          </span>
          <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
        </div>

        {/* Liste des réponses */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 28 }}>
          {replies.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", padding: "16px 0" }}>
              Aucune réponse pour l&apos;instant.
            </p>
          )}
          {replies.map((reply) => (
            <div key={reply.id} style={{
              background: "var(--surface)", border: "1px solid var(--border)",
              borderRadius: 10, padding: "14px 18px",
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: reply.author_id === userId ? "var(--accent)" : "var(--foreground)" }}>
                  {reply.author_pseudo}
                  {reply.author_id === userId && <span style={{ fontSize: 9, color: "var(--muted)", marginLeft: 6 }}>(vous)</span>}
                </span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{timeAgo(reply.created_at)}</span>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "var(--foreground)", lineHeight: 1.7, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {renderWithMentions(reply.content)}
              </p>
            </div>
          ))}
          <div ref={repliesEndRef} />
        </div>

        {/* Formulaire de réponse */}
        <div style={{
          background: "var(--glass)", backdropFilter: "blur(20px)",
          border: "1px solid var(--glass-border)", borderRadius: 12,
          padding: "16px 18px",
        }}>
          <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>
            Répondre en tant que <span style={{ color: "var(--accent)" }}>{pseudo}</span>
          </div>
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleReply(); }}
            placeholder="Écrivez votre réponse…"
            rows={3}
            style={{
              width: "100%", background: "transparent", border: "none",
              outline: "none", color: "var(--foreground)", fontSize: 13,
              lineHeight: 1.7, resize: "none", fontFamily: "inherit", boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em" }}>Ctrl + Entrée pour répondre</span>
            <button
              onClick={handleReply}
              disabled={!replyContent.trim() || posting}
              style={{
                background: replyContent.trim() ? "var(--accent)" : "var(--border)",
                border: "none", borderRadius: 4,
                color: replyContent.trim() ? "#fff" : "var(--muted)",
                fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "8px 20px", cursor: replyContent.trim() && !posting ? "pointer" : "not-allowed",
                transition: "background 0.15s",
              }}
            >
              {posting ? "…" : "Répondre"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
