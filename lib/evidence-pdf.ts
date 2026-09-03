/* =========================================================
   Module 4拡張: 通話証拠パッケージのPDF生成
   ---------------------------------------------------------
   ・lib/legal-shield.ts（下書きテキスト）とlib/commitment-extractor.ts
     （相手が提示した条件）の内容をそのままPDF化する。既存の免責文言も
     そのまま引き継ぐ
   ⚠️ 正直な注意点: 内容証明郵便・被害届は、郵便局・警察側で書式が
   決まっている正式書類。このPDFは「時系列・事実関係を整理した下書き」
   であり、そのまま提出できる正式な内容証明・被害届そのものではない
   （PDF本文にも同じ注意書きを明記している）
   ・日本語フォントはNoto Sans JP（OFLライセンス、assets/fonts/に同梱）
     を@pdf-lib/fontkitで埋め込む
   ========================================================= */

import { PDFDocument, PDFFont, PDFPage, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "fs/promises";
import path from "path";
import type { CallRecord } from "./call-store";
import { flagTranscript } from "./legal-shield";
import { extractCallerCommitments, extractAiCommitmentWarnings } from "./commitment-extractor";

const FONT_PATH = path.join(process.cwd(), "assets/fonts/NotoSansJP-Regular.ttf");
const PAGE_SIZE: [number, number] = [595.28, 841.89]; // A4
const MARGIN = 48;
const FONT_SIZE = 10;
const LINE_HEIGHT = 15;

function wrapLine(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  if (text === "") return [""];
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const candidate = current + ch;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current !== "") {
      lines.push(current);
      current = ch;
    } else {
      current = candidate;
    }
  }
  if (current !== "") lines.push(current);
  return lines;
}

export async function buildEvidencePdf(record: CallRecord): Promise<Uint8Array> {
  const fontBytes = await fs.readFile(FONT_PATH);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(fontBytes, { subset: true });

  const maxWidth = PAGE_SIZE[0] - MARGIN * 2;
  let page: PDFPage = doc.addPage(PAGE_SIZE);
  let y = PAGE_SIZE[1] - MARGIN;

  function ensureSpace(need = LINE_HEIGHT) {
    if (y - need < MARGIN) {
      page = doc.addPage(PAGE_SIZE);
      y = PAGE_SIZE[1] - MARGIN;
    }
  }

  function drawText(text: string, size = FONT_SIZE, color = rgb(0, 0, 0)) {
    for (const raw of text.split("\n")) {
      for (const line of wrapLine(raw, font, size, maxWidth)) {
        ensureSpace();
        page.drawText(line, { x: MARGIN, y, size, font, color });
        y -= LINE_HEIGHT;
      }
    }
  }

  function drawSpacer(amount = 8) {
    y -= amount;
  }

  const date = new Date(record.startedAt).toLocaleString("ja-JP");
  const durationSec = record.endedAt ? Math.round((record.endedAt - record.startedAt) / 1000) : null;
  const flagged = flagTranscript(record.turns);
  const callerCommitments = extractCallerCommitments(record.turns);
  const aiWarnings = extractAiCommitmentWarnings(record.turns);

  drawText("通話記録・証拠メモ（下書き・要ご本人確認）", 14);
  drawSpacer(10);
  drawText(`発信元電話番号: ${record.from}`);
  drawText(`日時: ${date}`);
  drawText(durationSec !== null ? `通話時間: 約${durationSec}秒` : "通話時間: (記録中)");
  drawText(`ブロックリスト該当: ${record.blacklisted ? "はい" : "いいえ"}`);
  drawSpacer();

  drawText("■ 注意が必要と思われる発言", 11);
  if (flagged.length === 0) {
    drawText("（該当する発言は検出されませんでした）");
  } else {
    for (const f of flagged) {
      drawText(`- 「${f.text}」（該当キーワード: ${f.matchedKeywords.join("、")}）`);
    }
  }
  drawSpacer();

  drawText("■ 相手が提示した期限・金額・急かし文句", 11);
  if (callerCommitments.length === 0) {
    drawText("（検出なし）");
  } else {
    for (const c of callerCommitments) {
      drawText(`- [${c.kind}] ${c.text}`);
    }
  }
  drawSpacer();

  if (aiWarnings.length > 0) {
    drawText("■ ⚠️ AIが同意したような発言（要確認）", 11);
    for (const w of aiWarnings) {
      drawText(`- ${w.text}`);
    }
    drawSpacer();
  }

  drawText("■ 通話全文", 11);
  for (const t of record.turns) {
    drawText(`${t.role === "caller" ? "相手" : "AI"}: ${t.text}`);
  }
  drawSpacer();

  drawText(
    "※このメモは単純なキーワード一致による自動抽出です。法的な脅迫・恐喝等に該当するかどうかの判断は含まれていません。",
    9,
    rgb(0.4, 0.4, 0.4)
  );
  drawText(
    "※このPDFは事実関係を時系列で整理した下書きであり、内容証明郵便・被害届そのものの正式書式ではありません。",
    9,
    rgb(0.4, 0.4, 0.4)
  );
  drawText(
    "※警察・消費生活センター等へ相談する際の記録としてご利用ください（110番は緊急時のみ。相談は警察相談専用電話#9110、消費者ホットライン188）。",
    9,
    rgb(0.4, 0.4, 0.4)
  );

  return doc.save();
}
