import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OWNER_EMAIL = process.env.OWNER_EMAIL!;
const DEFAULT_SPACE_ID = process.env.DEFAULT_SPACE_ID ?? "831eda8b-5972-4250-8ac4-bb536ee0d0f5";

async function verifyOwner(req: Request) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const { data } = await supabaseAdmin.auth.getUser(auth);
  if (data.user?.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) return null;
  return data.user;
}

function generatePassword(length = 16): string {
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$";
  let pwd = "";
  for (let i = 0; i < length; i++) {
    pwd += chars[Math.floor(Math.random() * chars.length)];
  }
  return pwd;
}

// POST /api/superadmin/test-accounts { pseudo, role, spaceId? }
// Crée ou réinitialise le compte de test pour ce rôle
export async function POST(req: Request) {
  if (!await verifyOwner(req)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const { pseudo, role, spaceId } = await req.json();
  if (!pseudo?.trim()) return NextResponse.json({ error: "pseudo requis" }, { status: 400 });
  const validRoles = ["member", "moderator", "admin"];
  if (!validRoles.includes(role)) return NextResponse.json({ error: "role invalide" }, { status: 400 });

  const targetSpaceId = spaceId ?? DEFAULT_SPACE_ID;
  const email = `test-${role}@sibyl.internal`;
  const password = generatePassword();

  // Chercher si un compte existe déjà avec cet email
  const { data: existingList } = await supabaseAdmin.auth.admin.listUsers();
  const existing = existingList?.users?.find((u) => u.email === email);

  let userId: string;

  if (existing) {
    // Met à jour le pseudo + reset le mot de passe
    await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password,
      user_metadata: { pseudo: pseudo.trim() },
    });
    await supabaseAdmin.from("profiles").upsert({ id: existing.id, pseudo: pseudo.trim() });
    userId = existing.id;
  } else {
    // Crée le compte
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { pseudo: pseudo.trim() },
    });
    if (error || !created.user) {
      return NextResponse.json({ error: error?.message ?? "Erreur création" }, { status: 500 });
    }
    userId = created.user.id;
    await supabaseAdmin.from("profiles").upsert({ id: userId, pseudo: pseudo.trim() });
  }

  // Ajouter/mettre à jour dans l'espace
  await supabaseAdmin.from("space_members").upsert(
    { space_id: targetSpaceId, user_id: userId, role },
    { onConflict: "space_id,user_id" }
  );

  return NextResponse.json({ email, password, userId, pseudo: pseudo.trim(), role }, { status: 200 });
}
