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

// GET /api/spaces → liste tous les espaces avec stats
export async function GET(req: Request) {
  if (!await verifyOwner(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const supabaseAdmin = getSupabaseAdmin();
  const { data: spaces } = await supabaseAdmin.from("spaces").select("*").order("created_at", { ascending: false });

  if (!spaces) return NextResponse.json([]);

  const enriched = await Promise.all(spaces.map(async (s) => {
    const [{ count: members }, { count: posts }, { count: messages }] = await Promise.all([
      supabaseAdmin.from("space_members").select("*", { count: "exact", head: true }).eq("space_id", s.id),
      supabaseAdmin.from("posts").select("*", { count: "exact", head: true }).eq("space_id", s.id),
      supabaseAdmin.from("messages").select("*", { count: "exact", head: true }).eq("space_id", s.id),
    ]);
    return { ...s, members: members ?? 0, posts: posts ?? 0, messages: messages ?? 0 };
  }));

  return NextResponse.json(enriched);
}

// POST /api/spaces { name, description } → crée un espace
export async function POST(req: Request) {
  const supabaseAdmin = getSupabaseAdmin();
  const owner = await verifyOwner(req);
  if (!owner) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { name, description } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });

  // Génère un code à 6 chiffres unique
  let code = "";
  let tries = 0;
  while (tries < 10) {
    code = String(Math.floor(100000 + Math.random() * 900000));
    const { data } = await supabaseAdmin.from("spaces").select("id").eq("code", code).maybeSingle();
    if (!data) break;
    tries++;
  }

  const { data, error } = await supabaseAdmin.from("spaces").insert({
    name: name.trim(),
    description: description?.trim() || null,
    code,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Ajoute le fondateur comme admin du nouvel espace
  await supabaseAdmin.from("space_members").insert({
    space_id: data.id,
    user_id: owner.id,
    role: "admin",
  });

  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/spaces { spaceId, open_access?, allow_space_requests? } → met à jour les champs
export async function PATCH(req: Request) {
  if (!await verifyOwner(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const supabaseAdmin = getSupabaseAdmin();
  const { spaceId, ...rest } = await req.json();
  if (!spaceId) return NextResponse.json({ error: "spaceId requis" }, { status: 400 });

  const allowed = ["open_access", "allow_space_requests", "maintenance_mode", "maintenance_message"];
  const updates = Object.fromEntries(Object.entries(rest).filter(([k]) => allowed.includes(k)));

  const { error } = await supabaseAdmin.from("spaces").update(updates).eq("id", spaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

// DELETE /api/spaces { spaceId } → supprime un espace
export async function DELETE(req: Request) {
  if (!await verifyOwner(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  const supabaseAdmin = getSupabaseAdmin();
  const { spaceId } = await req.json();
  if (!spaceId) return NextResponse.json({ error: "spaceId requis" }, { status: 400 });

  const { error } = await supabaseAdmin.from("spaces").delete().eq("id", spaceId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
