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

## APIバージョニング

- ベースパスは`/api/v1`。
- MVP中の破壊的変更はOpenAPIとフロント・バックを同じ変更単位で更新する。
- リリース後の破壊的変更は`/api/v2`を追加し、`v1`を即時削除しない。
