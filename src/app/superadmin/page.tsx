"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "";

type Space = {
  id: string; name: string; description: string | null; code: string;
  created_at: string; members: number; posts: number; messages: number;
  open_access: boolean;
};
type ModMsg = { id: string; content: string; from_owner: boolean; created_at: string };
type CandidatureItem = { user_id: string; pseudo: string; space_id: string; space_name: string; messages: ModMsg[] };

export default function SuperAdminPage() {
  const router = useRouter();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [candidatures, setCandidatures] = useState<CandidatureItem[]>([]);
  const [selectedCandidature, setSelectedCandidature] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState("");
  const [replying, setReplying] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const email = data.session?.user?.email ?? "";
      if (!data.session || email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        router.push("/"); return;
      }
      setToken(data.session.access_token);
      setReady(true);
    });
  }, [router]);

  useEffect(() => {
    if (token) { fetchSpaces(); fetchCandidatures(); }
  }, [token]);

  const fetchCandidatures = async () => {
    const { data: appsData } = await supabase
      .from("mod_applications")
      .select("id, space_id, user_id, content, from_owner, created_at")
      .order("created_at", { ascending: true });
    if (!appsData || appsData.length === 0) { setCandidatures([]); return; }

    const userIds = [...new Set(appsData.map((a) => a.user_id))];
    const spaceIds = [...new Set(appsData.map((a) => a.space_id))];
    const [{ data: profiles }, { data: spacesData }] = await Promise.all([
      supabase.from("profiles").select("id, pseudo").in("id", userIds),
      supabase.from("spaces").select("id, name").in("id", spaceIds),
    ]);

    const pseudoMap: Record<string, string> = {};
    (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });
    const spaceNameMap: Record<string, string> = {};
    (spacesData ?? []).forEach((s) => { spaceNameMap[s.id] = s.name; });

    const grouped: Record<string, CandidatureItem> = {};
    appsData.forEach((a) => {
      const key = `${a.space_id}__${a.user_id}`;
      if (!grouped[key]) grouped[key] = { user_id: a.user_id, pseudo: pseudoMap[a.user_id] ?? "—", space_id: a.space_id, space_name: spaceNameMap[a.space_id] ?? "—", messages: [] };
      grouped[key].messages.push({ id: a.id, content: a.content, from_owner: a.from_owner, created_at: a.created_at });
    });
    const sorted = Object.values(grouped).sort((a, b) => {
      const aLatest = Math.max(...a.messages.map((m) => new Date(m.created_at).getTime()));
      const bLatest = Math.max(...b.messages.map((m) => new Date(m.created_at).getTime()));
      return bLatest - aLatest;
    });
    setCandidatures(sorted);
  };

  const handleReply = async (applicantId: string, spaceId: string) => {
    if (!replyInput.trim() || replying) return;
    setReplying(true);
    await supabase.from("mod_applications").insert({
      space_id: spaceId, user_id: applicantId, content: replyInput.trim(), from_owner: true,
    });
    setReplyInput("");
    await fetchCandidatures();
    setReplying(false);
  };

  const fetchSpaces = async () => {
    const res = await fetch("/api/spaces", { headers: { authorization: `Bearer ${token}` } });
    if (res.ok) setSpaces(await res.json());
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setLoading(true); setError(null);
    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: newName, description: newDesc }),
    });
    if (res.ok) {
      setNewName(""); setNewDesc(""); setCreating(false);
      await fetchSpaces();
    } else {
      const d = await res.json();
      setError(d.error ?? "Erreur");
    }
    setLoading(false);
  };

  const handleToggleOpenAccess = async (spaceId: string, current: boolean) => {
    await supabase.from("spaces").update({ open_access: !current }).eq("id", spaceId);
    setSpaces((prev) => prev.map((s) => s.id === spaceId ? { ...s, open_access: !current } : s));
  };

  const handleDelete = async (spaceId: string) => {
    setLoading(true);
    await fetch("/api/spaces", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ spaceId }),
    });
    setDeleteConfirm(null);
    await fetchSpaces();
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push("/");
  };

  if (!ready) return null;

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)", padding: "40px 24px" }}>

      {/* Halo ambiance */}
      <div style={{
        position: "fixed", top: "0%", left: "50%", transform: "translateX(-50%)",
        width: 800, height: 500,
        background: "radial-gradient(ellipse, rgba(201,136,76,0.05) 0%, transparent 65%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 680, margin: "0 auto", position: "relative", zIndex: 1 }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 48 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 22, color: "#c9884c" }}>♔</span>
              <h1 style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.28em",
                textTransform: "uppercase", color: "#c9884c",
                fontFamily: "Georgia, serif", margin: 0,
              }}>
                Espace fondateur
              </h1>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em", margin: 0 }}>
              Gestion des communautés Sibyl
            </p>
          </div>
          <button onClick={handleLogout}
            style={{
              background: "rgba(201,76,76,0.1)", border: "1px solid rgba(201,76,76,0.35)", borderRadius: 6,
              color: "#c94c4c", fontSize: 10, letterSpacing: "0.12em",
              textTransform: "uppercase", padding: "8px 16px", cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(201,76,76,0.2)"; e.currentTarget.style.borderColor = "rgba(201,76,76,0.6)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(201,76,76,0.1)"; e.currentTarget.style.borderColor = "rgba(201,76,76,0.35)"; }}
          >
            Déconnexion
          </button>
        </div>

        {/* Liste des espaces */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, gap: 12,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1 }}>
              <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase", flexShrink: 0 }}>
                Communautés — {spaces.filter(s => s.name.toLowerCase().includes(search.toLowerCase()) || (s.description ?? "").toLowerCase().includes(search.toLowerCase())).length}
              </span>
              <div style={{
                flex: 1, display: "flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "6px 12px",
                transition: "border-color 0.15s",
              }}
                onFocusCapture={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.45)")}
                onBlurCapture={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" strokeWidth="1.5"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher un espace…"
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    color: "var(--foreground)", fontSize: 12, fontFamily: "inherit",
                  }}
                />
                {search && (
                  <button onClick={() => setSearch("")} style={{ background: "transparent", border: "none", color: "var(--muted)", cursor: "pointer", fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                )}
              </div>
            </div>
            <button
              onClick={() => { setCreating(true); setError(null); }}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                background: "rgba(201,136,76,0.1)", border: "1px solid rgba(201,136,76,0.35)",
                borderRadius: 6, color: "#c9884c", fontSize: 10,
                letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "7px 14px", cursor: "pointer",
              }}
            >
              + Créer un espace
            </button>
          </div>

          {/* Formulaire création */}
          {creating && (
            <div style={{
              background: "var(--glass)", backdropFilter: "blur(24px)",
              border: "1px solid rgba(201,136,76,0.25)", borderRadius: 12,
              padding: "20px 24px", marginBottom: 12,
              animation: "fadeUp 0.2s ease",
            }}>
              <div style={{ fontSize: 10, color: "#c9884c", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 16 }}>
                Nouvel espace
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nom de la communauté"
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                    borderRadius: 6, padding: "10px 14px", color: "var(--foreground)",
                    fontSize: 13, outline: "none", width: "100%",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
                <input
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  placeholder="Description (optionnel)"
                  style={{
                    background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                    borderRadius: 6, padding: "10px 14px", color: "var(--foreground)",
                    fontSize: 13, outline: "none", width: "100%",
                  }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.5)")}
                  onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
                />
                {error && <p style={{ fontSize: 11, color: "#c94c4c", margin: 0 }}>{error}</p>}
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={handleCreate} disabled={!newName.trim() || loading} style={{
                    flex: 1, padding: "10px 0",
                    background: newName.trim() ? "rgba(201,136,76,0.15)" : "transparent",
                    border: `1px solid ${newName.trim() ? "rgba(201,136,76,0.5)" : "var(--border)"}`,
                    borderRadius: 6, color: newName.trim() ? "#c9884c" : "var(--muted)",
                    fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase",
                    cursor: newName.trim() ? "pointer" : "not-allowed",
                  }}>
                    {loading ? "Création…" : "Créer"}
                  </button>
                  <button onClick={() => { setCreating(false); setNewName(""); setNewDesc(""); setError(null); }} style={{
                    padding: "10px 18px", background: "transparent",
                    border: "1px solid var(--border)", borderRadius: 6,
                    color: "var(--muted)", fontSize: 10, letterSpacing: "0.12em",
                    textTransform: "uppercase", cursor: "pointer",
                  }}>
                    Annuler
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cards espaces */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {spaces.filter((s) =>
              s.name.toLowerCase().includes(search.toLowerCase())
            ).map((space) => (
              <div key={space.id} style={{
                background: "var(--glass)", backdropFilter: "blur(20px)",
                border: "1px solid var(--glass-border)", borderRadius: 12,
                padding: "20px 24px",
                boxShadow: "var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                        {space.name}
                      </span>
                      <span style={{
                        fontSize: 9, color: "var(--muted)", fontFamily: "monospace",
                        background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                        borderRadius: 4, padding: "2px 8px", letterSpacing: "0.1em",
                      }}>
                        {space.code}
                      </span>
                    </div>
                    {space.description && (
                      <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.5 }}>
                        {space.description}
                      </p>
                    )}
                    <div style={{ display: "flex", gap: 20 }}>
                      <Stat label="Membres" value={space.members} />
                      <Stat label="Posts" value={space.posts} />
                      <Stat label="Messages" value={space.messages} />
                      <Stat label="Créé le" value={new Date(space.created_at).toLocaleDateString("fr-FR")} small />
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>

                    {/* Toggle accès libre */}
                    <button
                      onClick={() => handleToggleOpenAccess(space.id, space.open_access)}
                      title={space.open_access ? "Accès libre activé" : "Accès sur invitation uniquement"}
                      style={{
                        display: "flex", alignItems: "center", gap: 8,
                        padding: "7px 10px",
                        background: space.open_access ? "rgba(138,127,248,0.1)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${space.open_access ? "rgba(138,127,248,0.35)" : "var(--border)"}`,
                        borderRadius: 6, cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      <span style={{ fontSize: 9, color: space.open_access ? "var(--accent)" : "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                        {space.open_access ? "Accès libre" : "Sur invitation"}
                      </span>
                      {/* mini toggle visuel */}
                      <span style={{
                        width: 28, height: 16, borderRadius: 8, flexShrink: 0,
                        background: space.open_access ? "var(--accent)" : "var(--border)",
                        position: "relative", display: "inline-block",
                        transition: "background 0.2s",
                      }}>
                        <span style={{
                          position: "absolute", top: 2,
                          left: space.open_access ? 14 : 2,
                          width: 12, height: 12, borderRadius: "50%",
                          background: "#fff",
                          transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                        }} />
                      </span>
                    </button>

                    <button
                      onClick={() => router.push("/feed?space=" + space.id)}
                      style={{
                        padding: "7px 14px", background: "rgba(138,127,248,0.1)",
                        border: "1px solid rgba(138,127,248,0.3)", borderRadius: 6,
                        color: "var(--accent)", fontSize: 9, letterSpacing: "0.12em",
                        textTransform: "uppercase", cursor: "pointer", whiteSpace: "nowrap",
                      }}
                    >
                      Entrer →
                    </button>
                    {deleteConfirm === space.id ? (
                      <div style={{ display: "flex", gap: 4 }}>
                        <button onClick={() => handleDelete(space.id)} style={{
                          flex: 1, padding: "6px 8px", background: "rgba(201,76,76,0.15)",
                          border: "1px solid rgba(201,76,76,0.4)", borderRadius: 5,
                          color: "#c94c4c", fontSize: 9, cursor: "pointer",
                        }}>
                          Confirmer
                        </button>
                        <button onClick={() => setDeleteConfirm(null)} style={{
                          flex: 1, padding: "6px 8px", background: "transparent",
                          border: "1px solid var(--border)", borderRadius: 5,
                          color: "var(--muted)", fontSize: 9, cursor: "pointer",
                        }}>
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setDeleteConfirm(space.id)}
                        style={{
                          padding: "7px 14px", background: "transparent",
                          border: "1px solid rgba(201,76,76,0.25)", borderRadius: 6,
                          color: "rgba(201,76,76,0.7)", fontSize: 9, letterSpacing: "0.12em",
                          textTransform: "uppercase", cursor: "pointer",
                        }}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {spaces.length === 0 && (
              <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", padding: "40px 0" }}>
                Aucune communauté.
              </p>
            )}
            {spaces.length > 0 && search && spaces.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
              <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", padding: "40px 0" }}>
                Aucun résultat pour « {search} ».
              </p>
            )}
          </div>
        </div>

        {/* Candidatures */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
            <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.14em", textTransform: "uppercase" }}>
              Candidatures modérateur — {candidatures.length}
            </span>
            {candidatures.some((c) => !c.messages[c.messages.length - 1]?.from_owner) && (
              <span style={{ fontSize: 8, background: "rgba(201,136,76,0.15)", color: "#c9884c", border: "1px solid rgba(201,136,76,0.4)", borderRadius: 3, padding: "2px 7px", letterSpacing: "0.08em" }}>
                Nouvelles
              </span>
            )}
          </div>

          {candidatures.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", padding: "32px 0" }}>
              Aucune candidature pour l'instant.
            </p>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {candidatures.map((c) => {
              const key = `${c.space_id}__${c.user_id}`;
              const isOpen = selectedCandidature === key;
              const lastMsg = c.messages[c.messages.length - 1];
              const hasNew = lastMsg && !lastMsg.from_owner;
              return (
                <div key={key}>
                  <div
                    onClick={() => { setSelectedCandidature(isOpen ? null : key); setReplyInput(""); }}
                    style={{
                      background: isOpen ? "rgba(201,136,76,0.06)" : "var(--glass)",
                      backdropFilter: "blur(20px)",
                      border: `1px solid ${isOpen ? "rgba(201,136,76,0.35)" : "var(--glass-border)"}`,
                      borderRadius: isOpen ? "12px 12px 0 0" : 12,
                      padding: "16px 20px", cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 14,
                    }}
                  >
                    <div style={{ width: 34, height: 34, borderRadius: "50%", background: "rgba(201,136,76,0.1)", border: "1px solid rgba(201,136,76,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#c9884c", fontWeight: 600, flexShrink: 0 }}>
                      {c.pseudo[0]?.toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", fontFamily: "Georgia, serif" }}>{c.pseudo}</span>
                        <span style={{ fontSize: 9, color: "var(--muted)", background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)", borderRadius: 3, padding: "2px 7px" }}>{c.space_name}</span>
                        {hasNew && <span style={{ fontSize: 8, background: "rgba(201,136,76,0.15)", color: "#c9884c", border: "1px solid rgba(201,136,76,0.4)", borderRadius: 3, padding: "2px 6px" }}>Nouveau</span>}
                      </div>
                      <p style={{ margin: 0, fontSize: 11, color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {lastMsg?.content}
                      </p>
                    </div>
                    <span style={{ color: "var(--muted)", fontSize: 10, flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>
                  </div>

                  {isOpen && (
                    <div style={{ border: "1px solid rgba(201,136,76,0.35)", borderTop: "none", borderRadius: "0 0 12px 12px", background: "rgba(201,136,76,0.02)", backdropFilter: "blur(20px)" }}>
                      <div style={{ padding: "16px 20px 12px", display: "flex", flexDirection: "column", gap: 10, maxHeight: 300, overflowY: "auto" }}>
                        {c.messages.map((msg) => (
                          <div key={msg.id} style={{ display: "flex", flexDirection: "column", alignItems: msg.from_owner ? "flex-end" : "flex-start", gap: 3 }}>
                            <span style={{ fontSize: 9, color: msg.from_owner ? "#c9884c" : "var(--muted)", letterSpacing: "0.06em" }}>
                              {msg.from_owner ? "♔ Vous" : c.pseudo}
                            </span>
                            <div style={{
                              maxWidth: "80%",
                              background: msg.from_owner ? "rgba(201,136,76,0.12)" : "rgba(255,255,255,0.04)",
                              border: `1px solid ${msg.from_owner ? "rgba(201,136,76,0.35)" : "var(--border)"}`,
                              borderRadius: msg.from_owner ? "12px 2px 12px 12px" : "2px 12px 12px 12px",
                              padding: "8px 14px",
                            }}>
                              <p style={{ margin: 0, fontSize: 12, color: "var(--foreground)", lineHeight: 1.65 }}>{msg.content}</p>
                            </div>
                            <span style={{ fontSize: 9, color: "var(--muted)" }}>
                              {new Date(msg.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div style={{ padding: "0 20px 16px", display: "flex", gap: 8 }}>
                        <input
                          value={replyInput}
                          onChange={(e) => setReplyInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") handleReply(c.user_id, c.space_id); }}
                          placeholder="Répondre…"
                          style={{
                            flex: 1, padding: "9px 14px",
                            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(201,136,76,0.3)",
                            borderRadius: 6, color: "var(--foreground)", fontSize: 12,
                            outline: "none", fontFamily: "inherit",
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.6)")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "rgba(201,136,76,0.3)")}
                        />
                        <button onClick={() => handleReply(c.user_id, c.space_id)} disabled={!replyInput.trim() || replying} style={{
                          padding: "9px 16px", background: replyInput.trim() ? "rgba(201,136,76,0.15)" : "transparent",
                          border: `1px solid ${replyInput.trim() ? "rgba(201,136,76,0.5)" : "var(--border)"}`,
                          borderRadius: 6, color: replyInput.trim() ? "#c9884c" : "var(--muted)",
                          fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase",
                          cursor: replyInput.trim() ? "pointer" : "not-allowed",
                        }}>
                          {replying ? "…" : "Envoyer"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em", fontStyle: "italic", opacity: 0.5 }}>
          Sibyl — Espace fondateur · v1
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: small ? 10 : 13, fontWeight: 600, color: "var(--foreground)" }}>{value}</span>
      <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}
