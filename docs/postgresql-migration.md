# PostgreSQL移行・運用方針

## 正本

- データモデルの正本は`prisma/schema.prisma`とする。
- DB変更履歴の正本は`prisma/migrations`とする。
- `docs/database-schema.sql`は最新のPostgreSQL参照DDLとし、CIで初期migrationとの一致を検証する。
- 共有DB、CI、本番環境では`prisma migrate deploy`を使う。`prisma db push`で共有DBを変更しない。

## 新規環境のセットアップ

1. PostgreSQL 16またはNeonで空のデータベースを作成する。
2. `.env.example`を`.env`へコピーし、`DATABASE_URL`を対象DBの接続URLへ変更する。
3. 次を実行する。

```powershell
npm.cmd ci
npm.cmd run prisma:generate
npm.cmd run db:migrate:deploy
```

Neonではmigration実行時に直接接続URLを使用する。接続URL、パスワード、バックアップをGitへコミットしない。

## 開発時のschema変更

1. `prisma/schema.prisma`を変更する。
2. 開発専用DBに対して`npm.cmd run db:migrate:dev -- --name <変更名>`を実行する。
3. 生成されたmigration、Prisma Client、`docs/database-schema.sql`、関連設計書を同じPRへ含める。
4. 空のPostgreSQLへ`npm.cmd run db:migrate:deploy`を実行し、`npm.cmd run test:ci`と`npm.cmd run build`を確認する。

適用済みmigrationを編集・削除しない。修正は新しいmigrationとして追加する。

## 既存SQLiteデータ

既存のSQLite DBはハッカソン開発用データとして扱い、自動移行しない。PostgreSQL切替時の既定方針は「新しい空DBから開始」です。

保持が必要なSQLite DBがある場合は、切替前にファイルをバックアップし、次を満たす個別ETLとして扱う。

- PostgreSQL migration適用後に投入する。
- UUID、日時、Boolean、JSON、enumをPostgreSQL型へ明示的に変換する。
- Google認証後の正しい`user_id`へ所有データを対応付ける。
- テーブルごとの件数、外部キー、ユーザー間データ分離を検証する。
- 元SQLite DBは検証完了まで読み取り専用バックアップとして保持する。

このリポジトリは汎用SQLite→PostgreSQL移行スクリプトを提供しない。ユーザー所有者を推測して自動対応付けする処理は禁止する。

## デプロイとロールバック

デプロイ順序は「DBバックアップ → `prisma migrate deploy` → アプリ更新」とする。migration失敗時はアプリを更新せず、ログを確認して修正migrationを作成する。

Prisma migrationは前進適用を基本とする。データ破壊を伴う変更から戻す必要がある場合は、DBサービスのバックアップから復元し、アプリを対応する以前のcommitへ戻す。

## デモデータ

`npm.cmd run seed:dashboard-demo`は、Googleログイン済みの対象ユーザーだけへ総合プロフィールを追加する。実行前に`.env`の`DEMO_USER_EMAIL`へ対象メールアドレスを設定する。対象プロフィールが既にある場合は上書きしない。
