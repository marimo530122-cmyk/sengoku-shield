import { NextRequest, NextResponse } from "next/server";
import { getCall } from "@/lib/call-store";
import { extractCallerCommitments, extractAiCommitmentWarnings } from "@/lib/commitment-extractor";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ callSid: string }> }) {
  const { callSid } = await params;
  const record = await getCall(callSid);
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    callerCommitments: extractCallerCommitments(record.turns),
    aiWarnings: extractAiCommitmentWarnings(record.turns),
  });
}
