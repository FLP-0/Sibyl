import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const OWNER_EMAIL = process.env.OWNER_EMAIL!;

async function verifyOwner(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const { data } = await supabaseAdmin.auth.getUser(auth);
  if (data.user?.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) return null;
  return data.user;
}

// POST /api/superadmin/impersonate { userId }
// Génère un magic-link token pour se connecter en tant que cet utilisateur
export async function POST(req: Request) {
  if (!await verifyOwner(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }
  const supabaseAdmin = getSupabaseAdmin();
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId requis" }, { status: 400 });

  // Récupère l'email de l'utilisateur
  const { data: userResult, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError || !userResult.user?.email) {
    return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });
  }

  // Génère un magic link (OTP) pour cet email
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: userResult.user.email,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json({ error: linkError?.message ?? "Impossible de générer le lien" }, { status: 500 });
  }

  return NextResponse.json({ hashed_token: linkData.properties.hashed_token });
}
