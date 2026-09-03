/* =========================================================
   TwiML（Twilioに返すXML）の組み立てヘルパー
   ---------------------------------------------------------
   ・日本語の読み上げは Twilio 標準の Amazon Polly 音声
     （Polly.Mizuki / Polly.Takumi）を使う。追加のTTS契約は不要。
   ========================================================= */

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function xmlResponse(body: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${body}</Response>`, {
    headers: { "content-type": "text/xml; charset=utf-8" },
  });
}

// Module 13代替: 「威厳のある声」はプロソディ（ピッチ・速度）の調整だけで実現する。
// ⚠️ 正直な設計方針: 特定の実在機関（警察・官公庁等）を名乗らせることは、
// 相手が詐欺師であっても身分詐称・脅迫隣接のリスクがあるため行わない
// （honeypot-prompt.tsのSHARED_SAFETY_RULES参照）。ここでの「威圧感」は
// あくまで声のトーンだけにとどめ、話す内容は事実の範囲を超えない
export function say(
  text: string,
  voice: "Polly.Mizuki" | "Polly.Takumi" = "Polly.Mizuki",
  options?: { authoritative?: boolean }
): string {
  const escaped = escapeXml(text);
  const inner = options?.authoritative ? `<prosody pitch="-15%" rate="92%">${escaped}</prosody>` : escaped;
  return `<Say language="ja-JP" voice="${voice}">${inner}</Say>`;
}

// 次の発話を音声認識つきで待つ（おとりAIの会話ループの中核）
export function gatherSpeech(actionUrl: string, innerTwiml: string): string {
  return `<Gather input="speech" language="ja-JP" speechTimeout="auto" action="${escapeXml(actionUrl)}" method="POST">${innerTwiml}</Gather>`;
}

export function hangup(): string {
  return "<Hangup/>";
}

export function pause(seconds: number): string {
  return `<Pause length="${Math.max(1, Math.round(seconds))}"/>`;
}
