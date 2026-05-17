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
};

const roleLabel: Record<string, { label: string; color: string }> = {
  admin:     { label: "Admin",      color: "#c9884c" },
  moderator: { label: "Modérateur", color: "var(--accent)" },
  member:    { label: "Membre",     color: "var(--muted)" },
};

export default function UserPopup({ userId, anchorEl, onClose, onViewProfile, spaceId }: Props) {
  const [info, setInfo] = useState<UserInfo | null>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

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
    const [{ data: profile }, { data: member }, { count: postsCount }, { count: messagesCount }] = await Promise.all([
      supabase.from("profiles").select("pseudo, bio, created_at").eq("id", userId).single(),
      supabase.from("space_members").select("role").eq("user_id", userId).eq("space_id", spaceId).single(),
      supabase.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("space_id", spaceId),
      supabase.from("messages").select("id", { count: "exact", head: true }).eq("author_id", userId).eq("space_id", spaceId),
    ]);

    setInfo({
      pseudo: profile?.pseudo ?? "Membre",
      bio: profile?.bio ?? null,
      role: member?.role ?? "member",
      joinedAt: profile?.created_at ?? "",
      posts: postsCount ?? 0,
      messages: messagesCount ?? 0,
    });
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
            <div style={{ padding: "0 16px 14px" }}>
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
