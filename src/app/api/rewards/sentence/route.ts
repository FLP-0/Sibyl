import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const ALLOWED_HOURS = [1, 6, 24, 48, 72];

export async function POST(req: NextRequest) {
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
  const { targetUserId, spaceId, hours } = body as {
    targetUserId: string;
    spaceId: string;
    hours: number;
  };

  // Validations de base
  if (!targetUserId || !spaceId || !ALLOWED_HOURS.includes(hours)) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }
  if (targetUserId === user.id) {
    return NextResponse.json({ error: "Impossible de se bannir soi-même" }, { status: 400 });
  }

  // Vérifier que le caller possède le badge Sentence non utilisé
  const { data: badge } = await supabaseAdmin
    .from("user_badges")
    .select("used_at")
    .eq("user_id", user.id)
    .eq("badge_id", "sentence")
    .maybeSingle();

  if (!badge) {
    return NextResponse.json({ error: "Badge Sentence non obtenu" }, { status: 403 });
  }
  if (badge.used_at) {
    return NextResponse.json({ error: "Badge Sentence déjà utilisé" }, { status: 403 });
  }

  // Vérifier que la cible n'est pas superadmin
  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("pseudo, is_superadmin")
    .eq("id", targetUserId)
    .single();

  if (!targetProfile) {
    return NextResponse.json({ error: "Membre introuvable" }, { status: 404 });
  }
  if (targetProfile.is_superadmin) {
    return NextResponse.json({ error: "Impossible de bannir le Fondateur" }, { status: 403 });
  }

  // Vérifier que la cible est bien un simple membre (pas admin/modo)
  const { data: targetMember } = await supabaseAdmin
    .from("space_members")
    .select("role")
    .eq("user_id", targetUserId)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (!targetMember) {
    return NextResponse.json({ error: "Ce membre n'est pas dans l'espace" }, { status: 400 });
  }
  if (targetMember.role !== "member") {
    return NextResponse.json({ error: "La Sentence ne peut viser qu'un simple membre" }, { status: 403 });
  }

  // Vérifier qu'il n'est pas déjà banni
  const { data: existingBan } = await supabaseAdmin
    .from("bans")
    .select("banned_until")
    .eq("user_id", targetUserId)
    .eq("space_id", spaceId)
    .maybeSingle();

  if (existingBan) {
    const isActive = !existingBan.banned_until || new Date(existingBan.banned_until) > new Date();
    if (isActive) {
      return NextResponse.json({ error: "Ce membre est déjà banni" }, { status: 400 });
    }
  }

  // Prononcer la sentence
  const bannedUntil = new Date(Date.now() + hours * 3600000).toISOString();

  const { error: banError } = await supabaseAdmin.from("bans").upsert({
    user_id: targetUserId,
    space_id: spaceId,
    banned_by: user.id,
    banned_until: bannedUntil,
  }, { onConflict: "user_id,space_id" });

  if (banError) {
    return NextResponse.json({ error: "Erreur lors du bannissement" }, { status: 500 });
  }

  // Consommer le badge
  await supabaseAdmin
    .from("user_badges")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("badge_id", "sentence");

  return NextResponse.json({
    ok: true,
    pseudo: targetProfile.pseudo,
    bannedUntil,
  });
}
