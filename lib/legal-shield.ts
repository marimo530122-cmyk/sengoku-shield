/* =========================================================
   Module 4: 証拠化支援（Legal Shield）
   ---------------------------------------------------------
   ・AIによる感情分析ではなく、単純なキーワード一致による見出し付け。
     「AIが自動で脅迫と判定した」と言い切れる精度ではないため、
     フェーズ1では「注意フラグを立てるだけ」に留め、実際の法的判断・
     通報の要否はユーザー自身が読んで判断する前提にしてある。
   ========================================================= */

import type { Turn } from "./call-store";

const FLAG_KEYWORDS = [
  "殺す", "殺します", "訴える", "訴えます", "金を払え", "金払え", "払わないと",
  "個人情報", "口座番号", "カード番号", "暗証番号", "振り込め", "振込先",
  "取り立て", "脅す", "痛い目", "住所を知って", "覚えとけ",
];

export type FlaggedLine = { at: number; text: string; matchedKeywords: string[] };

export function flagTranscript(turns: Turn[]): FlaggedLine[] {
  const flagged: FlaggedLine[] = [];
  for (const turn of turns) {
    if (turn.role !== "caller") continue;
    const matched = FLAG_KEYWORDS.filter((kw) => turn.text.includes(kw));
    if (matched.length > 0) {
      flagged.push({ at: turn.at, text: turn.text, matchedKeywords: matched });
    }
  }
  return flagged;
}

export function buildLegalDraft(record: {
  from: string;
  startedAt: number;
  endedAt: number | null;
  turns: Turn[];
}): string {
  const flagged = flagTranscript(record.turns);
  const date = new Date(record.startedAt).toLocaleString("ja-JP");
  const durationSec = record.endedAt ? Math.round((record.endedAt - record.startedAt) / 1000) : null;

  const lines = [
    "【通話記録メモ（下書き・要ご本人確認）】",
    `発信元電話番号: ${record.from}`,
    `日時: ${date}`,
    durationSec !== null ? `通話時間: 約${durationSec}秒` : "通話時間: (記録中)",
    "",
    "■ 注意が必要と思われる発言",
  ];

  if (flagged.length === 0) {
    lines.push("（該当する発言は検出されませんでした）");
  } else {
    for (const f of flagged) {
      lines.push(`- 「${f.text}」（該当キーワード: ${f.matchedKeywords.join("、")}）`);
    }
  }

  lines.push("", "■ 通話全文");
  for (const t of record.turns) {
    lines.push(`${t.role === "caller" ? "相手" : "AI"}: ${t.text}`);
  }

  lines.push(
    "",
    "※このメモは単純なキーワード一致による自動抽出です。法的な脅迫・恐喝等に該当するかどうかの判断は含まれていません。",
    "※警察・消費生活センター等へ相談する際の記録としてご利用ください（110番は緊急時のみ。相談は警察相談専用電話#9110、消費者ホットライン188）。"
  );

  return lines.join("\n");
}
