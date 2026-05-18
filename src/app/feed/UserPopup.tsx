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

type Props = {
  userId: string;
  anchorEl: HTMLElement | null;
  onClose: () => void;
  onViewProfile?: (userId: string) => void;
  spaceId: string;
  currentUserId?: string;
};

const roleLabel: Record<string, { label: string; color: string }> = {
  admin:     { label: "Admin",      color: "#c9884c" },
  moderator: { label: "Modérateur", color: "var(--accent)" },
  member:    { label: "Membre",     color: "var(--muted)" },
};

const SENTENCE_HOURS = [1, 6, 24, 48, 72] as const;

export default function UserPopup({ userId, anchorEl, onClose, onViewProfile, spaceId, currentUserId }: Props) {
  const [info, setInfo] = useState<UserInfo | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const [hasSentence, setHasSentence] = useState(false);
  const [sentenceOpen, setSentenceOpen] = useState(false);
  const [sentenceHours, setSentenceHours] = useState<number>(24);
  const [sentencing, setSentencing] = useState(false);
  const [sentenceDone, setSentenceDone] = useState(false);
  const [sentenceError, setSentenceError] = useState<string | null>(null);

  useEffect(() => {
    if (!anchorEl || !popupRef.current) return;
    const rect = anchorEl.getBoundingClientRect();
    const popup = popupRef.current;
    const popupW = 260;
    const popupH = 200;
    const margin = 8;

    let left = rect.left;
    let top = rect.bottom + margin;

    if (left + popupW > window.innerWidth - margin) left = window.innerWidth - popupW - margin;
    if (top + popupH > window.innerHeight - margin) top = rect.top - popupH - margin;

    setPos({ top, left });
  }, [anchorEl]);

  useEffect(() => {
    fetchUser();
  }, [userId]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  const fetchUser = async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const queries: PromiseLike<any>[] = [
      supabase.from("profiles").select("pseudo, bio, created_at").eq("id", userId).single(),
      supabase.from("space_members").select("role").eq("user_id", userId).eq("space_id", spaceId).single(),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("space_id", spaceId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("space_id", spaceId),
    ];
    if (currentUserId && currentUserId !== userId) {
      queries.push(
        supabase.from("user_badges").select("used_at").eq("user_id", currentUserId).eq("badge_id", "sentence").maybeSingle()
      );
    }

    const results = await Promise.all(queries);
    const [{ data: profile }, { data: member }, { count: postsCount }, { count: messagesCount }] =
      results as [
        { data: { pseudo: string; bio: string | null; created_at: string } | null },
        { data: { role: string } | null },
        { count: number | null },
        { count: number | null },
      ];

    if (currentUserId && currentUserId !== userId && results[4]) {
      const sentBadge = (results[4] as { data: { used_at: string | null } | null }).data;
      setHasSentence(!!sentBadge && sentBadge.used_at === null);
    }

    setInfo({
      pseudo: profile?.pseudo ?? "Membre",
      bio: profile?.bio ?? null,
      role: member?.role ?? "member",
      joinedAt: profile?.created_at ?? "",
      posts: postsCount ?? 0,
      messages: messagesCount ?? 0,
    });
  };

  const handleSentence = async () => {
    if (sentencing || !currentUserId) return;
    setSentencing(true);
    setSentenceError(null);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) { setSentenceError("Session expirée"); setSentencing(false); return; }
    const res = await fetch("/api/rewards/sentence", {
      method: "POST",
      headers: { "Content-Type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ targetUserId: userId, spaceId, hours: sentenceHours }),
    });
    const json = await res.json();
    if (!res.ok) { setSentenceError(json.error ?? "Erreur"); setSentencing(false); return; }
    setSentenceDone(true);
    setHasSentence(false);
    setSentencing(false);
    setTimeout(() => onClose(), 2000);
  };

  const roleInfo = roleLabel[info?.role ?? "member"] ?? roleLabel.member;
  const joinedDate = info?.joinedAt
    ? new Date(info.joinedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "—";

  return (
    <div
      ref={popupRef}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        zIndex: 100,
        width: 260,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
        overflow: "hidden",
        animation: "fadeIn 0.15s ease",
      }}
    >
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:translateY(0); } }`}</style>

      {!info ? (
        <div style={{ padding: 20, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>…</div>
      ) : (
        <>
          {/* En-tête */}
          <div style={{
            padding: "16px 16px 12px",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: 12,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
              background: "rgba(124,111,247,0.12)",
              border: "1px solid rgba(124,111,247,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "var(--accent)", fontWeight: 600, userSelect: "none",
            }}>
              {info.pseudo[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", marginBottom: 4 }}>
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

          {/* Bio */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
            <p style={{
              margin: 0, fontSize: 12, lineHeight: 1.65,
              color: info.bio ? "var(--foreground)" : "var(--muted)",
              fontStyle: info.bio ? "normal" : "italic",
              fontFamily: info.bio ? "inherit" : "Georgia, serif",
            }}>
              {info.bio || "Aucune bio."}
            </p>
          </div>

          {/* Stats */}
          <div style={{ padding: "10px 16px", display: "flex", gap: 16 }}>
            <MiniStat label="Publications" value={info.posts} />
            <MiniStat label="Messages" value={info.messages} />
            <MiniStat label="Depuis" value={joinedDate} small />
          </div>

          {/* Voir profil */}
          {onViewProfile && (
            <div style={{ padding: "0 16px 0" }}>
              <button
                onClick={() => { onViewProfile(userId); onClose(); }}
                style={{
                  width: "100%", padding: "7px 0",
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 4, color: "var(--muted)", fontSize: 10,
                  letterSpacing: "0.1em", textTransform: "uppercase",
                  cursor: "pointer", transition: "color 0.15s, border-color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--foreground)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
              >
                Voir le profil
              </button>
            </div>
          )}

          {/* ── Badge Sentence ── */}
          {hasSentence && info?.role === "member" && (
            <div style={{
              margin: "10px 16px 14px",
              border: "1px solid rgba(212,175,55,0.35)",
              borderRadius: 6, overflow: "hidden",
            }}>
              {!sentenceDone ? (
                !sentenceOpen ? (
                  <button
                    onClick={() => setSentenceOpen(true)}
                    style={{
                      width: "100%", padding: "8px 0",
                      background: "rgba(212,175,55,0.06)",
                      border: "none", cursor: "pointer",
                      color: "#d4af37", fontSize: 10,
                      letterSpacing: "0.12em", textTransform: "uppercase",
                      fontWeight: 600, transition: "background 0.15s",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.12)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(212,175,55,0.06)")}
                  >
                    ⚖ Prononcer une sentence
                  </button>
                ) : (
                  <div style={{ padding: "12px 14px", background: "rgba(212,175,55,0.04)" }}>
                    <div style={{ fontSize: 9, color: "#d4af37", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10, fontWeight: 600 }}>
                      ⚖ Durée de l&apos;exile
                    </div>
                    <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
                      {SENTENCE_HOURS.map((h) => (
                        <button
                          key={h}
                          onClick={() => setSentenceHours(h)}
                          style={{
                            padding: "4px 10px",
                            background: sentenceHours === h ? "rgba(212,175,55,0.2)" : "transparent",
                            border: `1px solid ${sentenceHours === h ? "rgba(212,175,55,0.6)" : "var(--border)"}`,
                            borderRadius: 4, cursor: "pointer",
                            color: sentenceHours === h ? "#d4af37" : "var(--muted)",
                            fontSize: 10, fontWeight: sentenceHours === h ? 600 : 400,
                            transition: "all 0.1s",
                          }}
                        >
                          {h < 24 ? `${h}h` : `${h / 24}j`}
                        </button>
                      ))}
                    </div>
                    <p style={{ margin: "0 0 10px", fontSize: 9, color: "rgba(212,175,55,0.6)", lineHeight: 1.5 }}>
                      Usage unique — le badge sera consommé.
                    </p>
                    {sentenceError && (
                      <p style={{ margin: "0 0 8px", fontSize: 10, color: "#c94c4c" }}>{sentenceError}</p>
                    )}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={handleSentence}
                        disabled={sentencing}
                        style={{
                          flex: 1, padding: "7px 0",
                          background: sentencing ? "transparent" : "rgba(212,175,55,0.15)",
                          border: "1px solid rgba(212,175,55,0.5)",
                          borderRadius: 4, cursor: sentencing ? "not-allowed" : "pointer",
                          color: "#d4af37", fontSize: 10,
                          letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600,
                        }}
                      >
                        {sentencing ? "…" : "⚖ Confirmer"}
                      </button>
                      <button
                        onClick={() => { setSentenceOpen(false); setSentenceError(null); }}
                        style={{
                          padding: "7px 12px", background: "transparent",
                          border: "1px solid var(--border)", borderRadius: 4,
                          color: "var(--muted)", fontSize: 10, cursor: "pointer",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  </div>
                )
              ) : (
                <div style={{ padding: "10px 14px", textAlign: "center" }}>
                  <span style={{ fontSize: 11, color: "#4caf6e", letterSpacing: "0.06em" }}>
                    ✓ Sentence prononcée
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function MiniStat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: small ? 10 : 13, fontWeight: 600, color: "var(--foreground)" }}>{value}</span>
      <span style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}
