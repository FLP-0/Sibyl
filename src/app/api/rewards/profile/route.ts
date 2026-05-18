import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LEVEL_THRESHOLDS = [0, 200, 700, 2000, 6000, 15000, 35000];
const LEVEL_NAMES = ["Murmure", "Éveillé", "Initié", "Adepte", "Éclairé", "Voyant", "Oracle"];
const XP_LABELS: Record<string, string> = {
  post_created:      "Publication",
  reply_created:     "Réponse",
  message_sent:      "Message",
  reaction_received: "Réaction reçue",
  daily_login:       "Connexion du jour",
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const url = new URL(req.url);
  const targetId = url.searchParams.get("userId") ?? user.id;
  const spaceId  = url.searchParams.get("spaceId");

  const [{ data: profile }, { data: allBadges }, { data: userBadges }, { data: logs }, { data: memberData }] =
    await Promise.all([
      supabaseAdmin.from("profiles").select("xp, level, pseudo").eq("id", targetId).single(),
      supabaseAdmin.from("badges").select("id, name, description, icon, category, hidden"),
      supabaseAdmin.from("user_badges").select("badge_id, unlocked_at, used_at").eq("user_id", targetId),
      supabaseAdmin
        .from("xp_logs").select("id, action, amount, created_at")
        .eq("user_id", targetId).order("created_at", { ascending: false }).limit(15),
      spaceId
        ? supabaseAdmin.from("space_members").select("role").eq("user_id", targetId).eq("space_id", spaceId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const xp    = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const levelName = LEVEL_NAMES[Math.min(level, LEVEL_NAMES.length - 1)];
  const xpCurrent = LEVEL_THRESHOLDS[Math.min(level, LEVEL_THRESHOLDS.length - 1)];
  const xpNext = level < LEVEL_THRESHOLDS.length - 1 ? LEVEL_THRESHOLDS[level + 1] : null;
  const xpProgress = xpNext
    ? Math.min(100, Math.round(((xp - xpCurrent) / (xpNext - xpCurrent)) * 100))
    : 100;

  type EarnedInfo = { unlocked_at: string; used_at: string | null };
  const earnedMap: Record<string, EarnedInfo> = {};
  (userBadges ?? []).forEach((b: { badge_id: string; unlocked_at: string; used_at: string | null }) => {
    earnedMap[b.badge_id] = { unlocked_at: b.unlocked_at, used_at: b.used_at };
  });

  // Badges de rôle — accordés et définis dynamiquement (pas besoin de SQL)
  const role = (memberData as { role?: string } | null)?.role;
  const roleTs = new Date().toISOString();

  const ROLE_BADGE_DEFS = [
    { id: "role_moderator", name: "Gardien",    description: "Pour ceux qui veillent sur l'espace",  icon: "⚔", category: "prestige", hidden: true },
    { id: "role_admin",     name: "Architecte", description: "Pour ceux qui gouvernent l'espace",    icon: "◆", category: "prestige", hidden: true },
  ];

  const existingIds = new Set((allBadges ?? []).map((b: { id: string }) => b.id));
  const injected = ROLE_BADGE_DEFS.filter((rb) => {
    if (existingIds.has(rb.id)) return false;
    if (rb.id === "role_moderator") return role === "moderator" || role === "admin";
    if (rb.id === "role_admin")     return role === "admin";
    return false;
  });
  const effectiveBadges = [...(allBadges ?? []), ...injected];

  if (role === "moderator" || role === "admin") {
    if (!earnedMap["role_moderator"]) earnedMap["role_moderator"] = { unlocked_at: roleTs, used_at: null };
  }
  if (role === "admin") {
    if (!earnedMap["role_admin"]) earnedMap["role_admin"] = { unlocked_at: roleTs, used_at: null };
  }

  const badges = effectiveBadges.map((b: {
    id: string; name: string; description: string; icon: string; category: string; hidden: boolean;
  }) => {
    const isEarned = !!earnedMap[b.id];
    if (b.hidden && !isEarned) {
      return {
        id: b.id, name: "???", description: "Badge secret — continue à explorer",
        icon: "?", category: b.category, hidden: true,
        earned: false, unlocked_at: null, used_at: null,
      };
    }
    return {
      ...b, earned: isEarned,
      unlocked_at: earnedMap[b.id]?.unlocked_at ?? null,
      used_at: earnedMap[b.id]?.used_at ?? null,
    };
  });

  const recentLogs = (logs ?? []).map((l: {
    id: string; action: string; amount: number; created_at: string;
  }) => ({
    ...l,
    label: XP_LABELS[l.action] ?? l.action,
  }));

  return NextResponse.json({
    xp, level, levelName, xpNext, xpCurrent, xpProgress,
    pseudo: profile?.pseudo ?? "",
    badges,
    recentLogs,
  });
}
