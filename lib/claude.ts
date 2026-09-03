/* =========================================================
   Claude APIの呼び出し（おとりAIの応答生成）
   ========================================================= */

import type { Turn } from "./call-store";

const MAX_TOKENS = 200;

export async function generateReply(systemPrompt: string, turns: Turn[]): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const messages = turns.map((t) => ({
    role: t.role === "caller" ? ("user" as const) : ("assistant" as const),
    content: t.text,
  }));

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: MAX_TOKENS,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider error: ${await response.text()}`);
  }

  const data = await response.json();
  const text = (Array.isArray(data.content) ? data.content.map((b: { text?: string }) => b.text || "").join("") : "") || "";
  return text.trim() || "……少々お待ちください。";
}
