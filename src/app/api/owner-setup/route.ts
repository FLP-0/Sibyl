import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const SPACE_ID = process.env.SIBYL_SPACE_ID!;
const OWNER_EMAIL = process.env.OWNER_EMAIL!;

// GET /api/owner-setup?email=... → vérifie que c'est le owner, retourne le spaceId
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const email = searchParams.get("email")?.toLowerCase().trim();

  if (!email || email !== OWNER_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  return NextResponse.json({ spaceId: SPACE_ID });
}

// POST /api/owner-setup { userId } → passe le rôle à admin
export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId manquant" }, { status: 400 });

  // Vérifie que l'email du compte correspond bien au owner
  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !userData?.user) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }
  if (userData.user.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  // Met à jour le rôle à admin
  const { error } = await supabaseAdmin
    .from("space_members")
    .update({ role: "admin" })
    .eq("user_id", userId)
    .eq("space_id", SPACE_ID);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
