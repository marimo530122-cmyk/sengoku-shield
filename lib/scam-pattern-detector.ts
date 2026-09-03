/* =========================================================
   Module 1拡張: 特殊詐欺の手口パターンによるリアルタイム危険度判定
   ---------------------------------------------------------
   ⚠️ 正直な前提: 警視庁・自治体が電話番号単位でリアルタイム照合できる
   公開APIは、調査時点（2026年9月）で見つかっていない（詳細は
   lib/blacklist-config.tsのコメント参照）。存在しないAPIへ接続する
   ふりをする代わりに、警察庁・国民生活センター等が繰り返し公表して
   いる特殊詐欺の典型的な言い回しをパターン化し、通話中の相手の発言
   そのものをリアルタイムでスコアリングする方式にした。
   ・単純な正規表現一致であり、AIによる意味理解ではない（他の
     lib/legal-shield.ts等と同じ設計方針）。誤検知はありうるため、
     スコアはあくまで「警戒を強める目安」として使う
   ========================================================= */

import type { Turn } from "./call-store";

type ScamCategory = "還付金詐欺" | "オレオレ詐欺" | "キャッシュカード詐欺盗" | "架空請求" | "緊急性・口止め";

const SCAM_PATTERNS: { category: ScamCategory; weight: number; patterns: RegExp[] }[] = [
  {
    category: "還付金詐欺",
    weight: 30,
    patterns: [/還付金/, /医療費.{0,5}(戻|還付)/, /ATM.{0,10}(操作|行って|向かって)/, /コンビニ.{0,5}ATM/],
  },
  {
    category: "オレオレ詐欺",
    weight: 30,
    patterns: [/電話番号.{0,6}変わった/, /風邪.{0,5}声/, /会社の金.{0,6}使い込/, /示談金/, /今すぐ.{0,10}現金/],
  },
  {
    category: "キャッシュカード詐欺盗",
    weight: 35,
    patterns: [/キャッシュカード.{0,10}(預か|封筒)/, /暗証番号.{0,10}(書いて|教えて)/, /犯人.{0,10}使われ/],
  },
  {
    category: "架空請求",
    weight: 25,
    patterns: [/未納.{0,5}料金/, /法務局/, /訴訟.{0,6}取り下げ/, /総合消費料金/],
  },
  {
    category: "緊急性・口止め",
    weight: 15,
    patterns: [/誰にも言わないで/, /他の家族.{0,5}内緒/, /今日中に決め/, /今すぐ決め/],
  },
];

export type ScamRiskResult = {
  score: number;
  matched: { category: ScamCategory; text: string }[];
};

// カテゴリごとに最初の1回だけ加点する（同じ言い回しを繰り返してもスコアが際限なく伸びないように）
export function scoreScamRisk(turns: Turn[]): ScamRiskResult {
  const matched: ScamRiskResult["matched"] = [];
  const seenCategories = new Set<ScamCategory>();
  let score = 0;

  for (const turn of turns) {
    if (turn.role !== "caller") continue;
    for (const { category, weight, patterns } of SCAM_PATTERNS) {
      if (!patterns.some((p) => p.test(turn.text))) continue;
      matched.push({ category, text: turn.text });
      if (!seenCategories.has(category)) {
        score += weight;
        seenCategories.add(category);
      }
    }
  }
  return { score: Math.min(100, score), matched };
}

export const SCAM_RISK_AUTO_BLACKLIST_THRESHOLD = 60;
