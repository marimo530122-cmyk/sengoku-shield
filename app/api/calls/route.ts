import { NextResponse } from "next/server";
import { listRecentCalls } from "@/lib/call-store";

export async function GET() {
  const calls = await listRecentCalls(30);
  return NextResponse.json({ calls });
}
