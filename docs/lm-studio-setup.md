# LM Studio セットアップ（デモPC）

この設定は2026-08-02時点のデモPCを対象とする。

- CPU: AMD Ryzen 9 9900X
- RAM: DDR5 64GB
- GPU: AMD Radeon RX 7800 XT
- VRAM: 16GB想定
- OS: Windows

## 1. 最初に使うモデル

推奨モデル:

```text
qwen/qwen3.5-9b
形式: GGUF
量子化: Q4_K_M
```

LM Studioカタログ上のQwen3.5 9Bは約7GBで、201言語対応、reasoning対応、最大262,144トークンのモデルである。
16GB VRAMのデモ機では、モデル本体と16Kコンテキスト用キャッシュをGPUへ載せやすい。
モデルカード上のライセンスはApache 2.0。公開・デモ前にもダウンロードしたrevisionのライセンス表示を確認する。

27B版は約17GBでVRAM容量を超えやすいため、デモの標準モデルにしない。64GB RAMを使った一部CPU実行は可能でも、応答速度の再現性が落ちる。

代替モデル:

```text
qwen/qwen3-14b
形式: GGUF
量子化: Q4_K_M
```

Qwen3.5固有のランタイム問題が発生した場合だけ比較する。モデルIDは環境変数で切り替え、アプリコードへ直書きしない。

参考:

- https://lmstudio.ai/models/qwen/qwen3.5-9b
- https://lmstudio.ai/docs/app/system-requirements
- https://lmstudio.ai/docs/developer
- https://lmstudio.ai/docs/typescript/llm-prediction/structured-response

## 2. インストールとモデル取得

1. LM Studioの最新安定版をインストールする。
2. `Discover`を開く。
3. `qwen/qwen3.5-9b`を検索する。
4. GGUFの`Q4_K_M`を選んでダウンロードする。
5. `My Models`でダウンロード済みモデルを確認する。

Windows + AMDでは、LM Studioが対応ランタイムとGPU offloadを管理する。GPUが認識されない場合は、LM StudioとAMDドライバを更新し、`Ctrl+Shift+H`のGPU設定でRX 7800 XTが有効か確認する。

## 3. 初期ロード設定

| 設定 | 初期値 | 理由 |
|---|---:|---|
| Context Length | 16,384 | チャット履歴・企業情報・ESを扱いつつVRAMを確保 |
| GPU Offload | Max | 可能な限りRX 7800 XTへ載せる |
| Flash Attention | On | 対応時のメモリと速度を改善 |
| Offload KV Cache to GPU | On | 16KではVRAMに余裕がある想定 |
| Enable Thinking | Off | 抽出・JSON生成の速度と再現性を優先 |

初回ロード前に、LM Studioの見積もり表示または次のCLIでメモリを確認する。

```powershell
lms load --estimate-only qwen/qwen3.5-9b --context-length 16384 --gpu max
```

見積もりがVRAM上限へ近い、またはロードに失敗する場合は次の順で下げる。

1. Context Lengthを8,192へ下げる。
2. KV cacheのGPU offloadをオフにする。
3. GPU offloadをAutoへ戻す。

## 4. Local Server

1. `Developer`画面を開く。
2. Qwen3.5 9Bをロードする。
3. Portを`1234`にする。
4. `Serve on Local Network`をオフにする。
5. Local Serverを開始する。

標準URL:

```text
http://127.0.0.1:1234
```

アプリの`GET /api/v1/system/lm-studio`で`CONNECTED`とモデルIDを確認する。

## 5. タスク別推論設定

| タスク | Temperature | Thinking | 最大出力 |
|---|---:|---|---:|
| 自己分析の自然な質問 | 0.6 | Off | 1,200 tokens |
| 経験・仮説・企業事実抽出 | 0.1 | Off | 4,096 tokens |
| ES主張検査 | 0.1 | Off | 4,096 tokens |
| ES推敲 | 0.3 | Off | 4,096 tokens |

構造化出力では必ず`maxTokens`を指定する。出力上限到達で中断したJSONは不正結果として破棄する。

現在の既定値は`.env.example`の`AI_CHAT_MAX_TOKENS=1200`と`AI_MAX_OUTPUT_TOKENS=4096`で管理する。

## 6. 採用前評価

`qwen/qwen3.5-9b`を確定する前に、チームのfixtureで次を各5回実行する。

- 日本語の深掘り質問が一度に一問だけになる。
- 8種類のAI出力JSON Schemaへ適合する。
- 入力にない数字・役割・成果を追加しない。
- 引用が元の日本語発言と一致する。
- 文中の英語製品名・技術用語・コード識別子を壊さない。
- 企業ページ内の命令文をシステム指示として実行しない。
- チャット60秒、ES処理120秒以内に終わる。

失敗率が高い場合は、先にプロンプトとSchemaを小さくする。それでも改善しない場合だけQwen3 14Bと比較する。
