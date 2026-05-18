import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { code } = await req.json();

  if (!code) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const normalizedCode = code.trim().toUpperCase();

  // Vérifier si c'est un sésame d'espace
  const { data: spaceData } = await supabase
    .from("spaces")
    .select("id")
    .eq("code", normalizedCode)
    .single();

  if (spaceData) {
    return NextResponse.json({ valid: true, spaceId: spaceData.id });
  }

  // Vérifier si c'est un code d'invitation
  const { data: invite } = await supabase
    .from("invitations")
    .select("id, space_id, status, expires_at")
    .eq("code", normalizedCode)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!invite) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  return NextResponse.json({ valid: true, spaceId: invite.space_id, inviteId: invite.id });
}
