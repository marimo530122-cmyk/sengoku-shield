/* =========================================================
   /api/voice/incoming — Twilioの着信Webhook
   ---------------------------------------------------------
   ユーザーの携帯電話からこのTwilio番号へ着信転送されたときに呼ばれる。
   ブロックリスト照合 → 通話記録の作成 → 冒頭アナウンス → 会話ループ開始。
   ========================================================= */

import { NextRequest } from "next/server";
import { verifyTwilioRequest, parseTwilioForm } from "@/lib/twilio-verify";
import { isBlacklisted } from "@/lib/blacklist";
import { isWhitelisted } from "@/lib/whitelist";
import { createCall, finishCall } from "@/lib/call-store";
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
  let whitelisted = false;
  try {
    [blacklisted, whitelisted] = await Promise.all([isBlacklisted(from), isWhitelisted(from)]);
  } catch {
    blacklisted = false;
    whitelisted = false;
  }

  try {
    await createCall(callSid, from, to, blacklisted, whitelisted);
  } catch {
    // KV未設定など。会話継続はできないため丁寧に切る
    return xmlResponse(say("申し訳ありません、ただいまシステムの準備中です。") + hangup());
  }

  // Module 3: ホワイトリスト一致（登録済みの安全な相手）はおとりAIを一切介さず、
  // すぐに丁寧な案内だけを返して終了する（本人の電話番号に自動でかけ直す機能は、
  // 転送設定がONのままだと無限ループになる恐れがあるため実装していない。
  // 要件定義書.md セクション9参照）
  if (whitelisted) {
    await finishCall(callSid, "completed");
    return xmlResponse(
      say("こちらは登録済みの番号です。恐れ入りますが、転送設定を一度解除しておかけ直しください。") + hangup()
    );
  }

  const actionUrl = new URL("/api/voice/turn", req.url).toString();
  return xmlResponse(gatherSpeech(actionUrl, say(PRELUDE_MESSAGE)));
}
