import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const OWNER_EMAIL = process.env.OWNER_EMAIL!;

async function verifyOwner(req: Request) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return null;
  const { data } = await supabaseAdmin.auth.getUser(auth);
  if (data.user?.email?.toLowerCase() !== OWNER_EMAIL.toLowerCase()) return null;
  return data.user;
}

// GET /api/space-requests → liste les demandes en attente (owner uniquement)
// GET /api/space-requests?count=true → juste le nombre
export async function GET(req: Request) {
  if (!await verifyOwner(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const url = new URL(req.url);
  if (url.searchParams.has("count")) {
    const { count } = await supabaseAdmin
      .from("space_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    return NextResponse.json({ count: count ?? 0 });
  }

  const { data: requests } = await supabaseAdmin
    .from("space_requests")
    .select("*")
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (!requests || requests.length === 0) return NextResponse.json([]);

  const requesterIds = [...new Set(requests.map((r) => r.requester_id))];
  const spaceIds = [...new Set(requests.map((r) => r.space_id))];

  const [{ data: profiles }, { data: spaces }] = await Promise.all([
    supabaseAdmin.from("profiles").select("id, pseudo").in("id", requesterIds),
    supabaseAdmin.from("spaces").select("id, name").in("id", spaceIds),
  ]);

  const pseudoMap: Record<string, string> = {};
  (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });
  const spaceNameMap: Record<string, string> = {};
  (spaces ?? []).forEach((s) => { spaceNameMap[s.id] = s.name; });

  return NextResponse.json(
    requests.map((r) => ({
      ...r,
      requester_pseudo: pseudoMap[r.requester_id] ?? "—",
      source_space_name: spaceNameMap[r.space_id] ?? "—",
    }))
  );
}

// POST /api/space-requests { name, description, spaceId } → soumettre une demande
export async function POST(req: Request) {
  const auth = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!auth) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: { user } } = await supabaseAdmin.auth.getUser(auth);
  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { name, description, spaceId } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "Nom requis" }, { status: 400 });
  if (!spaceId) return NextResponse.json({ error: "spaceId requis" }, { status: 400 });

  const [{ data: space }, { data: member }] = await Promise.all([
    supabaseAdmin.from("spaces").select("allow_space_requests").eq("id", spaceId).single(),
    supabaseAdmin.from("space_members").select("role").eq("space_id", spaceId).eq("user_id", user.id).single(),
  ]);

  if (!member) return NextResponse.json({ error: "Vous n'êtes pas membre de cet espace" }, { status: 403 });

  const isEligible = space?.allow_space_requests || member.role === "admin";
  if (!isEligible) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  // Une seule demande en attente à la fois
  const { data: existing } = await supabaseAdmin
    .from("space_requests")
    .select("id")
    .eq("requester_id", user.id)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return NextResponse.json({ error: "Vous avez déjà une demande en attente" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("space_requests")
    .insert({ requester_id: user.id, space_id: spaceId, name: name.trim(), description: description?.trim() || null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

// PATCH /api/space-requests { id, action: 'approve'|'reject' } → traiter (owner uniquement)
export async function PATCH(req: Request) {
  if (!await verifyOwner(req)) return NextResponse.json({ error: "Non autorisé" }, { status: 403 });

  const { id, action } = await req.json();
  if (!id || !action) return NextResponse.json({ error: "id et action requis" }, { status: 400 });

  if (action === "approve") {
    const { data: spaceReq } = await supabaseAdmin
      .from("space_requests")
      .select("*")
      .eq("id", id)
      .single();

    if (!spaceReq) return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });

    // Générer un code unique à 6 chiffres
    let code = "";
    for (let tries = 0; tries < 10; tries++) {
      code = String(Math.floor(100000 + Math.random() * 900000));
      const { data } = await supabaseAdmin.from("spaces").select("id").eq("code", code).maybeSingle();
      if (!data) break;
    }

    const { data: newSpace, error: spaceError } = await supabaseAdmin
      .from("spaces")
      .insert({ name: spaceReq.name, description: spaceReq.description, code })
      .select()
      .single();

    if (spaceError) return NextResponse.json({ error: spaceError.message }, { status: 500 });

    await Promise.all([
      supabaseAdmin.from("space_members").insert({
        space_id: newSpace.id,
        user_id: spaceReq.requester_id,
        role: "admin",
      }),
      supabaseAdmin.from("space_requests").update({ status: "approved" }).eq("id", id),
    ]);
  } else if (action === "reject") {
    await supabaseAdmin.from("space_requests").update({ status: "rejected" }).eq("id", id);
  } else {
    return NextResponse.json({ error: "Action invalide" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
