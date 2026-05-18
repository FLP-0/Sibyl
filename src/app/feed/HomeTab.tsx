"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";


type RecentPost = { id: string; title: string | null; created_at: string; pseudo: string; reactions: number };
type RecentMessage = { id: string; content: string; created_at: string; pseudo: string };

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

export default function HomeTab({ userId, pseudo, spaceId, role }: { userId: string; pseudo: string; spaceId: string; role: string }) {
  const [memberCount, setMemberCount] = useState<number | null>(null);
  const [recentPosts, setRecentPosts] = useState<RecentPost[]>([]);
  const [recentMessages, setRecentMessages] = useState<RecentMessage[]>([]);
  const [spaceName, setSpaceName] = useState<string>("");
  const [spaceDesc, setSpaceDesc] = useState<string>("");
  const [spaceCode, setSpaceCode] = useState<string>("");
  const [allowSpaceRequests, setAllowSpaceRequests] = useState(false);
  const [copied, setCopied] = useState(false);
  const [hour] = useState(() => new Date().getHours());
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqDesc, setReqDesc] = useState("");
  const [reqSending, setReqSending] = useState(false);
  const [reqDone, setReqDone] = useState(false);
  const [reqError, setReqError] = useState<string | null>(null);

  const greeting = hour < 6 ? "Bonne nuit" : hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ count }, { data: postsData }, { data: messagesData }, { data: spaceData }] = await Promise.all([
      supabase.from("space_members").select("user_id", { count: "exact", head: true }).eq("space_id", spaceId),
      supabase.from("posts").select("id, title, created_at, author_id, reactions(id)").eq("space_id", spaceId).order("created_at", { ascending: false }).limit(3),
      supabase.from("messages").select("id, content, created_at, author_id").eq("space_id", spaceId).order("created_at", { ascending: false }).limit(3),
      supabase.from("spaces").select("name, description, code, allow_space_requests").eq("id", spaceId).single(),
    ]);

    if (spaceData) {
      setSpaceName(spaceData.name ?? "");
      setSpaceDesc(spaceData.description ?? "");
      setSpaceCode(spaceData.code ?? "");
      setAllowSpaceRequests(spaceData.allow_space_requests ?? false);
    }

    setMemberCount(count ?? 0);

    const authorIds = [...new Set([...(postsData ?? []).map((p) => p.author_id), ...(messagesData ?? []).map((m) => m.author_id)])];
    const pseudoMap: Record<string, string> = {};
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, pseudo").in("id", authorIds);
      (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });
    }

    setRecentPosts((postsData ?? []).map((p) => ({
      id: p.id, title: p.title ?? null, created_at: p.created_at,
      pseudo: pseudoMap[p.author_id] ?? "—",
      reactions: p.reactions?.length ?? 0,
    })));

    setRecentMessages((messagesData ?? []).map((m) => ({
      id: m.id, content: m.content, created_at: m.created_at,
      pseudo: pseudoMap[m.author_id] ?? "—",
    })));
  };

  const canRequest = role === "admin" || allowSpaceRequests;

  const handleSubmitRequest = async () => {
    if (!reqName.trim() || reqSending) return;
    setReqSending(true);
    setReqError(null);
    const { data: session } = await (await import("@/lib/supabase")).supabase.auth.getSession();
    const token = session.session?.access_token;
    if (!token) { setReqError("Session expirée"); setReqSending(false); return; }
    const res = await fetch("/api/space-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: reqName.trim(), description: reqDesc.trim() || null, spaceId }),
    });
    const json = await res.json();
    if (!res.ok) { setReqError(json.error ?? "Erreur"); setReqSending(false); return; }
    setReqDone(true);
    setReqSending(false);
    setShowRequestModal(false);
    setReqName("");
    setReqDesc("");
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
          {spaceCode && (
            <div style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 10,
              background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "8px 16px",
            }}>
              <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
                Sésame
              </span>
              <span style={{ width: 1, height: 12, background: "var(--border)" }} />
              <code style={{ fontSize: 14, letterSpacing: "0.22em", color: "var(--foreground)", fontFamily: "monospace" }}>
                {spaceCode}
              </code>
              <button
                onClick={() => { navigator.clipboard.writeText(spaceCode); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                title="Copier le sésame"
                style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: copied ? "var(--accent)" : "var(--muted)",
                  fontSize: 11, padding: 0, lineHeight: 1,
                  transition: "color 0.15s",
                }}
              >
                {copied ? "✓" : "⎘"}
              </button>
            </div>
          )}
          {/* Bouton demander un espace */}
          {canRequest && !reqDone && (
            <div style={{ marginTop: 20 }}>
              <button
                onClick={() => { setShowRequestModal(true); setReqError(null); }}
                style={{
                  padding: "8px 20px",
                  background: "transparent",
                  border: "1px solid rgba(201,136,76,0.35)",
                  borderRadius: 6, cursor: "pointer",
                  color: "#c9884c", fontSize: 10,
                  letterSpacing: "0.12em", textTransform: "uppercase",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,136,76,0.08)"; e.currentTarget.style.borderColor = "rgba(201,136,76,0.6)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "rgba(201,136,76,0.35)"; }}
              >
                ◇ Demander un espace
              </button>
            </div>
          )}
          {reqDone && (
            <p style={{ marginTop: 16, fontSize: 11, color: "#4caf6e", letterSpacing: "0.06em" }}>
              ✓ Demande envoyée — en attente de validation.
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
                      fontFamily: "Georgia, serif",
                    }}>
                      {p.title ?? "Sans titre"}
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
      {/* Modal demande d'espace */}
      {showRequestModal && (
        <div
          onClick={() => setShowRequestModal(false)}
          style={{ position: "fixed", inset: 0, zIndex: 400, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{
            background: "var(--surface)", border: "1px solid rgba(201,136,76,0.3)",
            borderRadius: 12, padding: "28px 32px", maxWidth: 420, width: "calc(100% - 48px)",
            boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
          }}>
            <div style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.16em", textTransform: "uppercase", marginBottom: 20 }}>
              ◇ Demander un espace
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Nom de l&apos;espace *</div>
                <input
                  value={reqName}
                  onChange={(e) => setReqName(e.target.value)}
                  placeholder="Ex : Cercle des lecteurs"
                  style={{
                    width: "100%", padding: "10px 14px", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                    borderRadius: 6, color: "var(--foreground)", fontSize: 13,
                    outline: "none", fontFamily: "inherit",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                  autoFocus
                />
              </div>
              <div>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Description (optionnel)</div>
                <textarea
                  value={reqDesc}
                  onChange={(e) => setReqDesc(e.target.value)}
                  placeholder="Décris l'objet de cet espace…"
                  rows={3}
                  style={{
                    width: "100%", padding: "10px 14px", boxSizing: "border-box",
                    background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                    borderRadius: 6, color: "var(--foreground)", fontSize: 13,
                    outline: "none", fontFamily: "inherit", resize: "none",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
              </div>
              {reqError && <p style={{ margin: 0, fontSize: 11, color: "#c94c4c" }}>{reqError}</p>}
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button
                  onClick={handleSubmitRequest}
                  disabled={!reqName.trim() || reqSending}
                  style={{
                    flex: 1, padding: "10px 0",
                    background: reqName.trim() ? "rgba(201,136,76,0.15)" : "transparent",
                    border: `1px solid ${reqName.trim() ? "rgba(201,136,76,0.5)" : "var(--border)"}`,
                    borderRadius: 6,
                    color: reqName.trim() ? "#c9884c" : "var(--muted)",
                    fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase",
                    cursor: reqName.trim() && !reqSending ? "pointer" : "not-allowed",
                  }}
                >
                  {reqSending ? "Envoi…" : "Envoyer"}
                </button>
                <button
                  onClick={() => setShowRequestModal(false)}
                  style={{
                    padding: "10px 18px", background: "transparent",
                    border: "1px solid var(--border)", borderRadius: 6,
                    color: "var(--muted)", fontSize: 10, letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: "pointer",
                  }}
                >
                  Annuler
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
