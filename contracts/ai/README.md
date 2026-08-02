# AI structured-output contracts

LM Studioへ構造化出力を要求する各タスクのJSON Schema。AI担当とバックエンド担当の境界として使用する。

| タスク | Schema |
|---|---|
| 自己分析チャット | `chat-turn-output.schema.json` |
| 経験カード抽出 | `experience-draft-output.schema.json` |
| 4領域の仮説生成 | `hypotheses-output.schema.json` |
| キャリアレポート文生成 | `career-report-output.schema.json` |
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
