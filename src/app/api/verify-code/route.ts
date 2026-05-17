import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SPACE_ID = "831eda8b-5972-4250-8ac4-bb536ee0d0f5";

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

  // Vérifier le sésame de l'espace
  const { data: spaceData } = await supabase
    .from("spaces")
    .select("code")
    .eq("id", SPACE_ID)
    .single();

  if (spaceData && normalizedCode === spaceData.code?.trim().toUpperCase()) {
    return NextResponse.json({ valid: true, spaceId: SPACE_ID });
  }

  // Vérifier les codes d'invitation
  const { data: invite } = await supabase
    .from("invitations")
    .select("id, status, expires_at")
    .eq("code", normalizedCode)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .single();

  if (!invite) {
    return NextResponse.json({ valid: false }, { status: 400 });
  }

  return NextResponse.json({ valid: true, spaceId: SPACE_ID, inviteId: invite.id });
}
