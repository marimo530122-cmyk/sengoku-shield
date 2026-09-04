/* =========================================================
   /api/health — 認証なしの疎通確認用エンドポイント
   ---------------------------------------------------------
   Twilio Webhookの動作確認をする前に、まず「Vercelの
   Deployment Protection（プラットフォーム側の保護）が
   このデプロイをブロックしていないか」を、通話料をかけずに
   curlだけで切り分けるためのもの。/api/voice/* と同様に
   proxy.tsのBasic認証対象から除外している。
   ========================================================= */

export async function GET() {
  return Response.json({ ok: true, service: "sengoku-shield" });
}
