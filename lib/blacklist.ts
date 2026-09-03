/* =========================================================
   迷惑電話番号のブロックリスト（Vercel KVのSETで管理）
   ========================================================= */

import { kv } from "@vercel/kv";
import { BLACKLIST_SEED } from "./blacklist-config";

const BLACKLIST_KEY = "sengoku:blacklist";
const SEEDED_FLAG_KEY = "sengoku:blacklist:seeded";

async function ensureSeeded() {
  const seeded = await kv.get(SEEDED_FLAG_KEY);
  if (seeded || BLACKLIST_SEED.length === 0) return;
  await kv.sadd(BLACKLIST_KEY, BLACKLIST_SEED[0], ...BLACKLIST_SEED.slice(1));
  await kv.set(SEEDED_FLAG_KEY, "1");
}

export async function isBlacklisted(phoneNumber: string): Promise<boolean> {
  await ensureSeeded();
  const result = await kv.sismember(BLACKLIST_KEY, phoneNumber);
  return result === 1;
}

export async function addToBlacklist(phoneNumber: string): Promise<void> {
  await kv.sadd(BLACKLIST_KEY, phoneNumber);
}

export async function removeFromBlacklist(phoneNumber: string): Promise<void> {
  await kv.srem(BLACKLIST_KEY, phoneNumber);
}

export async function listBlacklist(): Promise<string[]> {
  await ensureSeeded();
  return kv.smembers(BLACKLIST_KEY);
}
