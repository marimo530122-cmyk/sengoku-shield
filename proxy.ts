/* =========================================================
   ダッシュボード・管理APIへの簡易アクセス制限（Basic認証）
   ---------------------------------------------------------
   ・通話の文字起こしには電話番号や会話内容が含まれるため、URLを知って
     いれば誰でも見られる状態は避ける。DASHBOARD_PASSWORDによる
     最低限のBasic認証をかける（本格的な認証基盤は将来課題）。
   ・/api/voice/* はTwilioからのWebhookのため対象外（X-Twilio-Signature
     による検証をlib/twilio-verify.tsで別途行っている）。
   ========================================================= */

import { NextRequest, NextResponse } from "next/server";

export const config = {
  matcher: ["/((?!api/voice|_next/static|_next/image|favicon.ico).*)"],
};

export function proxy(req: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password || password === "change-me") {
    // 未設定のままだと誰でもアクセスできてしまうため、あえてブロックする
    return new NextResponse("DASHBOARD_PASSWORD が未設定です。.env.local を確認してください。", { status: 503 });
  }

  const auth = req.headers.get("authorization");
  if (auth) {
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const [, suppliedPassword] = decoded.split(":");
      if (suppliedPassword === password) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("認証が必要です", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="SENGOKU-SHIELD"' },
  });
}
