/* =========================================================
   /api/voice/status — Twilioの通話ステータスWebhook
   ---------------------------------------------------------
   相手側が先に電話を切った場合など、会話ループ（/api/voice/turn）が
   呼ばれないまま通話が終わるケースがあるため、Twilio電話番号の
   「Call status changes」設定にこのURLを登録しておくと、通話終了時に
   確実に記録をcompletedへ更新できる。
   ========================================================= */

import { NextRequest } from "next/server";
import { verifyTwilioRequest, parseTwilioForm } from "@/lib/twilio-verify";
import { getCall, finishCall } from "@/lib/call-store";

export async function POST(req: NextRequest) {
  const params = await parseTwilioForm(req);
  const valid = await verifyTwilioRequest(req, params);
  if (!valid) {
    return new Response("invalid signature", { status: 403 });
  }

  const callSid = params.CallSid;
  if (callSid) {
    const record = await getCall(callSid);
    if (record && record.status === "in-progress") {
      await finishCall(callSid, "completed");
    }
  }

  return new Response("ok", { status: 200 });
}
