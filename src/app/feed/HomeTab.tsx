"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";


type RecentPost = { id: string; content: string; created_at: string; pseudo: string; reactions: number };
type RecentMessage = { id: string; content: string; created_at: string; pseudo: string };

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function HomeTab({ pseudo, spaceId }: { pseudo: string; spaceId: string }) {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [spaceName, setSpaceName] = useState<string>("");
  const [spaceDesc, setSpaceDesc] = useState<string>("");
  const [hour] = useState(() => new Date().getHours());

  const greeting = hour < 6 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ count }, { data: postsData }, { data: messagesData }, { data: spaceData }] = await Promise.all([
      supabase.from("space_members").select("user_id", { count: "exact", head: true }).eq("space_id", spaceId),
      supabase.from("posts").select("id, content, created_at, author_id, reactions(id)").eq("space_id", spaceId).order("created_at", { ascending: false }).limit(3),
      supabase.from("messages").select("id, content, created_at, author_id").eq("space_id", spaceId).order("created_at", { ascending: false }).limit(3),
      supabase.from("spaces").select("name, description").eq("id", spaceId).single(),
    ]);

    if (spaceData) {
      setSpaceName(spaceData.name ?? "");
      setSpaceDesc(spaceData.description ?? "");
    }

    setMemberCount(count ?? 0);

    const authorIds = [...new Set([...(postsData ?? []).map((p) => p.author_id), ...(messagesData ?? []).map((m) => m.author_id)])];
    const pseudoMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, pseudo").in("id", authorIds);
      (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });
    }

    setRecentPosts((postsData ?? []).map((p) => ({
      id: p.id, content: p.content, created_at: p.created_at,
      pseudo: pseudoMap[p.author_id] ?? "—",
      reactions: p.reactions?.length ?? 0,
    })));

    setRecentMessages((messagesData ?? []).map((m) => ({
      id: m.id, content: m.content, created_at: m.created_at,
      pseudo: pseudoMap[m.author_id] ?? "—",
    })));
  };

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "48px 24px 40px" }}>

        {/* Titre */}
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h1 style={{
            fontSize: 64, fontWeight: 700, letterSpacing: "0.25em",
            textTransform: "uppercase", color: "var(--foreground)",
            fontFamily: "Georgia, serif", margin: "0 0 16px",
            lineHeight: 1,
            textShadow: "0 0 80px rgba(138,127,248,0.18), 0 2px 4px rgba(0,0,0,0.5)",
          }}>
            {spaceName || "SIBYL"}
          </h1>
          {spaceDesc && (
            <p style={{
              fontSize: 12, color: "var(--muted)", letterSpacing: "0.12em",
              fontStyle: "italic", fontFamily: "Georgia, serif", margin: "0 0 24px",
            }}>
              {spaceDesc}
            </p>
          )}
          <div style={{ width: 40, height: 1, background: "var(--border)", margin: "0 auto 24px" }} />
          <p style={{ fontSize: 13, color: "var(--foreground)", letterSpacing: "0.04em" }}>
            {greeting}, <span style={{ color: "var(--accent)" }}>{pseudo}</span>.
          </p>
          {memberCount !== null && (
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6, letterSpacing: "0.04em" }}>
              {memberCount} initié{memberCount > 1 ? "s" : ""} dans l'espace.
            </p>
          )}
        </div>

        {/* Grille résumé */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 40 }}>

          {/* Dernières publications */}
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
              Dernières publications
            </div>
            {recentPosts.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", fontFamily: "Georgia, serif", margin: 0 }}>
                Aucune publication.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {recentPosts.map((p) => (
                  <div key={p.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--accent)" }}>{p.pseudo}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>{timeAgo(p.created_at)}</span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12, color: "var(--foreground)", lineHeight: 1.55,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {p.content}
                    </p>
                    {p.reactions > 0 && (
                      <span style={{ fontSize: 10, color: "var(--muted)", marginTop: 4, display: "block" }}>♥ {p.reactions}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Derniers messages */}
          <div className="glass-card" style={{ padding: 22 }}>
            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
              Derniers messages
            </div>
            {recentMessages.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--muted)", fontStyle: "italic", fontFamily: "Georgia, serif", margin: 0 }}>
                Aucun message.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {recentMessages.map((m) => (
                  <div key={m.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{m.pseudo}</span>
                      <span style={{ fontSize: 10, color: "var(--muted)" }}>{timeAgo(m.created_at)}</span>
                    </div>
                    <p style={{
                      margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.55,
                      overflow: "hidden", display: "-webkit-box",
                      WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    }}>
                      {m.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Citation */}
        <div style={{ textAlign: "center" }}>
          <p style={{
            fontSize: 12, color: "var(--muted)", fontStyle: "italic",
            fontFamily: "Georgia, serif", letterSpacing: "0.04em", lineHeight: 1.8,
          }}>
            "L'oracle ne parle qu'à ceux qui savent se taire."
          </p>
          <a href="/rules" target="_blank" style={{
            fontSize: 10, color: "var(--accent)", textDecoration: "none",
            letterSpacing: "0.08em", opacity: 0.5, transition: "opacity 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
          >
            Charte de la communauté
          </a>
        </div>

      </div>
    </div>
  );
}
