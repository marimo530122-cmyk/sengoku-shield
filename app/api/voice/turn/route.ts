/* =========================================================
   /api/voice/turn — 会話ループの1ターン分
   ---------------------------------------------------------
   Twilioの<Gather>が音声認識結果を持ってPOSTしてくる。文字起こしを
   保存 → Claudeで返答生成 → 保存 → 次の<Gather>で読み上げて待つ、を
   通話が終わるまで繰り返す。
   ========================================================= */

import { NextRequest } from "next/server";
import { verifyTwilioRequest, parseTwilioForm } from "@/lib/twilio-verify";
import { getCall, appendTurn, finishCall, markBlacklisted } from "@/lib/call-store";
import { buildHoneypotPrompt, SCAM_ESCALATION_WARNING_LINE } from "@/lib/honeypot-prompt";
import { isRecentTurnAngry } from "@/lib/tone-detector";
import { scoreScamRisk, SCAM_RISK_AUTO_BLACKLIST_THRESHOLD } from "@/lib/scam-pattern-detector";
import { addToBlacklist } from "@/lib/blacklist";
import { generateReply } from "@/lib/claude";
import { xmlResponse, say, gatherSpeech, hangup } from "@/lib/twiml";

const MAX_TURNS = 40; // 会話が長引きすぎてAPI費用が青天井にならないようにする上限（20往復）
const MAX_CONSECUTIVE_SILENCE = 2;

export async function POST(req: NextRequest) {
  const params = await parseTwilioForm(req);
  const valid = await verifyTwilioRequest(req, params);
  if (!valid) {
    return new Response("invalid signature", { status: 403 });
  }

  const callSid = params.CallSid;
  const speechResult = (params.SpeechResult || "").trim();
  const actionUrl = new URL("/api/voice/turn", req.url).toString();

  if (!callSid) return xmlResponse(hangup());

  let record = await getCall(callSid);
  if (!record) return xmlResponse(hangup());

  // ダッシュボードから「今すぐ切る」が押されていた場合
  if (record.killRequested) {
    await finishCall(callSid, "killed");
    return xmlResponse(say("失礼いたします。") + hangup());
  }

  if (!speechResult) {
    // 無音・聞き取れなかった場合
    const recentSilences = [...record.turns]
      .reverse()
      .filter((t) => t.role === "caller")
      .slice(0, MAX_CONSECUTIVE_SILENCE)
      .every((t) => t.text === "(無音)");
    if (record.turns.length >= MAX_CONSECUTIVE_SILENCE && recentSilences) {
      await finishCall(callSid, "completed");
      return xmlResponse(say("お電話が聞こえないようですので、失礼いたします。") + hangup());
    }
    await appendTurn(callSid, "caller", "(無音)");
    return xmlResponse(gatherSpeech(actionUrl, say("もしもし、聞こえていますでしょうか。")));
  }

  record = await appendTurn(callSid, "caller", speechResult);
  if (!record) return xmlResponse(hangup());

  if (record.turns.length >= MAX_TURNS) {
    await finishCall(callSid, "completed");
    return xmlResponse(say("お時間になりましたので、これで失礼いたします。") + hangup());
  }

  // Module 1拡張: 発言内容から特殊詐欺の危険度をリアルタイム判定し、閾値を
  // 超えたらこの通話をその場でブロックリスト格上げする(以降の着信も対象になる)
  let justEscalated = false;
  let effectiveBlacklisted = record.blacklisted;
  if (!effectiveBlacklisted) {
    const risk = scoreScamRisk(record.turns);
    if (risk.score >= SCAM_RISK_AUTO_BLACKLIST_THRESHOLD) {
      await addToBlacklist(record.from);
      await markBlacklisted(callSid);
      effectiveBlacklisted = true;
      justEscalated = true;
    }
  }

  // Module 12: ブロックリスト一致の通話でだけ、相手が攻撃的になったら
  // リバースメンタルケア口調に動的切り替え（screeningモードには適用しない）
  const mode = effectiveBlacklisted ? (isRecentTurnAngry(record.turns) ? "honeypot_reverse_care" : "honeypot") : "screening";
  const systemPrompt = buildHoneypotPrompt(mode);

  let reply: string;
  try {
    reply = await generateReply(systemPrompt, record.turns);
  } catch {
    reply = "……少し聞き取りにくかったです。もう一度お願いできますか。";
  }

  await appendTurn(callSid, "ai", reply);

  // Module 13代替: 格上げが起きた最初のターンだけ、低め・落ち着いたトーンで
  // 事実ベースの一言を先に流してから、通常の応答に続ける
  const escalationNotice = justEscalated
    ? say(SCAM_ESCALATION_WARNING_LINE, "Polly.Takumi", { authoritative: true })
    : "";

  return xmlResponse(gatherSpeech(actionUrl, escalationNotice + say(reply)));
}
