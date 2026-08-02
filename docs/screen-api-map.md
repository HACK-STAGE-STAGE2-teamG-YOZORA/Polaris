# 画面・API対応表

## 1. 画面一覧

| 画面 | 担当目安 | 主目的 | 使用API |
|---|---|---|---|
| 起動確認 | フロントA | DB・LM Studio状態と復旧案内 | `GET /system/health`, `GET /system/lm-studio` |
| 自己分析チャット | フロントA | 経験を一つずつ深掘り | `POST /analysis-sessions`, `GET/POST /analysis-sessions/{id}/messages` |
| 経験カード確認 | フロントA | AI抽出結果を本人が修正・確認 | `POST /analysis-sessions/{id}/experience-drafts`, `PATCH /experiences/{id}` |
| 経験一覧 | フロントA | 確認済み／下書きの管理 | `GET /experiences`, `GET/PATCH/DELETE /experiences/{id}` |
| キャリア仮説 | フロントB | 4領域、状態、根拠、本人評価 | `POST /analysis-sessions/{id}/hypotheses/generate`, `GET /hypotheses`, `PATCH /hypotheses/{id}` |
| キャリアレポート | フロントB | Must／Prefer／Avoid／Verifyを表示 | `POST /analysis-sessions/{id}/finalize`, `GET /career-report` |
| 企業情報 | フロントB | 企業、出典、抽出事実、不明点を確認 | `GET/POST /companies`, `POST /companies/{id}/sources/text` |
| 企業提案（P1） | フロントB | 登録済み10〜20社の公式URL取得と本命／挑戦／意外枠 | `POST /company-recommendation-runs`, `GET /company-recommendation-runs/{id}` |
| ES入力 | フロントB | 設問・文字数・原文・経験を選択 | `POST /es-documents`, `PATCH /es-documents/{id}` |
| ES検査 | フロントB | 主張ごとの根拠と問題を表示 | `POST /es-documents/{id}/analyses` |
| ES比較 | フロントB | 原文／推敲、理由、根拠、採否、再検査 | `POST /es-documents/{id}/revisions`, `PATCH /es-revisions/{id}/changes/{id}`, `POST /es-revisions/{id}/verify` |

パス表記では共通の`/api/v1`を省略している。

## 2. 画面で必ず区別する状態

### 経験

- `DRAFT`: AIの案。ES根拠には使えない。「確認する」導線を表示。
- `CONFIRMED`: 本人が確認済み。ES根拠として使用可能。

### 仮説

- `CONFIRMED_PATTERN`: 複数経験と本人確認がある。
- `CURRENT_HYPOTHESIS`: 根拠が少ない、反対根拠がある、または本人確認が不足。
- `INSUFFICIENT_EVIDENCE`: 判断材料不足。

「強み82点」のような数値へ置換しない。

### ES主張

- `VERIFIED`: 緑だけに頼らず「確認済み」とテキスト表示。
- `PARTIALLY_VERIFIED`: どこまで確認できたか表示。
- `NEEDS_CONFIRMATION`: ユーザーへ確認質問を表示。
- `CONTRADICTED`: 登録情報とどこが違うか表示。

## 3. 主要ローディング・失敗UI

| 状況 | UI |
|---|---|
| AI処理中 | 対象操作を二重送信不可にし、処理名と経過表示 |
| `AI_UNAVAILABLE` | LM Studio起動、Developer画面、Local Server、モデルロードの4手順 |
| `AI_TIMEOUT` | 入力を保持し「再試行」ボタン。自動連打しない |
| `AI_INVALID_OUTPUT` | 「AIの出力を読み取れませんでした」。入力を保持し再試行可能 |
| `VALIDATION_ERROR` | `details[].field`を入力欄へ対応づける |
| `STALE` | 古い結果であることを表示し、再生成／再検査ボタン |
| URL取得失敗 | 文章貼り付けへ切り替える導線 |

## 4. 代表デモデータ

全員が同じデモを動かせるよう、実装時に次のfixtureを用意する。

- 経験1: 学園祭の待ち時間改善（数字・工程分解・少人数チーム）
- 経験2: サークル新歓SNS改善（利用者反応・仮説検証）
- 経験3: 結果は出たが大人数調整で消耗した経験
- 企業情報: 公式採用文を模した架空企業。若手提案歓迎は明記、裁量範囲は不明
- ES原文: 確認済み数字1件、未確認の「リーダー」表現1件、企業情報の過剰断定1件を含む

fixtureは実在人物・実在企業の機微情報を使わない。
