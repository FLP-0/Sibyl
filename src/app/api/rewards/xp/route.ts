import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const XP_AMOUNTS: Record<string, number> = {
  post_created:      15,
  reply_created:      8,
  message_sent:       3,
  reaction_received:  5,
  daily_login:       10,
};

// Progression de plus en plus difficile : ~4j → 2sem → 6sem → 6mois → 1an → très long terme
const LEVEL_THRESHOLDS = [0, 200, 700, 2000, 6000, 15000, 35000];

function computeLevel(xp: number): number {
  let level = 0;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i;
  }
  return level;
}

export async function POST(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const { action, spaceId, targetUserId, postId, contentLength } = body as {
    action: string;
    spaceId?: string;
    targetUserId?: string;
    postId?: string;
    contentLength?: number;
  };

  if (!action || !XP_AMOUNTS[action]) {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }

  const recipientId: string = action === "reaction_received"
    ? (targetUserId ?? user.id)
    : user.id;

  // ── daily_login : une fois par jour + check fantôme ──
  let fantomeEligible = false;
  if (action === "daily_login") {
    const { data: prof } = await supabaseAdmin
      .from("profiles").select("last_xp_login").eq("id", recipientId).single();
    const today = new Date().toISOString().split("T")[0];
    if (prof?.last_xp_login === today) return NextResponse.json({ skipped: true });

    if (prof?.last_xp_login) {
      const gapDays = Math.floor((Date.now() - new Date(prof.last_xp_login).getTime()) / 86400000);
      if (gapDays >= 14) fantomeEligible = true;
    }
    await supabaseAdmin.from("profiles").update({ last_xp_login: today }).eq("id", recipientId);
  }

  const amount = XP_AMOUNTS[action];

  const { data: profile } = await supabaseAdmin
    .from("profiles").select("xp, level").eq("id", recipientId).single();

  const currentXp    = profile?.xp ?? 0;
  const currentLevel = profile?.level ?? 0;
  const newXp        = currentXp + amount;
  const newLevel     = computeLevel(newXp);

  await supabaseAdmin.from("profiles").update({ xp: newXp, level: newLevel }).eq("id", recipientId);
  await supabaseAdmin.from("xp_logs").insert({
    user_id: recipientId, action, amount, space_id: spaceId ?? null,
  });

  // Badges existants
  const { data: existingBadges } = await supabaseAdmin
    .from("user_badges").select("badge_id").eq("user_id", recipientId);
  const earned = new Set((existingBadges ?? []).map((b: { badge_id: string }) => b.badge_id));
  const newBadges: string[] = [];

  // ── Badges de niveau ──
  if (newLevel >= 1 && !earned.has("eveille")) newBadges.push("eveille");
  if (newLevel >= 3 && !earned.has("adepte"))  newBadges.push("adepte");
  if (newLevel >= 6 && !earned.has("oracle"))  newBadges.push("oracle");

  // ── Badges de publication ──
  if (action === "post_created") {
    const { count } = await supabaseAdmin
      .from("posts").select("id", { count: "exact", head: true }).eq("author_id", recipientId);
    if ((count ?? 0) >= 1  && !earned.has("premier_souffle")) newBadges.push("premier_souffle");
    if ((count ?? 0) >= 10 && !earned.has("echo"))            newBadges.push("echo");
    if ((count ?? 0) >= 50 && !earned.has("orateur"))         newBadges.push("orateur");
  }

  // ── Badges de message ──
  if (action === "message_sent") {
    const { count } = await supabaseAdmin
      .from("messages").select("id", { count: "exact", head: true }).eq("author_id", recipientId);
    if ((count ?? 0) >= 1   && !earned.has("premier_mot")) newBadges.push("premier_mot");
    if ((count ?? 0) >= 100 && !earned.has("bavard"))      newBadges.push("bavard");
  }

  // ── Badges de réponse ──
  if (action === "reply_created") {
    const { count } = await supabaseAdmin
      .from("replies").select("id", { count: "exact", head: true }).eq("author_id", recipientId);
    if ((count ?? 0) >= 10 && !earned.has("repondant"))   newBadges.push("repondant");
    if ((count ?? 0) >= 50 && !earned.has("dialoguiste")) newBadges.push("dialoguiste");
  }

  // ── Badges de réactions reçues ──
  if (action === "reaction_received") {
    const { data: userPosts } = await supabaseAdmin
      .from("posts").select("id").eq("author_id", recipientId);
    const postIds = (userPosts ?? []).map((p: { id: string }) => p.id);
    if (postIds.length > 0) {
      const { count: totalReactions } = await supabaseAdmin
        .from("reactions").select("id", { count: "exact", head: true }).in("post_id", postIds);
      if ((totalReactions ?? 0) >= 25  && !earned.has("resonance"))  newBadges.push("resonance");
      if ((totalReactions ?? 0) >= 100 && !earned.has("magnetisme")) newBadges.push("magnetisme");
    }
    // inspirateur : ce post précis a 10+ réactions
    if (postId) {
      const { count: postReactions } = await supabaseAdmin
        .from("reactions").select("id", { count: "exact", head: true }).eq("post_id", postId);
      if ((postReactions ?? 0) >= 100 && !earned.has("inspirateur")) newBadges.push("inspirateur");
    }
  }

  // ── Badges cachés ──

  // nuit_blanche : action entre 00:00 et 04:00 UTC
  if (["post_created", "reply_created", "message_sent"].includes(action)) {
    if (new Date().getUTCHours() < 4 && !earned.has("nuit_blanche")) {
      newBadges.push("nuit_blanche");
    }
  }

  // marathon : 5+ actions dans la journée (le log vient d'être inséré)
  if (["post_created", "reply_created", "message_sent"].includes(action)) {
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const { count: todayCount } = await supabaseAdmin
      .from("xp_logs").select("id", { count: "exact", head: true })
      .eq("user_id", recipientId).gte("created_at", dayStart.toISOString());
    if ((todayCount ?? 0) >= 5 && !earned.has("marathon")) newBadges.push("marathon");
  }

  // verbe_rare : contenu > 300 caractères
  if (["post_created", "reply_created"].includes(action) && (contentLength ?? 0) > 300) {
    if (!earned.has("verbe_rare")) newBadges.push("verbe_rare");
  }

  // fantome : retour après 14+ jours d'absence
  if (fantomeEligible && !earned.has("fantome")) newBadges.push("fantome");

  // Insérer les badges du destinataire principal
  if (newBadges.length > 0) {
    await supabaseAdmin.from("user_badges").insert(
      newBadges.map((badge_id) => ({ user_id: recipientId, badge_id }))
    );
  }

  // ── Sentence : se débloque en obtenant les 6 autres badges cachés ──
  const HIDDEN_PREREQUISITES = ["nuit_blanche", "marathon", "inspirateur", "echo_parfait", "verbe_rare", "fantome"];
  const updatedEarned = new Set([...earned, ...newBadges]);
  if (!updatedEarned.has("sentence") && HIDDEN_PREREQUISITES.every((b) => updatedEarned.has(b))) {
    await supabaseAdmin.from("user_badges").insert({ user_id: recipientId, badge_id: "sentence" });
    newBadges.push("sentence");
  }

  // ── echo_parfait : badge pour l'auteur du post quand il atteint 5 réponses ──
  if (action === "reply_created" && postId) {
    const { data: postData } = await supabaseAdmin
      .from("posts").select("author_id").eq("id", postId).single();
    if (postData && postData.author_id !== recipientId) {
      const { count: replyCount } = await supabaseAdmin
        .from("replies").select("id", { count: "exact", head: true }).eq("post_id", postId);
      if ((replyCount ?? 0) >= 5) {
        const { data: authorBadges } = await supabaseAdmin
          .from("user_badges").select("badge_id").eq("user_id", postData.author_id);
        const authorEarned = new Set((authorBadges ?? []).map((b: { badge_id: string }) => b.badge_id));
        if (!authorEarned.has("echo_parfait")) {
          await supabaseAdmin.from("user_badges").insert({
            user_id: postData.author_id, badge_id: "echo_parfait",
          });
          // Vérifier si l'auteur débloque aussi Sentence
          const authorUpdated = new Set([...authorEarned, "echo_parfait"]);
          if (!authorUpdated.has("sentence") && HIDDEN_PREREQUISITES.every((b) => authorUpdated.has(b))) {
            await supabaseAdmin.from("user_badges").insert({ user_id: postData.author_id, badge_id: "sentence" });
          }
        }
      }
    }
  }

  return NextResponse.json({
    amount, xp: newXp, level: newLevel,
    leveledUp: newLevel > currentLevel,
    newBadges,
    skipped: false,
  });
}
