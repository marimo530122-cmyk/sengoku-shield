/* =========================================================
   Module 5: スマートコントラクトBot（条件の確定を支援）
   Module 11の代替実装: コンプライアンス地雷検知
   ---------------------------------------------------------
   ・元のModule 11「ユーザー自身の発言を監視して危険な口約束に
     警告を出す」は、この着信転送方式（AIが応答している間、ユーザー
     本人は話していない）とは相性が悪いため実装していない
     （要件定義書.md セクション4参照）。
   ・代わりに、こちらでは「おとりAI自身が、ユーザーに代わって
     何かに同意してしまっていないか」を事後チェックする、より
     実態に即した安全装置にした。AI側にも同意・契約に関する言及を
     禁じるルールを追加済み（lib/honeypot-prompt.tsのSHARED_SAFETY_RULES）。
   ・どちらも単純なキーワード一致であり、AIによる意味理解ではない
     （lib/legal-shield.tsと同じ設計方針）。
   ========================================================= */

import type { Turn } from "./call-store";

const DATE_PATTERN = /(\d{1,2}月\d{1,2}日|明日|明後日|今日中|今週中|今月中|\d{1,2}\/\d{1,2})/;
const MONEY_PATTERN = /(¥\s?\d[\d,]*|\d[\d,]*\s?円|\d+\s?万円)/;
const PRESSURE_PATTERN = /(今すぐ|今日中に決め|今なら|今回限り|至急|期限までに)/;

export type CommitmentFlag = { at: number; text: string; kind: "date" | "money" | "pressure" };

// Module 5: 相手（詐欺師・営業）が提示した日付・金額・期限プレッシャーを抽出する
export function extractCallerCommitments(turns: Turn[]): CommitmentFlag[] {
  const flags: CommitmentFlag[] = [];
  for (const turn of turns) {
    if (turn.role !== "caller") continue;
    if (DATE_PATTERN.test(turn.text)) flags.push({ at: turn.at, text: turn.text, kind: "date" });
    if (MONEY_PATTERN.test(turn.text)) flags.push({ at: turn.at, text: turn.text, kind: "money" });
    if (PRESSURE_PATTERN.test(turn.text)) flags.push({ at: turn.at, text: turn.text, kind: "pressure" });
  }
  return flags;
}

const AI_AGREEMENT_PATTERN = /(承知しました|了承します|申し込みます|購入します|同意します|契約します|それで大丈夫です|お願いします、それで|振り込みます|支払います)/;

// Module 11代替: AI自身が何かに同意したような発言をしていないか事後チェックする
export function extractAiCommitmentWarnings(turns: Turn[]): CommitmentFlag[] {
  const flags: CommitmentFlag[] = [];
  for (const turn of turns) {
    if (turn.role !== "ai") continue;
    if (AI_AGREEMENT_PATTERN.test(turn.text)) {
      flags.push({ at: turn.at, text: turn.text, kind: "pressure" });
    }
  }
  return flags;
}
