import { NextRequest, NextResponse } from "next/server";
import { getCall } from "@/lib/call-store";
import { buildEvidencePdf } from "@/lib/evidence-pdf";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ callSid: string }> }) {
  const { callSid } = await params;
  const record = await getCall(callSid);
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });

  const pdfBytes = await buildEvidencePdf(record);
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="sengoku-shield-${callSid}.pdf"`,
    },
  });
}
