"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";


type UserInfo = {
  pseudo: string;
  bio: string | null;
  role: string;
  joinedAt: string;
  posts: number;
  messages: number;
};

type Post = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  reactions: number;
};

const roleLabel: Record<string, { label: string; color: string }> = {
  admin:     { label: "Admin",      color: "#c9884c" },
  moderator: { label: "Modérateur", color: "var(--accent)" },
  member:    { label: "Membre",     color: "var(--muted)" },
};

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function ProfilePanel({ userId, onClose, spaceId }: { userId: string; onClose: () => void; spaceId: string }) {
  const [info, setInfo] = useState<UserInfo | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchData();
  }, [userId]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const fetchData = async () => {
    const [{ data: profile }, { data: member }, { count: postsCount }, { count: messagesCount }, { data: postsData }] = await Promise.all([
      supabase.from("profiles").select("pseudo, bio, created_at").eq("id", userId).single(),
      supabase.from("space_members").select("role").eq("user_id", userId).eq("space_id", spaceId).single(),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("space_id", spaceId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("space_id", spaceId),
      supabase.from("posts").select("id, content, image_url, created_at, reactions(id)").eq("author_id", userId).eq("space_id", spaceId).order("created_at", { ascending: false }).limit(20),
    ]);

    setInfo({
      pseudo: profile?.pseudo ?? "Membre",
      bio: profile?.bio ?? null,
      role: member?.role ?? "member",
      joinedAt: profile?.created_at ?? "",
      posts: postsCount ?? 0,
      messages: messagesCount ?? 0,
    });

    setPosts((postsData ?? []).map((p) => ({
      id: p.id,
      content: p.content,
      image_url: p.image_url ?? null,
      created_at: p.created_at,
      reactions: Array.isArray(p.reactions) ? p.reactions.length : 0,
    })));
  };

  const roleInfo = roleLabel[info?.role ?? "member"] ?? roleLabel.member;
  const joinedDate = info?.joinedAt
    ? new Date(info.joinedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <div
      onClick={onClose}
      className="sibyl-overlay-backdrop"
      style={{
        position: "fixed", inset: 0, zIndex: 300,
        background: "rgba(0,0,0,0.55)",
        display: "flex", justifyContent: "flex-end",
      }}
    >
      <div
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%", maxWidth: 440,
          height: "100%", overflowY: "auto",
          background: "var(--background)",
          borderLeft: "1px solid var(--border)",
          display: "flex", flexDirection: "column",
          animation: "slideIn 0.2s ease",
        }}
      >
        <style>{`@keyframes slideIn { from { transform: translateX(40px); opacity:0; } to { transform: translateX(0); opacity:1; } }`}</style>

        {/* Header */}
        <div style={{
          padding: "20px 24px",
          borderBottom: "1px solid var(--border)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          position: "sticky", top: 0, background: "var(--background)", zIndex: 1,
        }}>
          <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>Profil</span>
          <button onClick={onClose} style={{
            background: "transparent", border: "none", color: "var(--muted)",
            cursor: "pointer", fontSize: 20, lineHeight: 1, padding: 4,
          }}>×</button>
        </div>

        {!info ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted)", fontSize: 13 }}>…</div>
        ) : (
          <>
            {/* Infos profil */}
            <div style={{ padding: "28px 24px 20px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <div style={{
                  width: 56, height: 56, borderRadius: "50%", flexShrink: 0,
                  background: "rgba(124,111,247,0.12)",
                  border: "1px solid rgba(124,111,247,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 22, color: "var(--accent)", fontWeight: 600, userSelect: "none",
                }}>
                  {info.pseudo[0]?.toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: "var(--foreground)", marginBottom: 6 }}>
                    {info.pseudo}
                  </div>
                  <span style={{
                    fontSize: 8, letterSpacing: "0.12em", textTransform: "uppercase",
                    color: roleInfo.color, border: `1px solid ${roleInfo.color}`,
                    borderRadius: 3, padding: "2px 7px", opacity: 0.85,
                  }}>
                    {roleInfo.label}
                  </span>
                </div>
              </div>

              {info.bio && (
                <p style={{
                  margin: "0 0 16px", fontSize: 13, lineHeight: 1.7,
                  color: "var(--foreground)", fontStyle: "italic",
                  fontFamily: "Georgia, serif",
                }}>
                  "{info.bio}"
                </p>
              )}

              <div style={{ display: "flex", gap: 24 }}>
                <Stat label="Publications" value={info.posts} />
                <Stat label="Messages" value={info.messages} />
                <Stat label="Depuis" value={joinedDate} small />
              </div>
            </div>

            {/* Publications */}
            <div style={{ padding: "20px 24px", flex: 1 }}>
              <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>
                Publications
              </div>

              {posts.length === 0 ? (
                <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", textAlign: "center", marginTop: 32 }}>
                  Aucune publication.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {posts.map((post) => (
                    <div key={post.id} style={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 6, padding: "12px 16px",
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: post.content ? 8 : 0 }}>
                        <span style={{ fontSize: 10, color: "var(--muted)" }}>{timeAgo(post.created_at)}</span>
                        {post.reactions > 0 && (
                          <span style={{ fontSize: 11, color: "var(--muted)" }}>♥ {post.reactions}</span>
                        )}
                      </div>
                      {post.content && (
                        <p style={{
                          margin: 0, fontSize: 13, color: "var(--foreground)",
                          lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        }}>
                          {post.content}
                        </p>
                      )}
                      {post.image_url && (
                        <a href={post.image_url} target="_blank" rel="noreferrer" style={{ display: "block", marginTop: post.content ? 8 : 0 }}>
                          <img src={post.image_url} alt="" style={{
                            maxWidth: "100%", borderRadius: 4,
                            border: "1px solid var(--border)", display: "block", cursor: "zoom-in",
                          }} />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: small ? 10 : 14, fontWeight: 600, color: "var(--foreground)" }}>{value}</span>
      <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}
