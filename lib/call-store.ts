/* =========================================================
   通話ごとの状態（文字起こし・進行状況）の保存先（Vercel KV）
   ---------------------------------------------------------
   ・Vercelのサーバーレス関数は毎回別インスタンスで動く可能性があるため、
     メモリ上の変数では通話の途中経過を覚えていられない。Twilioの
     Webhookが呼ばれるたびにKV（Redis互換）から読み書きする。
   ・録音した音声そのものは保存しない（フェーズ1の設計判断。
     要件定義書.md参照）。文字起こしテキストだけを保存する。
   ========================================================= */

import { kv } from "@vercel/kv";

export type Turn = {
  role: "ai" | "caller";
  text: string;
  at: number;
};

export type CallRecord = {
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

const INDEX_KEY = "sengoku:calls:index";
const MAX_INDEXED_CALLS = 100;

function callKey(callSid: string) {
  return `sengoku:call:${callSid}`;
}

export async function createCall(
  callSid: string,
  from: string,
  to: string,
  blacklisted: boolean,
  whitelisted = false
): Promise<CallRecord> {
  const record: CallRecord = {
    callSid,
    from,
    to,
    status: "in-progress",
    blacklisted,
    whitelisted,
    startedAt: Date.now(),
    endedAt: null,
    turns: [],
    killRequested: false,
  };
  await kv.set(callKey(callSid), record);
  await kv.lpush(INDEX_KEY, callSid);
  await kv.ltrim(INDEX_KEY, 0, MAX_INDEXED_CALLS - 1);
  return record;
}

export async function getCall(callSid: string): Promise<CallRecord | null> {
  return (await kv.get<CallRecord>(callKey(callSid))) ?? null;
}

export async function appendTurn(callSid: string, role: Turn["role"], text: string): Promise<CallRecord | null> {
  const record = await getCall(callSid);
  if (!record) return null;
  record.turns.push({ role, text, at: Date.now() });
  await kv.set(callKey(callSid), record);
  return record;
}

export async function finishCall(callSid: string, status: "completed" | "killed" = "completed"): Promise<void> {
  const record = await getCall(callSid);
  if (!record) return;
  record.status = status;
  record.endedAt = Date.now();
  await kv.set(callKey(callSid), record);
}

export async function requestKill(callSid: string): Promise<void> {
  const record = await getCall(callSid);
  if (!record) return;
  record.killRequested = true;
  await kv.set(callKey(callSid), record);
}

export async function listRecentCalls(limit = 20): Promise<CallRecord[]> {
  const ids = await kv.lrange<string>(INDEX_KEY, 0, limit - 1);
  if (!ids.length) return [];
  const records = await Promise.all(ids.map((id) => getCall(id)));
  return records.filter((r): r is CallRecord => r !== null);
}
