/* =========================================================
   Module 3（一部）: ホワイトリスト（既知の安全な番号）
   ---------------------------------------------------------
   ・正直な見立て: 元仕様にあった「声紋の0.5秒照合」は、比較対象となる
     声紋データベースが別途必要でフェーズ2のスコープ外。ここでは
     電話番号の文字列一致のみを行う、より地に足のついた実装にした。
   ・ブロックリストとは独立したVercel KVのSETで管理する。
   ========================================================= */

import { kv } from "@vercel/kv";

const WHITELIST_KEY = "sengoku:whitelist";

export async function isWhitelisted(phoneNumber: string): Promise<boolean> {
  const result = await kv.sismember(WHITELIST_KEY, phoneNumber);
  return result === 1;
}

export async function addToWhitelist(phoneNumber: string): Promise<void> {
  await kv.sadd(WHITELIST_KEY, phoneNumber);
}

export async function removeFromWhitelist(phoneNumber: string): Promise<void> {
  await kv.srem(WHITELIST_KEY, phoneNumber);
}

export async function listWhitelist(): Promise<string[]> {
  return kv.smembers(WHITELIST_KEY);
}
