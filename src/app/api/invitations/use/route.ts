import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { inviteId, userId } = await req.json();
  if (!inviteId || !userId) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  await supabase
    .from("invitations")
    .update({ status: "used", used_by: userId })
    .eq("id", inviteId);

  return NextResponse.json({ ok: true });
}
