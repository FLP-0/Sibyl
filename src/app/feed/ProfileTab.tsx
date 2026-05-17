"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";


type Stats = { posts: number; likesReceived: number; messages: number; joinedAt: string };

export default function ProfileTab({ userId, pseudo, setPseudo, spaceId }: {
  userId: string;
  pseudo: string;
  setPseudo: (p: string) => void;
  spaceId: string;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [role, setRole] = useState<string>("member");
  const [bio, setBio] = useState<string>("");
  const [editingPseudo, setEditingPseudo] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [newPseudo, setNewPseudo] = useState(pseudo);
  const [newBio, setNewBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [shareCode, setShareCode] = useState<string | null>(null);

  useEffect(() => { if (userId !== "dev-user") fetchProfile(); }, [userId]);

  const fetchProfile = async () => {
    const [{ data: postsData }, { count: messagesCount }, { data: profile }, { data: member }] = await Promise.all([
      supabase.from("posts").select("id, reactions(id)").eq("author_id", userId).eq("space_id", spaceId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("space_id", spaceId),
      supabase.from("profiles").select("created_at, bio").eq("id", userId).single(),
      supabase.from("space_members").select("role").eq("user_id", userId).eq("space_id", spaceId).single(),
    ]);

    setStats({
      posts: postsData?.length ?? 0,
      likesReceived: postsData?.reduce((acc, p) => acc + (p.reactions?.length ?? 0), 0) ?? 0,
      messages: messagesCount ?? 0,
      joinedAt: profile?.created_at ?? "",
    });
    setBio(profile?.bio ?? "");
    setNewBio(profile?.bio ?? "");
    setRole(member?.role ?? "member");
  };

  const handleSavePseudo = async () => {
    if (!newPseudo.trim() || newPseudo.trim() === pseudo) { setEditingPseudo(false); return; }
    setSaving(true);
    setError(null);
    const { error: dbError } = await supabase.from("profiles").update({ pseudo: newPseudo.trim() }).eq("id", userId);
    if (dbError) {
      setError(dbError.message.includes("unique") ? "Ce pseudo est déjà pris." : "Erreur lors de la sauvegarde.");
      setSaving(false);
      return;
    }
    await supabase.auth.updateUser({ data: { pseudo: newPseudo.trim() } });
    setPseudo(newPseudo.trim());
    setEditingPseudo(false);
    setSaving(false);
    showSuccess("Pseudo mis à jour.");
  };

  const handleSaveBio = async () => {
    setSaving(true);
    const { error: dbError } = await supabase.from("profiles").update({ bio: newBio.trim() }).eq("id", userId);
    if (dbError) {
      setError("Erreur lors de la sauvegarde.");
      setSaving(false);
      return;
    }
    setBio(newBio.trim());
    setEditingBio(false);
    setSaving(false);
    showSuccess("Bio mise à jour.");
  };

  const showSuccess = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 2000);
  };

  const handleCreateInvite = async () => {
    setInviteLoading(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erreur inconnue");
      setShareCode(json.invitation.code);
    } catch (e) {
      alert("Impossible de créer l'invitation : " + (e instanceof Error ? e.message : e));
    }
    setInviteLoading(false);
  };

  const roleLabel: Record<string, { label: string; color: string }> = {
    admin:     { label: "Admin",       color: "#c9884c" },
    moderator: { label: "Modérateur",  color: "var(--accent)" },
    member:    { label: "Membre",      color: "var(--muted)" },
  };
  const roleInfo = roleLabel[role] ?? roleLabel.member;

  const joinedDate = stats?.joinedAt
    ? new Date(stats.joinedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 24px" }}>

        {/* Avatar + pseudo + rôle */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginBottom: 32 }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(124,111,247,0.12)",
            border: "1px solid rgba(124,111,247,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 28, color: "var(--accent)", fontWeight: 600, userSelect: "none",
          }}>
            {pseudo[0]?.toUpperCase()}
          </div>

          {/* Pseudo */}
          {editingPseudo ? (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, width: "100%", maxWidth: 260 }}>
              <input
                autoFocus
                value={newPseudo}
                onChange={(e) => { setNewPseudo(e.target.value); setError(null); }}
                onKeyDown={(e) => { if (e.key === "Enter") handleSavePseudo(); if (e.key === "Escape") setEditingPseudo(false); }}
                style={{
                  width: "100%", padding: "10px 14px", textAlign: "center",
                  background: "var(--surface)", border: "1px solid var(--accent)",
                  borderRadius: 4, color: "var(--foreground)", fontSize: 15,
                  fontWeight: 600, outline: "none", boxSizing: "border-box",
                }}
              />
              {error && <span style={{ fontSize: 11, color: "#c94c4c" }}>{error}</span>}
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setEditingPseudo(false)} style={{
                  padding: "7px 16px", background: "transparent",
                  border: "1px solid var(--border)", borderRadius: 4,
                  color: "var(--muted)", fontSize: 10, letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: "pointer",
                }}>
                  Annuler
                </button>
                <button onClick={handleSavePseudo} disabled={saving} style={{
                  padding: "7px 16px", background: "var(--accent)", border: "none",
                  borderRadius: 4, color: "#fff", fontSize: 10, letterSpacing: "0.1em",
                  textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer",
                }}>
                  {saving ? "…" : "Sauvegarder"}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20, fontWeight: 600, color: "var(--foreground)", letterSpacing: "0.04em" }}>
                {pseudo}
              </span>
              {userId !== "dev-user" && (
                <button onClick={() => { setNewPseudo(pseudo); setEditingPseudo(true); }} style={{
                  background: "transparent", border: "none", cursor: "pointer",
                  color: "var(--muted)", padding: 4, display: "flex", transition: "color 0.15s",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
                  title="Modifier le pseudo"
                >
                  <PencilIcon />
                </button>
              )}
            </div>
          )}

          {/* Rôle */}
          <span style={{
            fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase",
            color: roleInfo.color, border: `1px solid ${roleInfo.color}`,
            borderRadius: 3, padding: "3px 10px", opacity: 0.85,
          }}>
            {roleInfo.label}
          </span>

          {success && (
            <span style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.04em" }}>{success}</span>
          )}
        </div>

        {/* Bio */}
        <div style={{
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: 6, padding: 16, marginBottom: 24,
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Bio
            </span>
            {!editingBio && userId !== "dev-user" && (
              <button onClick={() => { setNewBio(bio); setEditingBio(true); }} style={{
                background: "transparent", border: "none", cursor: "pointer",
                color: "var(--muted)", padding: 4, display: "flex", transition: "color 0.15s",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--muted)")}
              >
                <PencilIcon />
              </button>
            )}
          </div>

          {editingBio ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <textarea
                autoFocus
                value={newBio}
                onChange={(e) => setNewBio(e.target.value)}
                rows={3}
                maxLength={200}
                placeholder="Quelques mots sur toi…"
                style={{
                  width: "100%", background: "transparent", border: "none",
                  outline: "none", color: "var(--foreground)", fontSize: 13,
                  lineHeight: 1.7, resize: "none", fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>{newBio.length}/200</span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => setEditingBio(false)} style={{
                    padding: "6px 14px", background: "transparent",
                    border: "1px solid var(--border)", borderRadius: 4,
                    color: "var(--muted)", fontSize: 10, letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: "pointer",
                  }}>
                    Annuler
                  </button>
                  <button onClick={handleSaveBio} disabled={saving} style={{
                    padding: "6px 14px", background: "var(--accent)", border: "none",
                    borderRadius: 4, color: "#fff", fontSize: 10, letterSpacing: "0.1em",
                    textTransform: "uppercase", cursor: saving ? "not-allowed" : "pointer",
                  }}>
                    {saving ? "…" : "Sauvegarder"}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <p style={{
              margin: 0, fontSize: 13, color: bio ? "var(--foreground)" : "var(--muted)",
              lineHeight: 1.7, fontStyle: bio ? "normal" : "italic",
              fontFamily: bio ? "inherit" : "Georgia, serif",
            }}>
              {bio || "Aucune bio pour l'instant."}
            </p>
          )}
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 24 }}>
          <StatCard label="Publications" value={stats?.posts ?? "—"} />
          <StatCard label="Likes reçus" value={stats?.likesReceived ?? "—"} />
          <StatCard label="Messages chat" value={stats?.messages ?? "—"} />
          <StatCard label="Membre depuis" value={joinedDate} small />
        </div>

        {/* Inviter */}
        {userId !== "dev-user" && (
          <button onClick={handleCreateInvite} disabled={inviteLoading} style={{
            width: "100%", padding: "13px 0",
            background: "rgba(124,111,247,0.06)", border: "1px solid rgba(124,111,247,0.3)",
            borderRadius: 6, color: "var(--accent)", fontSize: 11,
            letterSpacing: "0.12em", textTransform: "uppercase",
            cursor: inviteLoading ? "not-allowed" : "pointer", transition: "all 0.15s",
          }}
            onMouseEnter={(e) => { if (!inviteLoading) e.currentTarget.style.borderColor = "var(--accent)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "rgba(124,111,247,0.3)"; }}
          >
            {inviteLoading ? "…" : "Inviter un ami"}
          </button>
        )}

      </div>

      {/* Modale partage */}
      {shareCode && (() => {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const link = `${base}/register?invite=${shareCode}`;
        const msg = `Tu es invité(e) à rejoindre Sibyl — la communauté privée. Rejoins-nous ici : ${link}`;
        const canShare = typeof navigator !== "undefined" && !!navigator.share;
        const btnStyle = (color: string): React.CSSProperties => ({
          width: "100%", padding: "10px 16px", background: "transparent",
          border: `1px solid ${color}`, borderRadius: 4, color,
          fontSize: 11, letterSpacing: "0.08em", cursor: "pointer",
          textAlign: "left", opacity: 0.85,
        });
        return (
          <div style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => setShareCode(null)}>
            <div onClick={(e) => e.stopPropagation()} style={{
              background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8,
              padding: "28px 32px", maxWidth: 400, width: "100%", margin: "0 16px",
              boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
            }}>
              <div style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 18 }}>
                Partager l'invitation
              </div>
              <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)", borderRadius: 6, padding: "12px 16px", marginBottom: 20 }}>
                <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Code</div>
                <code style={{ fontSize: 18, letterSpacing: "0.2em", color: "var(--foreground)", fontFamily: "monospace" }}>{shareCode}</code>
                <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 8, wordBreak: "break-all" }}>{link}</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {canShare && (
                  <button onClick={() => navigator.share({ title: "Invitation Sibyl", text: msg, url: link })} style={btnStyle("#c9884c")}>
                    Partager…
                  </button>
                )}
                <button onClick={() => window.open(`mailto:?subject=Invitation%20Sibyl&body=${encodeURIComponent(msg)}`)} style={btnStyle("var(--accent)")}>
                  Envoyer par e-mail
                </button>
                <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`)} style={btnStyle("#25D366")}>
                  Envoyer sur WhatsApp
                </button>
                <button onClick={() => window.open(`sms:?body=${encodeURIComponent(msg)}`)} style={btnStyle("var(--muted)")}>
                  Envoyer par SMS
                </button>
                <button onClick={() => navigator.clipboard.writeText(link).then(() => showSuccess("Lien copié !"))} style={btnStyle("var(--foreground)")}>
                  Copier le lien
                </button>
              </div>
              <button onClick={() => setShareCode(null)} style={{
                marginTop: 16, width: "100%", padding: "9px 0", background: "transparent",
                border: "1px solid var(--border)", borderRadius: 4, color: "var(--muted)",
                fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", cursor: "pointer",
              }}>Fermer</button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function StatCard({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)",
      borderRadius: 6, padding: "16px 12px", textAlign: "center",
    }}>
      <div style={{
        fontSize: small ? 13 : 22, fontWeight: 600,
        color: "var(--foreground)", marginBottom: 6,
        fontFamily: small ? "inherit" : "Georgia, serif",
      }}>
        {value}
      </div>
      <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {label}
      </div>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}
