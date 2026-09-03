import { NextRequest, NextResponse } from "next/server";
import { addToWhitelist, removeFromWhitelist, listWhitelist } from "@/lib/whitelist";

export async function GET() {
  const numbers = await listWhitelist();
  return NextResponse.json({ numbers });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const number = typeof body.number === "string" ? body.number.trim() : "";
  if (!number) return NextResponse.json({ error: "number is required" }, { status: 400 });
  await addToWhitelist(number);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const number = typeof body.number === "string" ? body.number.trim() : "";
  if (!number) return NextResponse.json({ error: "number is required" }, { status: 400 });
  await removeFromWhitelist(number);
  return NextResponse.json({ ok: true });
}
