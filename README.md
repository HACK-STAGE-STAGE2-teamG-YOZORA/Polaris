# Polaris

根拠付き自己分析と、確認済みの経験・企業情報だけを使うES推敲を行う、ローカルAI就活支援アプリです。

実装前に[設計ドキュメント](./docs/README.md)と[OpenAPI仕様](./docs/openapi.yaml)を確認してください。

現在は、LM Studioを使うAIコアの最初の縦方向実装まで動作します。Next.js画面、API、DB永続化は未実装です。

## 現在動くもの

- 一問ずつ深掘りする自己分析チャット
- 会話からの経験カード抽出
- 抽出内容が本人の明示発言かを再検査する推測防止処理
- 確認済み経験からのCAN／WANT／ENERGY／CONTEXT仮説生成
- 本人経験・企業事実に基づくES検査、推敲、再検査
- AI出力のJSON Schema、参照ID、引用原文の検証

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
- `/quit`: 終了する

実機テスト:

```powershell
npm.cmd run typecheck
npm.cmd run test:self-analysis-ai
npm.cmd run test:career-ai
```

AI Adapterは[`src/infrastructure/ai`](./src/infrastructure/ai/)にあり、Web実装時はRoute Handlerから直接プロンプトを呼ばず、`LmStudioPolarisAiGateway`をApplication Service経由で利用します。
