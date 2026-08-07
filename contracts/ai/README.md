# AI structured-output contracts

LM Studioへ構造化出力を要求する各タスクのJSON Schema。AI担当とバックエンド担当の境界として使用する。

| タスク | Schema |
|---|---|
| 自己分析チャット | `chat-turn-output.schema.json` |
| 経験カード抽出 | `experience-draft-output.schema.json` |
| 経験カードの推測検査 | `experience-grounding-output.schema.json` |
| 独自4軸の分析生成 | `hypotheses-output.schema.json`（既存互換のためファイル名維持） |
| 自己分析レポート文生成 | `career-report-output.schema.json`（既存互換のためファイル名維持） |
| 全セッションからのホーム総合傾向・強み・弱み生成 | `overall-self-analysis-output.schema.json` |
| 企業情報抽出 | `company-facts-output.schema.json` |
| 根拠付き企業提案 | `company-recommendations-output.schema.json` |
| ES主張・問題点抽出 | `es-analysis-output.schema.json` |
| ES推敲 | `es-revision-output.schema.json` |

ルール:

- すべてのSchemaはJSON Schema Draft 2020-12。
- 出力はJSONオブジェクト1個だけとし、Markdownコードフェンスを付けない。
- `additionalProperties: false`。Schema外の補足文は禁止。
- AIがIDを新規発行しない。入力された参照IDだけを返す。
- バックエンドは構文検証に加え、ID存在、引用一致、業務ルールを再検証する。
- `common.schema.json`は共有定義であり、単独のAI出力には使用しない。
- 4軸は強制二択にせず、`BALANCED_OR_BOTH`、`CONTEXT_DEPENDENT`、`INSUFFICIENT_EVIDENCE`を許可する。
- `completionIntent=SUGGESTED`は終了候補であり、バックエンドは本人確認なしでセッションを完了しない。
- セッション結果は対象セッションだけ、ホーム総合傾向とESは全完了セッションを入力範囲とする。
- ホーム総合傾向は軸位置を数値平均せず、全正式根拠から再判定する。
