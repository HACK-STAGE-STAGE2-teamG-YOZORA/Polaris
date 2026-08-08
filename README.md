# Polaris

根拠付き自己分析と、確認済みの経験・企業情報だけを使うES推敲を行う、ローカルAI就活支援アプリです。

実装前に[設計ドキュメント](./docs/README.md)と[OpenAPI仕様](./docs/openapi.yaml)を確認してください。

現在は、LM Studioを使うAI Adapter、Next.js Route Handler、Prisma／SQLite永続化まで実装されています。画面は統合途中です。

## 現在動くもの

- 一問ずつ深掘りする自己分析チャット
- 会話からの経験カード抽出
- 抽出内容が本人の明示発言かを再検査する推測防止処理
- 確認済み経験からのCAN／WANT／ENERGY／CONTEXT仮説生成
- 本人経験・企業事実に基づくES検査、推敲、再検査
- AI出力のJSON Schema、参照ID、引用原文の検証
- `/api/v1`の自己分析、経験、4軸、総合プロフィール、ES検査・推敲API
- Prisma／SQLiteによるセッション、根拠、分析結果の永続化
- Google OAuth 2.0／OpenID Connectによるログイン・新規登録・ログアウトAPI

## 初回セットアップ

```powershell
npm.cmd install
Copy-Item .env.example .env
npm.cmd run prisma:generate
npm.cmd run db:push
```

`.env`の`LM_STUDIO_MODEL_ID`は、LM Studioで実際にロードするモデルIDと一致させてください。SQLiteの保存先を変更しない場合、`DATABASE_URL`は`.env.example`の既定値を使用できます。

### Google認証の設定

Google Cloud ConsoleでWebアプリケーション用のOAuthクライアントを作成し、承認済みリダイレクトURIへ次を完全一致で登録します。

```text
http://localhost:3000/api/v1/auth/google/callback
```

`.env`の`GOOGLE_OAUTH_CLIENT_ID`と`GOOGLE_OAUTH_CLIENT_SECRET`へ発行値を設定してください。`APP_URL`を変更した場合は、同じオリジンの`/api/v1/auth/google/callback`をGoogle側にも登録します。未設定時は既存P0機能を停止せず、認証開始APIだけが`AUTH_NOT_CONFIGURED`を返します。

ログイン開始は`GET /api/v1/auth/google/start`、状態確認は`GET /api/v1/auth/session`、ログアウトは`POST /api/v1/auth/logout`です。Systemと認証開始・コールバック以外のAPIはログイン必須で、自己分析・経験・総合プロフィール・企業・ES・企業提案は認証ユーザーごとに分離されます。

## CI

`develop`または`main`へのPull Requestとpushで、GitHub Actionsが次を自動実行します。

```powershell
npm.cmd run test:ci
npm.cmd run build
```

`test:ci`は、型検査、OpenAPI／Prisma／Route／主要APIレスポンスの契約検査、PNG/PDF/OCR、AI入力上限、loopback限定、AI出力スキーマ、AI安定化、P1ユニットテストをまとめたLM Studio不要の検査です。実モデルを使うE2E・エラー・安定性テストはCIに含めず、LM Studioを起動した開発PCで実行します。

## LM Studioで試す

前提:

1. LM StudioのLocal Serverを`http://127.0.0.1:1234`で起動する。
2. `.env`の`LM_STUDIO_MODEL_ID`と同じモデルをロードする。
3. 現在の推奨は`qwen/qwen3.5-9b`。

対話型の自己分析CLI:

```powershell
npm.cmd run self-analysis
```

会話中のコマンド:

- `/card`: 現在の会話から本人確認前の経験カード案を作る
- `/retry`: AI出力の検証に失敗した場合、会話を保持したまま再試行する
- `/quit`: 終了する

実機テスト:

```powershell
npm.cmd run typecheck
npm.cmd run test:contracts
npm.cmd run test:ai-schema
npm.cmd run test:self-analysis-ai
npm.cmd run test:career-ai
npm.cmd run test:ai-p0
```

`test:ai-p0`は、一時SQLite DBと一時ポートのNext.jsサーバーを自動作成し、次をHTTP経由で検証して終了時に削除します。

- 自己分析チャット、冪等再送、経験抽出・確認、追加回答後の再分析、4軸生成・本人評価、レポート確定、複数セッション総合分析
- 経験0件の根拠不足結果、ADR-032のデータ不足／十分状態
- 企業公式情報付きES原文検査、完成版生成、推敲後の独立再検査、提出可能状態
- `AI_TIMEOUT`、`AI_INVALID_OUTPUT`、`AI_UNAVAILABLE`と、失敗時に部分データを保存しないこと

AI Adapterは[`src/infrastructure/ai`](./src/infrastructure/ai/)にあり、Web実装時はRoute Handlerから直接プロンプトを呼ばず、`LmStudioPolarisAiGateway`をApplication Service経由で利用します。
