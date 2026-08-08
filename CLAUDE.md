# Claude 行動ルール

- 回答・コードコメントは日本語で書く。
- 実装前に必ずこのファイルと `docs/README.md` を読み、設計書を正本として扱う。
- 設計書とコードが矛盾する場合、独自解釈で進めず、該当ドキュメントとコードを同じ変更単位で更新する。
- ユーザー指定がない限り、作業は `develop` から `feature/` ブランチを切って行う。
- 既存の未コミット変更を破棄・上書きしない。変更範囲を確認してから編集する。
- 認証・ユーザーごとのデータ分離・秘密情報・外部公開設定を変更するときは、影響範囲を確認する。
- APIはOpenAPI、AI出力はJSON Schema、DBはPrisma schema／migrationと一致させる。
- 実装後は、変更に応じて型検査、関連テスト、`npm.cmd run build`を実行する。
- PR作成時は、変更内容・設計書への準拠・検証結果・既知の制約を日本語で記載する。
- `git reset --hard`、広範囲削除、秘密情報のコミットを行わない。

# 設計書目次

入口：[docs/README.md](docs/README.md)

読む順番：

1. [product-scope.md](docs/product-scope.md)：MVPの目的・完成条件
2. [architecture.md](docs/architecture.md)：システム構成・担当境界
3. [lm-studio-setup.md](docs/lm-studio-setup.md)：AI実行環境・デモ手順
4. [domain-model.md](docs/domain-model.md)：用語・状態遷移・業務ルール
5. [openapi.yaml](docs/openapi.yaml)：フロント／バックエンド間のAPI正本
6. [ai-contracts.md](docs/ai-contracts.md)：バックエンド／AI間の契約
7. [screen-api-map.md](docs/screen-api-map.md)：画面・API・必須状態・担当
8. [implementation-rules.md](docs/implementation-rules.md)：エラー・認証・セキュリティ・テスト規約
9. [decisions.md](docs/decisions.md)：Accepted済みADRと未決事項
10. [postgresql-migration.md](docs/postgresql-migration.md)：PostgreSQL・Prisma Migrate方針

AIのJSON Schema：[contracts/ai](contracts/ai/)
企業カタログ契約：[contracts/company-catalog.schema.json](contracts/company-catalog.schema.json)

仕様の優先順位：

1. `docs/decisions.md` の Accepted ADR
2. `docs/openapi.yaml`
3. `contracts/ai/*.schema.json`
4. `docs/domain-model.md`
5. その他の説明資料

# 標準検証

```powershell
npm.cmd run typecheck
npm.cmd run typecheck:scripts
npm.cmd run test:contracts
npm.cmd run test:ci
npm.cmd run build
```

AI実モデルを使う検証は、LM Studioを起動し、`.env`を設定してから実行する。

# 作業引き継ぎ (2026-08-09時点)

## これまでの経緯
- PR #33, #35, #36 は develop にマージ済み。P0未実装画面、複数セッション同時進行、
  経験カードUX改善、AI出力の内部情報漏洩対策などを実装済み。
- 現在 develop ブランチ、作業ツリーはクリーン。次のバグ修正は新ブランチを
  develop から切って着手すること（ユーザー指示）。

## 未着手: ユーザー報告の5件のバグ修正

### 1. 【原因判明・要修正】finalize時に「4軸を生成し、すべて本人評価してから確定してください」エラー
根拠不足(INSUFFICIENT_EVIDENCE)の軸は4択を非表示にした(PR #36)が、
`src/app/api/v1/axis-assessments/[axisAssessmentId]/route.ts` の中の
`remaining`(UNREVIEWED件数)カウントが INSUFFICIENT_EVIDENCE を除外していないため、
根拠不足の軸が1つでもあると永遠に `remaining > 0` のままで、セッションが
`READY_TO_FINALIZE` に遷移しない。finalize route側は既に除外済み(PR #36)なので、
このPATCH routeの `remaining` カウントにも `status !== 'INSUFFICIENT_EVIDENCE'` の
条件を追加すればよい(finalize routeの実装と揃える)。

### 2. 完了済みセッションにも「続きから」ボタンを追加したい
現状「結果を見る」のみ。バックエンドの `POST .../messages` はCOMPLETEDセッションへの
送信を409で拒否しており、finalizeも「既にレポートがある」場合409を返す。
完了後に会話を再開できるようにするには、①COMPLETEDセッションへのメッセージ送信を
許可するかセッションをACTIVEへ戻す仕組み、②再finalize時に既存レポートを
上書き/新版扱いにするロジック、の設計が必要(バックエンド設計変更)。

### 3. 軸ラベルの文字色が見にくい
`src/app/components/AxisPositionBar.tsx` の `label.left`/`leftJa`/`right`/`rightJa`
のTypographyに明示的な色指定がない。黄色文字(`CHAT_COLORS.orange`)を追加する。

### 4. 経験カード編集フォームが常に画面最上部に出る
`src/app/(screens)/experiences/page.tsx` で `editing` フォームが
Stack先頭に固定表示されている。クリックしたカードのすぐ上/位置に出るよう、
一覧描画(sortedItemsのmapとsessionGroupsのmapの両方)の中で
該当experienceの直前にフォームを差し込む形に変更する。

### 5. AI生成文に生ID・内部値が混入(未確認: 既存データの可能性)
「セッション（b337858c...）」「エネルギーの増加（+2）」等。
PR #36 で `src/infrastructure/ai/prompts.ts` の `sharedSafetyRules` に
禁止ルールを追加済みだが、**既存DBレコード(過去生成済みのレポート等)には遡って
適用されない**。ユーザーには「既存データの可能性がある」と伝え済み。
確認方法: 新規にセッションをfinalizeし直す/総合プロフィールをrecomputeして、
新しく生成された文章に同じ問題が出るか確認する。もし新規生成でも出るなら
プロンプトの効き目が弱い(ルールの書き方を強化する必要あり)。

## 次にやること
1. develop から新ブランチを作成(例: `feature/fix-finalize-and-ui-issues`)
2. 上記1〜4を実装、5は新規生成で再現するか確認してから対応方針を決める
3. `npm run test:ci` と `next build` で確認
4. PRを作成
