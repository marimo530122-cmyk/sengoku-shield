# デプロイ・実機テスト チェックリスト（フェーズ4）

要件定義書.md セクション6のデプロイ手順に対して、「Vercelへのデプロイ後、Twilio
のWebhookが認証で弾かれる」問題の切り分け方法と、実機テストの手順をまとめる。

## 1. まず疑うべき原因: Vercelの Deployment Protection

このリポジトリのアプリ自体は `proxy.ts` で `/api/voice/*` と `/api/health` を
Basic認証の対象外にしている。**しかしVercelには、アプリのコードより手前の
エッジ側で動く「Deployment Protection（Vercel Authentication / パスワード保護）」
という別レイヤーの保護機能があり、これがONだとTwilioのPOSTがアプリに届く前に
401で弾かれる。** コード側の除外設定だけでは防げない。

### 切り分け方法

Twilioを設定する前に、まず認証なしでcurlだけで疎通確認する。

```sh
curl -i https://（あなたのVercelドメイン）/api/health
```

- `{"ok":true,"service":"sengoku-shield"}` が200で返れば、Vercel側の保護は
  問題ない → Twilioの設定（署名検証・URL）側の問題を疑う（セクション3へ）
- 401やVercelのログイン画面（HTML）が返る場合、**これがVercelの
  Deployment Protectionによるブロック**。セクション2の手順で解除する

## 2. Deployment Protection の解除・バイパス設定

Vercelダッシュボード → 対象プロジェクト → **Settings → Deployment Protection**

このシステムはダッシュボード側で既に独自のBasic認証（`DASHBOARD_PASSWORD`）を
持ち、`/api/voice/*` はTwilioの署名検証で保護されているため、**Vercel側の
保護は不要**。以下のいずれかを選ぶ。

- **推奨: Production Deploymentsを「保護なし」にする**
  「Vercel Authentication」を Production では無効化する（Preview環境だけ
  保護を残すことは可能）。これで `/api/health` ・ `/api/voice/*` を含む
  全パスがVercelの保護なしで到達可能になり、あとはアプリ側の認証
  （Basic認証・Twilio署名検証）だけで守られる状態になる
- **保護を残したい場合: Protection Bypass for Automation を使う**
  プロジェクトの `VERCEL_AUTOMATION_BYPASS_SECRET`（自動で環境変数に入る）
  を控え、TwilioのWebhook URLに `?x-vercel-protection-bypass=（secretの値）`
  をクエリパラメータとして付与する（Twilioはカスタムヘッダーを設定できない
  ため、クエリパラメータ方式を使う）。ただしURLがログに残ると秘密が漏れる
  リスクがあるため、基本は上記の「Production保護なし」を推奨

設定変更後、再度 `curl -i https://.../api/health` で200が返ることを確認する。

## 3. Twilio Webhook設定の再確認

Twilio Console → 電話番号 → 対象番号の設定

| 項目 | 値 |
|---|---|
| A call comes in | `https://（本番ドメイン）/api/voice/incoming`（HTTP POST） |
| Call status changes | `https://（本番ドメイン）/api/voice/status`（HTTP POST） |

- URLの末尾に余分なスラッシュや旧デプロイのプレビューURL（`*-git-*.vercel.app`
  など、デプロイのたびに変わるもの）を指定していないか確認する。**本番用の
  固定ドメイン**（プロジェクト設定のProduction Domain）を使うこと
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` がVercelのEnvironment
  Variablesにも登録されているか確認する（ローカルの`.env.local`だけでは
  本番に反映されない）
- `TWILIO_SKIP_SIGNATURE_CHECK` は本番では必ず `false`（未設定でも可）

## 4. 実機テストの手順

1. **`/api/health` でVercelデプロイ自体の疎通を確認**（セクション1）
2. **ダッシュボードにアクセス** `https://（本番ドメイン）/` を開き、
   `DASHBOARD_PASSWORD` で認証できることを確認する
3. **着信転送をON**（要件定義書.md セクション6-2の手順で、自分のスマホから
   Twilioの番号へ転送するよう設定する）
4. **自分の別の電話（家族の携帯・固定電話など）からテスト発信**し、転送先の
   Twilio経由でSENGOKU-SHIELDが応答するか確認する
   - 冒頭アナウンス（`PRELUDE_MESSAGE`）が流れるか
   - こちらの発言に対してAIが応答を返すか（`/api/voice/turn`のループ）
   - ダッシュボードに通話がリアルタイムで表示され、2秒ごとに文字起こしが
     更新されるか
5. **「今すぐ切る」ボタン**を押して、実際に通話が切断されるか確認する
   （Twilio REST API経由、`app/api/calls/[callSid]/hangup/route.ts`）
6. **ホワイトリスト・ブロックリストのテスト**
   - テスト発信元の番号をホワイトリストに追加 → 再度発信し、AIを介さず
     案内のみで終わることを確認
   - 同じ番号をブロックリストに追加 → 再度発信し、honeypotペルソナ
     （時間稼ぎ）で応答することを確認
7. **通話終了後、証拠PDF生成**（`/api/calls/[callSid]/legal-draft/pdf`）が
   ダッシュボードからダウンロードできることを確認する
8. テストが終わったら、着信転送を必ずOFFに戻す（要件定義書.md セクション6-2
   の注意書きの通り、転送中は自分の端末に着信が表示されない）

## 5. テスト時のコスト目安

要件定義書.md セクション7の通り、テスト通話1本ごとにTwilio（着信転送・音声
認識）とAnthropic Claude APIの両方が課金される。`MAX_TURNS = 40` の上限は
あるが、短時間（1〜2往復）で切ってテストすれば費用は小さく抑えられる。
