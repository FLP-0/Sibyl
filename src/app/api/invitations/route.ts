import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function makeCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function GET() {
  const supabase = getClient();

  const { data: invitations, error } = await supabase
    .from("invitations")
    .select("id, code, status, expires_at, created_at, invited_by, used_by")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const userIds = [...new Set([
    ...(invitations ?? []).map((i) => i.invited_by).filter(Boolean),
    ...(invitations ?? []).map((i) => i.used_by).filter(Boolean),
  ])];

  let pseudoMap: Record<string, string> = {};
  if (userIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, pseudo").in("id", userIds);
    (profiles ?? []).forEach((p) => { pseudoMap[p.id] = p.pseudo; });
  }

  const enriched = (invitations ?? []).map((inv) => ({
    ...inv,
    invited_by_pseudo: pseudoMap[inv.invited_by] ?? "—",
    used_by_pseudo: inv.used_by ? (pseudoMap[inv.used_by] ?? "—") : null,
  }));

  return NextResponse.json({ invitations: enriched });
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  const { userId } = await req.json();

  const supabase = getClient();
  const code = makeCode();
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  const invitedBy = userId && UUID_RE.test(userId) ? userId : null;

  const { data, error } = await supabase
    .from("invitations")
    .insert({ code, invited_by: invitedBy, expires_at: expiresAt.toISOString(), status: "pending" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ invitation: data });
}
