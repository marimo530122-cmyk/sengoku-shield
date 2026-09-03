import { NextRequest, NextResponse } from "next/server";
import { addToBlacklist, removeFromBlacklist, listBlacklist } from "@/lib/blacklist";

export async function GET() {
  const numbers = await listBlacklist();
  return NextResponse.json({ numbers });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const number = typeof body.number === "string" ? body.number.trim() : "";
  if (!number) return NextResponse.json({ error: "number is required" }, { status: 400 });
  await addToBlacklist(number);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const number = typeof body.number === "string" ? body.number.trim() : "";
  if (!number) return NextResponse.json({ error: "number is required" }, { status: 400 });
  await removeFromBlacklist(number);
  return NextResponse.json({ ok: true });
}
