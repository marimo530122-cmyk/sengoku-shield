/* =========================================================
   Module 12用: 相手が攻撃的な口調になっていないかの簡易判定
   ---------------------------------------------------------
   ・単純なキーワード一致（AIによる感情分析ではない）。誤検知しても
     実害が小さい方向（honeypotモード内でより丁寧になるだけ）に
     倒してあるため、多少過敏でも問題にならない設計。
   ========================================================= */

import type { Turn } from "./call-store";

const ANGRY_KEYWORDS = [
  "ふざけるな", "うるさい", "舐めてんのか", "何度言わせる", "殺す", "馬鹿にし",
  "いい加減にしろ", "こら", "てめえ", "早くしろ", "怒鳴", "訴えるぞ",
];

export function isRecentTurnAngry(turns: Turn[]): boolean {
  const lastCaller = [...turns].reverse().find((t) => t.role === "caller");
  if (!lastCaller) return false;
  return ANGRY_KEYWORDS.some((kw) => lastCaller.text.includes(kw));
}
