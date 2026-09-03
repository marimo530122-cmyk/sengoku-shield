/* =========================================================
   /api/voice/incoming — Twilioの着信Webhook
   ---------------------------------------------------------
   ユーザーの携帯電話からこのTwilio番号へ着信転送されたときに呼ばれる。
   ブロックリスト照合 → 通話記録の作成 → 冒頭アナウンス → 会話ループ開始。
   ========================================================= */

import { NextRequest } from "next/server";
import { verifyTwilioRequest, parseTwilioForm } from "@/lib/twilio-verify";
import { isBlacklisted } from "@/lib/blacklist";
import { createCall } from "@/lib/call-store";
import { PRELUDE_MESSAGE } from "@/lib/honeypot-prompt";
import { xmlResponse, say, gatherSpeech, hangup } from "@/lib/twiml";

export async function POST(req: NextRequest) {
  const params = await parseTwilioForm(req);
  const valid = await verifyTwilioRequest(req, params);
  if (!valid) {
    return new Response("invalid signature", { status: 403 });
  }

  const callSid = params.CallSid;
  const from = params.From || "unknown";
  const to = params.To || "unknown";
  if (!callSid) {
    return xmlResponse(hangup());
  }

  let blacklisted = false;
  try {
    blacklisted = await isBlacklisted(from);
  } catch {
    blacklisted = false;
  }

  try {
    await createCall(callSid, from, to, blacklisted);
  } catch {
    // KV未設定など。会話継続はできないため丁寧に切る
    return xmlResponse(say("申し訳ありません、ただいまシステムの準備中です。") + hangup());
  }

  const actionUrl = new URL("/api/voice/turn", req.url).toString();
  return xmlResponse(gatherSpeech(actionUrl, say(PRELUDE_MESSAGE)));
}
