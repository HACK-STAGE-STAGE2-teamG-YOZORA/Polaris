# Polaris 設計ドキュメント

このディレクトリを、フロント・バックエンド・AI担当が共有する仕様の正本とする。
実装と仕様が食い違った場合は、コードだけを直さず、該当ドキュメントも同じPRで更新する。

## 最初に読む順番

1. [product-scope.md](./product-scope.md) — MVPの目的、対象、完成条件
2. [architecture.md](./architecture.md) — システム構成、担当境界、主要シーケンス
3. [lm-studio-setup.md](./lm-studio-setup.md) — デモPC向けモデルと初心者用セットアップ
4. [domain-model.md](./domain-model.md) — 用語、状態遷移、データ関係、業務ルール
5. [openapi.yaml](./openapi.yaml) — フロントエンドとバックエンド間のHTTP契約
6. [ai-contracts.md](./ai-contracts.md) — バックエンドとAI処理間の契約
7. [screen-api-map.md](./screen-api-map.md) — 画面、担当、API、必須状態の対応
8. [implementation-rules.md](./implementation-rules.md) — エラー、文字数、日時、セキュリティ、テスト規約
9. [decisions.md](./decisions.md) — 決定事項と、チームで回答が必要な未決事項
10. [postgresql-migration.md](./postgresql-migration.md) — PostgreSQLセットアップ、migration、SQLiteデータ方針

AIの構造化出力用JSON Schemaは[`contracts/ai`](../contracts/ai/)に置く。
企業提案候補の共有形式は[`contracts/company-catalog.schema.json`](../contracts/company-catalog.schema.json)、
開発例は[`fixtures/company-catalog.example.json`](../fixtures/company-catalog.example.json)を使用する。

## 仕様の優先順位

矛盾がある場合は、次の順で判断する。

1. `docs/decisions.md`の`Accepted`になったADR
2. `docs/openapi.yaml`
3. `contracts/ai/*.schema.json`
4. `docs/domain-model.md`
5. その他の説明資料

矛盾を見つけた人は、独自解釈で実装を進めずIssueまたはチームチャットへ共有する。

## Swaggerの表示

Swagger Editorへ`docs/openapi.yaml`を貼り付けるか、Swagger UIをローカルで起動して確認する。
実装開始後は、OpenAPIから型を生成するか、少なくともCIで構文検証する。

例（パッケージ導入後）:

```powershell
npx @redocly/cli lint docs/openapi.yaml
```

`redocly.yaml`では、localhost専用MVPと、4xxを持たない読み取り専用エンドポイントに関する2ルールだけを理由付きで除外している。

## 現在の検証コマンド

次のコマンドは現在のリポジトリで実行できる。`test:ai-p0`はLM Studioで`.env`と同じモデルをロードしてから実行する。

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:scripts
npm.cmd run test:contracts
npm.cmd run test:ai-schema
npm.cmd run test:ai-p0
```

- `test:contracts`: AI JSON Schema、OpenAPI完全parse・内部参照、P0 Route対応、代表レスポンス、PostgreSQL DDLとPrisma migrationの一致を検証する。
- `test:ai-schema`: LM Studio向けに簡略化した生成Schemaが、出力フィールド名を削除していないことを検証する。
- `test:ai-p0`: 一時PostgreSQL schemaと一時Next.jsサーバーを使い、複数セッションの自己分析、企業根拠付きES、再検査、提出可否までとAI異常系をHTTP経由で検証する。全レスポンスをOpenAPIへ照合し、既存の開発schemaは変更しない。

Redocly CLIによるlintは追加の任意検証であり、現在の`package.json`には依存関係として固定していない。

## APIバージョニング

- ベースパスは`/api/v1`。
- MVP中の破壊的変更はOpenAPIとフロント・バックを同じ変更単位で更新する。
- リリース後の破壊的変更は`/api/v2`を追加し、`v1`を即時削除しない。
