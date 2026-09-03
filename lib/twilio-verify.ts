/* =========================================================
   Twilio Webhookの署名検証
   ---------------------------------------------------------
   ・/api/voice/* は誰でもインターネットから直接POSTできるURLのため、
     Twilioからの本物のリクエストかどうかをX-Twilio-Signatureヘッダーで
     検証する。これをしないと、第三者が偽の音声認識結果を送りつけて
     おとりAI（Claude API・課金対象）を無制限に呼び出せてしまう。
   ・ローカル開発でどうしても検証が邪魔な場合だけ
     TWILIO_SKIP_SIGNATURE_CHECK=true で無効化できる（本番では絶対に
     trueにしないこと）。
   ========================================================= */

import twilio from "twilio";

export async function verifyTwilioRequest(req: Request, params: Record<string, string>): Promise<boolean> {
  if (process.env.TWILIO_SKIP_SIGNATURE_CHECK === "true") return true;

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;

  const signature = req.headers.get("x-twilio-signature");
  if (!signature) return false;

  // VercelはリバースプロキシのためHTTPSで届いても req.url が http:// になることがある。
  // Twilioは実際に叩いたURL（https）で署名しているため、ヘッダーから実プロトコルを復元する。
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const url = new URL(req.url);
  const fullUrl = `${proto}://${host}${url.pathname}${url.search}`;

  return twilio.validateRequest(authToken, signature, fullUrl, params);
}

// TwilioのWebhookは application/x-www-form-urlencoded で飛んでくる
export async function parseTwilioForm(req: Request): Promise<Record<string, string>> {
  const formData = await req.formData();
  const params: Record<string, string> = {};
  formData.forEach((value, key) => {
    params[key] = String(value);
  });
  return params;
}
