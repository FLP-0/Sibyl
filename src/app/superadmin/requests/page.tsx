"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const OWNER_EMAIL = process.env.NEXT_PUBLIC_OWNER_EMAIL ?? "";

type SpaceRequest = {
  id: string;
  requester_id: string;
  requester_pseudo: string;
  source_space_name: string;
  name: string;
  description: string | null;
  created_at: string;
  status: string;
};

export default function RequestsPage() {
  const router = useRouter();
  const [requests, setRequests] = useState<SpaceRequest[]>([]);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, "approved" | "rejected">>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const email = data.session?.user?.email ?? "";
      if (!data.session || email.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
        router.push("/"); return;
      }
      setToken(data.session.access_token);
      setReady(true);
    });
  }, [router]);

  useEffect(() => {
    if (token) fetchRequests();
  }, [token]);

  const fetchRequests = async () => {
    setLoading(true);
    const res = await fetch("/api/space-requests", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  };

  const handleAction = async (id: string, action: "approve" | "reject") => {
    setProcessing(id);
    const res = await fetch("/api/space-requests", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) {
      const result = action === "approve" ? "approved" : "rejected";
      setDone((prev) => ({ ...prev, [id]: result }));
      setTimeout(() => {
        setRequests((prev) => prev.filter((r) => r.id !== id));
        setDone((prev) => { const n = { ...prev }; delete n[id]; return n; });
      }, 1200);
    }
    setProcessing(null);
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
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 48 }}>
          <button
            onClick={() => router.push("/superadmin")}
            style={{
              background: "rgba(255,255,255,0.03)", border: "1px solid var(--border)",
              borderRadius: 6, cursor: "pointer", color: "var(--muted)",
              fontSize: 16, padding: "6px 12px", lineHeight: 1,
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "rgba(201,136,76,0.4)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
          >←</button>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
              <span style={{ fontSize: 20, color: "#c9884c" }}>♔</span>
              <h1 style={{
                fontSize: 11, fontWeight: 600, letterSpacing: "0.28em",
                textTransform: "uppercase", color: "#c9884c",
                fontFamily: "Georgia, serif", margin: 0,
              }}>
                Demandes d&apos;espaces
              </h1>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.04em", margin: 0 }}>
              {loading ? "Chargement…" : `${requests.length} demande${requests.length !== 1 ? "s" : ""} en attente`}
            </p>
          </div>
        </div>

        {/* Liste */}
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", padding: "60px 0" }}>
            Chargement…
          </p>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 16, opacity: 0.3 }}>◇</div>
            <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif", margin: 0 }}>
              Aucune demande en attente.
            </p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {requests.map((req) => {
              const result = done[req.id];
              return (
                <div key={req.id} style={{
                  background: result === "approved"
                    ? "rgba(76,175,110,0.06)"
                    : result === "rejected"
                    ? "rgba(201,76,76,0.04)"
                    : "var(--glass)",
                  backdropFilter: "blur(20px)",
                  border: `1px solid ${result === "approved" ? "rgba(76,175,110,0.35)" : result === "rejected" ? "rgba(201,76,76,0.25)" : "var(--glass-border)"}`,
                  borderRadius: 12,
                  padding: "20px 24px",
                  boxShadow: "var(--shadow-sm), inset 0 1px 0 rgba(255,255,255,0.04)",
                  transition: "all 0.3s",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>

                      {/* Demandeur */}
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          background: "rgba(201,136,76,0.1)", border: "1px solid rgba(201,136,76,0.25)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 14, color: "#c9884c", fontWeight: 600,
                        }}>{req.requester_pseudo[0]?.toUpperCase()}</div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                              {req.requester_pseudo}
                            </span>
                            <span style={{
                              fontSize: 9, color: "var(--muted)",
                              background: "rgba(255,255,255,0.04)", border: "1px solid var(--border)",
                              borderRadius: 3, padding: "2px 7px", letterSpacing: "0.08em",
                            }}>
                              {req.source_space_name}
                            </span>
                          </div>
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>
                            {new Date(req.created_at).toLocaleString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </div>

                      {/* Espace demandé */}
                      <div style={{ borderLeft: "2px solid rgba(201,136,76,0.35)", paddingLeft: 14 }}>
                        <div style={{ fontSize: 9, color: "#c9884c", letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 6 }}>
                          Espace demandé
                        </div>
                        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", fontFamily: "Georgia, serif", marginBottom: req.description ? 6 : 0 }}>
                          {req.name}
                        </div>
                        {req.description && (
                          <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                            {req.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Actions / résultat */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0, minWidth: 90 }}>
                      {result ? (
                        <div style={{
                          padding: "8px 14px", textAlign: "center",
                          fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase",
                          color: result === "approved" ? "#4caf6e" : "#c94c4c",
                          border: `1px solid ${result === "approved" ? "rgba(76,175,110,0.4)" : "rgba(201,76,76,0.3)"}`,
                          borderRadius: 6,
                        }}>
                          {result === "approved" ? "Approuvé ✓" : "Refusé"}
                        </div>
                      ) : (
                        <>
                          <button
                            onClick={() => handleAction(req.id, "approve")}
                            disabled={!!processing}
                            style={{
                              padding: "8px 16px", background: "rgba(76,175,110,0.1)",
                              border: "1px solid rgba(76,175,110,0.4)", borderRadius: 6,
                              color: "#4caf6e", fontSize: 9, letterSpacing: "0.12em",
                              textTransform: "uppercase", cursor: processing ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap", transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => { if (!processing) e.currentTarget.style.background = "rgba(76,175,110,0.18)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(76,175,110,0.1)"; }}
                          >
                            {processing === req.id ? "…" : "Approuver"}
                          </button>
                          <button
                            onClick={() => handleAction(req.id, "reject")}
                            disabled={!!processing}
                            style={{
                              padding: "8px 16px", background: "transparent",
                              border: "1px solid rgba(201,76,76,0.3)", borderRadius: 6,
                              color: "rgba(201,76,76,0.8)", fontSize: 9, letterSpacing: "0.12em",
                              textTransform: "uppercase", cursor: processing ? "not-allowed" : "pointer",
                              whiteSpace: "nowrap", transition: "background 0.15s",
                            }}
                            onMouseEnter={(e) => { if (!processing) e.currentTarget.style.background = "rgba(201,76,76,0.06)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                          >
                            Refuser
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p style={{ textAlign: "center", fontSize: 10, color: "var(--muted)", letterSpacing: "0.04em", fontStyle: "italic", opacity: 0.5, marginTop: 48 }}>
          Sibyl — Espace fondateur · v1
        </p>
      </div>
    </div>
  );
}
