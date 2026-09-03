/* =========================================================
   Module 1: ライブ監視の「今すぐ切る」キルスイッチ
   ---------------------------------------------------------
   おとりAIが変な方向に会話を進めてしまった場合や、相手が実は本物の
   知人・緊急連絡だった場合に、ユーザーがダッシュボードから即座に
   通話を終了させるための安全装置。Twilio REST APIで進行中の通話を
   直接終了させる（次の会話ターンを待たず、即座に切れる）。
   ========================================================= */

import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { requestKill, finishCall } from "@/lib/call-store";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ callSid: string }> }) {
  const { callSid } = await params;
  await requestKill(callSid);

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (accountSid && authToken) {
    try {
      const client = twilio(accountSid, authToken);
      await client.calls(callSid).update({ status: "completed" });
    } catch {
      // 通話が既に終了している等。killRequestedフラグは立っているので
      // まだ生きていれば次のターンでも安全側に倒れる
    }
  }

  await finishCall(callSid, "killed");
  return NextResponse.json({ ok: true });
}
