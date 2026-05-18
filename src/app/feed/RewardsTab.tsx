"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Badge = {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  hidden: boolean;
  earned: boolean;
  unlocked_at: string | null;
  used_at: string | null;
};

type XpLog = {
  id: string;
  action: string;
  amount: number;
  label: string;
  created_at: string;
};

type RewardsProfile = {
  xp: number;
  level: number;
  levelName: string;
  xpNext: number | null;
  xpCurrent: number;
  xpProgress: number;
  pseudo: string;
  badges: Badge[];
  recentLogs: XpLog[];
};

const LEVEL_ICONS  = ["◦", "◉", "◈", "⬡", "◆", "❖", "⟁"];
const LEVEL_COLORS = [
  "var(--muted)", "#6b9bd2", "var(--accent)", "#4caf9e", "#c9884c", "#d4af37", "#e8b86d",
];

const CATEGORY_LABELS: Record<string, string> = {
  publication: "Publication",
  interaction: "Interaction",
  prestige:    "Prestige",
  progression: "Progression",
};
const CATEGORY_COLORS: Record<string, string> = {
  publication: "var(--accent)",
  interaction: "#c9884c",
  prestige:    "#d4af37",
  progression: "#4caf9e",
};
const CATEGORY_ORDER = ["publication", "interaction", "prestige", "progression"];

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)    return "à l'instant";
  if (diff < 3600)  return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
}

function shortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

/* ──────────────────────────────────────────────────────────
   STICKER SLOT  (vue Collection)
────────────────────────────────────────────────────────── */
function StickerSlot({ badge, color, index }: { badge: Badge; color: string; index: number }) {
  const unlockDate = badge.unlocked_at
    ? new Date(badge.unlocked_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })
    : null;

  if (badge.earned) {
    return (
      <div style={{
        background: `linear-gradient(145deg, ${color}1a 0%, ${color}08 100%)`,
        border: `1px solid ${color}55`,
        borderRadius: 14,
        padding: "18px 10px 14px",
        textAlign: "center",
        position: "relative",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        boxShadow: `0 2px 20px ${color}14`,
        animation: `stickerIn 0.3s ease ${index * 0.04}s both`,
        cursor: "default",
      }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "translateY(-4px) scale(1.04)";
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 28px ${color}28`;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.transform = "";
          (e.currentTarget as HTMLDivElement).style.boxShadow = `0 2px 20px ${color}14`;
        }}
      >
        {/* Dot */}
        <div style={{
          position: "absolute", top: 8, right: 8,
          width: 5, height: 5, borderRadius: "50%",
          background: color, boxShadow: `0 0 6px ${color}`,
        }} />

        {/* Emoji */}
        <div style={{
          fontSize: 36, lineHeight: 1, marginBottom: 10,
          filter: "drop-shadow(0 3px 10px rgba(0,0,0,0.5))",
        }}>
          {badge.icon}
        </div>

        {/* Nom */}
        <div style={{
          fontSize: 11, fontWeight: 700, color: "var(--foreground)",
          fontFamily: "Georgia, serif", lineHeight: 1.3, marginBottom: unlockDate ? 8 : 0,
        }}>
          {badge.name}
        </div>

        {/* Date */}
        {unlockDate && (
          <div style={{ fontSize: 8, color, letterSpacing: "0.08em", fontWeight: 600, textTransform: "uppercase" }}>
            ✓ {unlockDate}
          </div>
        )}
      </div>
    );
  }

  /* — Slot vide / verrouillé — */
  return (
    <div style={{
      background: "rgba(255,255,255,0.015)",
      border: "1px dashed rgba(255,255,255,0.07)",
      borderRadius: 14,
      padding: "18px 10px 14px",
      textAlign: "center",
      cursor: "default",
      animation: `stickerIn 0.3s ease ${index * 0.04}s both`,
    }}>
      {/* Point d'interrogation */}
      <div style={{
        width: 44, height: 44,
        borderRadius: "50%",
        border: "1.5px dashed rgba(255,255,255,0.1)",
        display: "flex", alignItems: "center", justifyContent: "center",
        margin: "0 auto 10px",
        color: "rgba(255,255,255,0.15)",
        fontSize: 20, fontFamily: "Georgia, serif", fontWeight: 700,
        lineHeight: 1,
      }}>
        ?
      </div>

      {/* Nom */}
      <div style={{
        fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.25)",
        fontFamily: "Georgia, serif", lineHeight: 1.3, marginBottom: 6,
      }}>
        {badge.name}
      </div>

      {/* Condition */}
      <div style={{ fontSize: 9, color: "rgba(255,255,255,0.18)", lineHeight: 1.5 }}>
        {badge.description}
      </div>
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   VUE COLLECTION
────────────────────────────────────────────────────────── */
function CollectionView({ badges, onBack }: { badges: Badge[]; onBack: () => void }) {
  // Badges non-cachés (toujours visibles) + badges cachés mais gagnés (révélés après déblocage)
  const visibleBadges = badges.filter((b) => !b.hidden || b.earned);
  const earned = visibleBadges.filter((b) => b.earned).length;
  const total  = visibleBadges.length;

  const byCategory = CATEGORY_ORDER.map((cat) => ({
    cat,
    badges: visibleBadges.filter((b) => b.category === cat),
  })).filter((g) => g.badges.length > 0);

  let globalIndex = 0;

  return (
    <div style={{ height: "100%", overflowY: "auto", padding: "28px 24px 48px" }}>
      <style>{`
        @keyframes stickerIn {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      {/* En-tête */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
        <button
          onClick={onBack}
          style={{
            background: "transparent", border: "1px solid var(--border)",
            borderRadius: 6, color: "var(--muted)", cursor: "pointer",
            padding: "5px 10px", fontSize: 11, letterSpacing: "0.06em",
            display: "flex", alignItems: "center", gap: 5,
            transition: "color 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--foreground)"; e.currentTarget.style.borderColor = "var(--foreground)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--muted)"; e.currentTarget.style.borderColor = "var(--border)"; }}
        >
          ← Retour
        </button>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.18em", textTransform: "uppercase", marginBottom: 3 }}>
            Codex des Artefacts
          </div>
          <div style={{ fontSize: 17, fontFamily: "Georgia, serif", color: "var(--foreground)", letterSpacing: "0.04em" }}>
            Collection
          </div>
        </div>

        <div style={{ textAlign: "right" }}>
          <div style={{
            fontSize: 22, fontWeight: 700, fontFamily: "Georgia, serif",
            color: earned === total ? "#d4af37" : "var(--foreground)", lineHeight: 1,
          }}>
            {earned}<span style={{ fontSize: 14, color: "var(--muted)", fontWeight: 400 }}>/{total}</span>
          </div>
          <div style={{ height: 3, width: 80, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 6, overflow: "hidden" }}>
            <div style={{
              height: "100%", borderRadius: 2,
              width: `${total > 0 ? Math.round((earned / total) * 100) : 0}%`,
              background: earned === total
                ? "linear-gradient(90deg, #d4af37, #e8d08a)"
                : "linear-gradient(90deg, var(--accent), #9d8ff7)",
              transition: "width 0.6s ease",
            }} />
          </div>
          {earned === total && (
            <div style={{ fontSize: 8, color: "#d4af37", letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 4 }}>
              ✦ Complète
            </div>
          )}
        </div>
      </div>

      {/* Grilles par catégorie */}
      {byCategory.map(({ cat, badges: catBadges }) => {
        const color = CATEGORY_COLORS[cat] ?? "var(--accent)";
        const earnedInCat = catBadges.filter((b) => b.earned).length;
        return (
          <div key={cat} style={{ marginBottom: 32 }}>
            {/* Header catégorie */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <div style={{ width: 12, height: 1, background: color, opacity: 0.6 }} />
              <span style={{ fontSize: 9, color, letterSpacing: "0.18em", textTransform: "uppercase", fontWeight: 700 }}>
                {CATEGORY_LABELS[cat]}
              </span>
              <span style={{ fontSize: 9, color: "var(--muted)" }}>{earnedInCat}/{catBadges.length}</span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))",
              gap: 10,
            }}>
              {catBadges.map((badge) => {
                const i = globalIndex++;
                return <StickerSlot key={badge.id} badge={badge} color={color} index={i} />;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────
   VUE GLOIRE (principale)
────────────────────────────────────────────────────────── */
export default function RewardsTab({ userId, spaceId }: { userId: string; spaceId: string }) {
  const [profile, setProfile] = useState<RewardsProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCollection, setShowCollection] = useState(false);

  const fetchProfile = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    const res = await fetch(`/api/rewards/profile?spaceId=${encodeURIComponent(spaceId)}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (res.ok) setProfile(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    if (userId === "dev-user") { setLoading(false); return; }
    fetchProfile();

    // Rafraîchit quand un badge est débloqué
    const badgeChannel = supabase
      .channel("rewards-badges-" + userId)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "user_badges",
        filter: `user_id=eq.${userId}`,
      }, () => fetchProfile())
      .subscribe();

    // Rafraîchit quand l'XP/level change
    const profileChannel = supabase
      .channel("rewards-profile-" + userId)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${userId}`,
      }, () => fetchProfile())
      .subscribe();

    return () => {
      supabase.removeChannel(badgeChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [userId]);

  if (loading) return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
        Consultation des archives…
      </p>
    </div>
  );
  if (!profile) return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "var(--muted)", fontSize: 12, fontStyle: "italic", fontFamily: "Georgia, serif" }}>
        Impossible de charger le profil.
      </p>
    </div>
  );

  /* Vue Collection */
  if (showCollection) {
    return <CollectionView badges={profile.badges} onBack={() => setShowCollection(false)} />;
  }

  const { xp, level, levelName, xpNext, xpCurrent, xpProgress, badges, recentLogs } = profile;
  const levelColor = LEVEL_COLORS[Math.min(level, LEVEL_COLORS.length - 1)];
  const levelIcon  = LEVEL_ICONS[Math.min(level, LEVEL_ICONS.length - 1)];

  const visibleBadges = badges.filter((b) => !b.hidden);
  const earnedVisible = visibleBadges.filter((b) => b.earned).length;

  return (
    <div style={{ height: "100%", overflowY: "auto" }}>
      <div style={{ maxWidth: 600, margin: "0 auto", padding: "32px 20px 60px" }}>

        {/* ─── En-tête niveau ─── */}
        <div style={{
          background: "linear-gradient(135deg, rgba(124,111,247,0.06) 0%, transparent 60%)",
          border: `1px solid ${levelColor}40`,
          borderRadius: 16, padding: "28px 32px", marginBottom: 20,
          position: "relative", overflow: "hidden",
        }}>
          <div style={{
            position: "absolute", top: -40, right: -40, width: 160, height: 160,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${levelColor}12 0%, transparent 70%)`,
            pointerEvents: "none",
          }} />
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 32, color: levelColor, lineHeight: 1 }}>{levelIcon}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "Georgia, serif", color: levelColor, letterSpacing: "0.04em" }}>
                  {levelName}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  Niveau {level}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 24, fontWeight: 700, color: "var(--foreground)", fontFamily: "Georgia, serif" }}>
                {xp.toLocaleString("fr-FR")}
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                Points XP
              </div>
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>{xpCurrent.toLocaleString("fr-FR")} XP</span>
              <span style={{ fontSize: 10, color: "var(--muted)" }}>
                {xpNext ? `${xpNext.toLocaleString("fr-FR")} XP — Niveau ${level + 1}` : "Niveau maximum atteint"}
              </span>
            </div>
            <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
              <div style={{
                height: "100%", width: `${xpProgress}%`,
                background: `linear-gradient(90deg, ${levelColor}80, ${levelColor})`,
                borderRadius: 3, transition: "width 0.8s cubic-bezier(0.22,1,0.36,1)",
              }} />
            </div>
            <div style={{ textAlign: "right", marginTop: 6 }}>
              <span style={{ fontSize: 10, color: levelColor, fontWeight: 600 }}>{xpProgress}%</span>
            </div>
          </div>
        </div>

        {/* ─── Stats ─── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 28 }}>
          {[
            { label: "XP total",        value: xp.toLocaleString("fr-FR"),                    color: levelColor },
            { label: "Badges visibles", value: `${earnedVisible} / ${visibleBadges.length}`,  color: "#d4af37" },
            { label: "Niveau",          value: level.toString(),                               color: "#4caf9e" },
          ].map((stat) => (
            <div key={stat.label} className="glass-card" style={{ padding: "14px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: stat.color, fontFamily: "Georgia, serif", lineHeight: 1.2 }}>
                {stat.value}
              </div>
              <div style={{ fontSize: 8, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* ─── Bouton Collection ─── */}
        <button
          onClick={() => setShowCollection(true)}
          style={{
            width: "100%", padding: "11px 0", marginBottom: 28,
            background: "rgba(255,255,255,0.02)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 10, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
            transition: "background 0.15s, border-color 0.15s",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"; }}
        >
          <span style={{ fontSize: 11, color: "var(--muted)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Classeur de collection
          </span>
          <span style={{ fontSize: 11, color: "var(--muted)" }}>
            {earnedVisible}/{visibleBadges.length}
          </span>
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.2)" }}>→</span>
        </button>

        {/* ─── Journal XP ─── */}
        {recentLogs.length > 0 && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              <span style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.16em", textTransform: "uppercase" }}>
                Dernières activités
              </span>
              <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recentLogs.map((log) => (
                <div key={log.id} style={{
                  display: "flex", alignItems: "center",
                  padding: "8px 14px",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--border)", borderRadius: 7,
                }}>
                  <span style={{
                    fontSize: 12, fontWeight: 700, color: "var(--accent)",
                    fontFamily: "Georgia, serif", minWidth: 44, flexShrink: 0,
                  }}>
                    +{log.amount}
                  </span>
                  <span style={{ flex: 1, fontSize: 11, color: "var(--foreground)" }}>{log.label}</span>
                  <span style={{ fontSize: 10, color: "var(--muted)", flexShrink: 0 }}>{timeAgo(log.created_at)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentLogs.length === 0 && (
          <p style={{
            textAlign: "center", color: "var(--muted)", fontSize: 12,
            fontStyle: "italic", fontFamily: "Georgia, serif", marginTop: 40, letterSpacing: "0.04em",
          }}>
            Aucune activité enregistrée pour l&apos;instant.
          </p>
        )}

      </div>
    </div>
  );
}
