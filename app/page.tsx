"use client";

/* =========================================================
   ダッシュボード — Module 1（ライブ監視）/ Module 4（証拠化）/
   Module 14（SNS拡散、手動確認必須）をまとめた画面
   ========================================================= */

import { useEffect, useState, useCallback } from "react";

type Turn = { role: "ai" | "caller"; text: string; at: number };
type CallRecord = {
  callSid: string;
  from: string;
  to: string;
  status: "in-progress" | "completed" | "killed";
  blacklisted: boolean;
  whitelisted: boolean;
  startedAt: number;
  endedAt: number | null;
  turns: Turn[];
  killRequested: boolean;
};
type CommitmentFlag = { at: number; text: string; kind: "date" | "money" | "pressure" };
type ScamRisk = { score: number; matched: { category: string; text: string }[] };

const ANGRY_KEYWORDS_DISPLAY = [
  "ふざけるな", "うるさい", "舐めてんのか", "何度言わせる", "殺す", "馬鹿にし",
  "いい加減にしろ", "こら", "てめえ", "早くしろ", "怒鳴", "訴えるぞ",
];
function currentModeLabel(record: CallRecord): string {
  if (!record.blacklisted) return "📋 スクリーニング中";
  const lastCaller = [...record.turns].reverse().find((t) => t.role === "caller");
  const angry = lastCaller && ANGRY_KEYWORDS_DISPLAY.some((kw) => lastCaller.text.includes(kw));
  return angry ? "🔥 リバースメンタルケア中" : "🎣 ハニーポット中";
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleString("ja-JP");
}

function fmtDuration(record: CallRecord) {
  const end = record.endedAt ?? Date.now();
  const sec = Math.max(0, Math.round((end - record.startedAt) / 1000));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}分${s}秒`;
}

export default function Dashboard() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [selectedSid, setSelectedSid] = useState<string | null>(null);
  const [selected, setSelected] = useState<CallRecord | null>(null);
  const [legalDraft, setLegalDraft] = useState<string | null>(null);
  const [snsOpen, setSnsOpen] = useState(false);
  const [copyStep, setCopyStep] = useState<"idle" | "copied">("idle");
  const [blacklistInput, setBlacklistInput] = useState("");
  const [blacklist, setBlacklist] = useState<string[]>([]);
  const [whitelistInput, setWhitelistInput] = useState("");
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [callerCommitments, setCallerCommitments] = useState<CommitmentFlag[] | null>(null);
  const [aiWarnings, setAiWarnings] = useState<CommitmentFlag[] | null>(null);
  const [scamRisk, setScamRisk] = useState<ScamRisk | null>(null);

  const refreshCalls = useCallback(async () => {
    const res = await fetch("/api/calls");
    if (!res.ok) return;
    const data = await res.json();
    setCalls(data.calls || []);
  }, []);

  const refreshSelected = useCallback(async () => {
    if (!selectedSid) return;
    const res = await fetch(`/api/calls/${selectedSid}`);
    if (!res.ok) return;
    const data = await res.json();
    setSelected(data.call);
  }, [selectedSid]);

  const refreshBlacklist = useCallback(async () => {
    const res = await fetch("/api/blacklist");
    if (!res.ok) return;
    const data = await res.json();
    setBlacklist(data.numbers || []);
  }, []);

  const refreshWhitelist = useCallback(async () => {
    const res = await fetch("/api/whitelist");
    if (!res.ok) return;
    const data = await res.json();
    setWhitelist(data.numbers || []);
  }, []);

  // ポーリングでサーバーの最新状態を取り込む（意図的にeffect内でfetch→setStateしている）
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    refreshCalls();
    refreshBlacklist();
    refreshWhitelist();
    const interval = setInterval(refreshCalls, 4000);
    return () => clearInterval(interval);
  }, [refreshCalls, refreshBlacklist, refreshWhitelist]);

  useEffect(() => {
    if (!selectedSid) return;
    refreshSelected();
    const interval = setInterval(refreshSelected, 2000);
    return () => clearInterval(interval);
  }, [selectedSid, refreshSelected]);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function handleHangup() {
    if (!selectedSid) return;
    await fetch(`/api/calls/${selectedSid}/hangup`, { method: "POST" });
    refreshSelected();
    refreshCalls();
  }

  async function handleLegalDraft() {
    if (!selectedSid) return;
    const res = await fetch(`/api/calls/${selectedSid}/legal-draft`);
    if (!res.ok) return;
    const data = await res.json();
    setLegalDraft(data.draft);
  }

  async function copySnsText() {
    if (!selected) return;
    const highlights = selected.turns
      .filter((t) => t.role === "ai")
      .slice(0, 3)
      .map((t) => `「${t.text}」`)
      .join(" ");
    const text = `【迷惑電話 撃退レポート】\n発信元: ${selected.from}\n浪費させた時間: ${fmtDuration(selected)}\nハイライト: ${highlights}\n#AI防衛要塞 #迷惑電話撃退`;
    try {
      await navigator.clipboard.writeText(text);
      setCopyStep("copied");
    } catch {
      /* noop */
    }
  }

  async function addBlacklistNumber() {
    const number = blacklistInput.trim();
    if (!number) return;
    await fetch("/api/blacklist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ number }),
    });
    setBlacklistInput("");
    refreshBlacklist();
  }

  async function removeBlacklistNumber(number: string) {
    await fetch("/api/blacklist", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ number }),
    });
    refreshBlacklist();
  }

  async function addWhitelistNumber() {
    const number = whitelistInput.trim();
    if (!number) return;
    await fetch("/api/whitelist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ number }),
    });
    setWhitelistInput("");
    refreshWhitelist();
  }

  async function removeWhitelistNumber(number: string) {
    await fetch("/api/whitelist", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ number }),
    });
    refreshWhitelist();
  }

  async function handleCommitments() {
    if (!selectedSid) return;
    const res = await fetch(`/api/calls/${selectedSid}/commitments`);
    if (!res.ok) return;
    const data = await res.json();
    setCallerCommitments(data.callerCommitments || []);
    setAiWarnings(data.aiWarnings || []);
    setScamRisk(data.scamRisk || null);
  }

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-8">
      <h1 className="text-lg font-bold mb-1">SENGOKU-SHIELD</h1>
      <p className="text-xs text-[#8a8f99] mb-8">迷惑電話・詐欺電話 対応AI ダッシュボード</p>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-6">
        {/* 通話一覧 */}
        <div>
          <h2 className="text-xs text-[#8a8f99] mb-2">最近の通話</h2>
          <div className="space-y-1">
            {calls.length === 0 && <p className="text-xs text-[#5a5f69]">まだ通話記録はありません</p>}
            {calls.map((c) => (
              <button
                key={c.callSid}
                onClick={() => {
                  setSelectedSid(c.callSid);
                  setLegalDraft(null);
                  setSnsOpen(false);
                  setCopyStep("idle");
                  setCallerCommitments(null);
                  setAiWarnings(null);
                  setScamRisk(null);
                }}
                className={`w-full text-left px-3 py-2 rounded text-xs border ${
                  selectedSid === c.callSid ? "border-[#5b8def] bg-[#111621]" : "border-[#1c2028] hover:bg-[#111621]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono">{c.from}</span>
                  {c.status === "in-progress" && <span className="pulse-rec text-red-400">●REC</span>}
                </div>
                <div className="text-[10px] text-[#6a6f79] mt-1">
                  {fmtTime(c.startedAt)} ・ {c.blacklisted ? "ブロック済み番号" : "未登録番号"} ・ {c.status}
                </div>
              </button>
            ))}
          </div>

          <h2 className="text-xs text-[#8a8f99] mt-8 mb-2">ブロックリスト</h2>
          <div className="flex gap-1 mb-2">
            <input
              value={blacklistInput}
              onChange={(e) => setBlacklistInput(e.target.value)}
              placeholder="+819012345678"
              className="flex-1 bg-[#111621] border border-[#1c2028] rounded px-2 py-1 text-xs outline-none"
            />
            <button onClick={addBlacklistNumber} className="text-xs px-2 py-1 border border-[#1c2028] rounded hover:bg-[#111621]">
              追加
            </button>
          </div>
          <div className="space-y-1">
            {blacklist.map((n) => (
              <div key={n} className="flex items-center justify-between text-xs font-mono text-[#8a8f99]">
                <span>{n}</span>
                <button onClick={() => removeBlacklistNumber(n)} className="text-[10px] text-[#6a6f79] hover:text-red-400">
                  削除
                </button>
              </div>
            ))}
          </div>

          <h2 className="text-xs text-[#8a8f99] mt-8 mb-2">ホワイトリスト（安全な番号）</h2>
          <div className="flex gap-1 mb-2">
            <input
              value={whitelistInput}
              onChange={(e) => setWhitelistInput(e.target.value)}
              placeholder="+819012345678"
              className="flex-1 bg-[#111621] border border-[#1c2028] rounded px-2 py-1 text-xs outline-none"
            />
            <button onClick={addWhitelistNumber} className="text-xs px-2 py-1 border border-[#1c2028] rounded hover:bg-[#111621]">
              追加
            </button>
          </div>
          <div className="space-y-1">
            {whitelist.map((n) => (
              <div key={n} className="flex items-center justify-between text-xs font-mono text-[#8a8f99]">
                <span>{n}</span>
                <button onClick={() => removeWhitelistNumber(n)} className="text-[10px] text-[#6a6f79] hover:text-red-400">
                  削除
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 詳細 */}
        <div>
          {!selected ? (
            <p className="text-xs text-[#5a5f69]">左の一覧から通話を選んでください</p>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="font-mono text-sm">{selected.from}</div>
                  <div className="text-[10px] text-[#6a6f79]">
                    {fmtTime(selected.startedAt)} ・ 経過 {fmtDuration(selected)} ・ {selected.status}
                  </div>
                  {selected.status === "in-progress" && (
                    <div className="text-[10px] text-[#5b8def] mt-1">{currentModeLabel(selected)}</div>
                  )}
                </div>
                {selected.status === "in-progress" && (
                  <button
                    onClick={handleHangup}
                    className="text-xs px-3 py-1.5 border border-red-500/50 text-red-400 rounded hover:bg-red-500/10"
                  >
                    今すぐ切る
                  </button>
                )}
              </div>

              <div className="border border-[#1c2028] rounded p-4 max-h-96 overflow-y-auto space-y-3 mb-4">
                {selected.turns.length === 0 && <p className="text-xs text-[#5a5f69]">まだ会話がありません</p>}
                {selected.turns.map((t, i) => (
                  <div key={i} className={t.role === "caller" ? "text-left" : "text-right"}>
                    <span
                      className={`inline-block text-xs px-3 py-1.5 rounded-lg max-w-[80%] ${
                        t.role === "caller" ? "bg-[#1c2028] text-[#e4e7ec]" : "bg-[#1d3a5f] text-[#cfe2ff]"
                      }`}
                    >
                      {t.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                <button onClick={handleLegalDraft} className="text-xs px-3 py-1.5 border border-[#1c2028] rounded hover:bg-[#111621]">
                  法的メモを作成
                </button>
                <a
                  href={`/api/calls/${selectedSid}/legal-draft/pdf`}
                  className="text-xs px-3 py-1.5 border border-[#1c2028] rounded hover:bg-[#111621] inline-block"
                >
                  証拠PDFをダウンロード
                </a>
                <button onClick={handleCommitments} className="text-xs px-3 py-1.5 border border-[#1c2028] rounded hover:bg-[#111621]">
                  条件・注意点をチェック
                </button>
                <button
                  onClick={() => setSnsOpen((v) => !v)}
                  className="text-xs px-3 py-1.5 border border-[#1c2028] rounded hover:bg-[#111621]"
                >
                  🚨 撃退レポートをSNSで晒す準備
                </button>
              </div>

              {(callerCommitments || aiWarnings) && (
                <div className="border border-[#1c2028] rounded p-4 mb-4 text-xs space-y-3">
                  {scamRisk && (
                    <div>
                      <p className="text-[#8a8f99] mb-1">特殊詐欺パターン危険度（Module 1拡張・目安）</p>
                      <p className={scamRisk.score >= 60 ? "text-red-400" : scamRisk.score >= 30 ? "text-yellow-400" : "text-[#e4e7ec]"}>
                        {scamRisk.score} / 100
                        {scamRisk.matched.length > 0 && (
                          <span className="text-[#6a6f79]">
                            {" "}
                            （検出: {[...new Set(scamRisk.matched.map((m) => m.category))].join("、")}）
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                  <div>
                    <p className="text-[#8a8f99] mb-1">相手が提示した期限・金額（Module 5）</p>
                    {!callerCommitments || callerCommitments.length === 0 ? (
                      <p className="text-[#5a5f69]">検出なし</p>
                    ) : (
                      <ul className="space-y-1">
                        {callerCommitments.map((c, i) => (
                          <li key={i} className="text-[#e4e7ec]">
                            [{c.kind}] {c.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div>
                    <p className="text-[#8a8f99] mb-1">⚠️ AIが同意したような発言（要確認・Module 11代替）</p>
                    {!aiWarnings || aiWarnings.length === 0 ? (
                      <p className="text-[#5a5f69]">検出なし</p>
                    ) : (
                      <ul className="space-y-1">
                        {aiWarnings.map((c, i) => (
                          <li key={i} className="text-red-400">
                            {c.text}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}

              {legalDraft && (
                <div className="mb-4">
                  <textarea
                    readOnly
                    value={legalDraft}
                    rows={10}
                    className="w-full bg-[#0d1016] border border-[#1c2028] rounded p-3 text-xs font-mono"
                  />
                </div>
              )}

              {snsOpen && (
                <div className="border border-[#1c2028] rounded p-4">
                  <p className="text-xs text-[#8a8f99] mb-3">
                    内容を確認してから投稿してください（自動投稿はしません）。誤検知（一般の番号）でないか、必ず目視で確認を。
                  </p>
                  <button
                    onClick={copySnsText}
                    className="text-xs px-3 py-1.5 border border-[#1c2028] rounded hover:bg-[#111621]"
                  >
                    {copyStep === "copied" ? "コピーしました！" : "投稿文をコピー"}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
