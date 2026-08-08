# 画面・API対応表

## 1. 画面一覧

| 画面 | 主目的 | 使用API | 優先度 |
|---|---|---|---|
| 起動確認 | DB・LM Studio状態と復旧案内 | `GET /system/health`, `GET /system/lm-studio` | P0 |
| ホーム | 進行中セッション、全履歴からの総合4軸傾向、強み、弱み、データ量、保存済みESを表示 | `GET /dashboard`, `POST /overall-self-analysis/recompute` | P0 |
| チャット開始選択 | 初回開始、続きから、初めから | `GET /analysis-sessions/current`, `POST /analysis-sessions` | P0 |
| 自己分析チャット | 経験を一つずつ深掘りし、終了候補を案内 | `GET/POST /analysis-sessions/{id}/messages` | P0 |
| 終了確認 | 自動終了せず、本人確認後にそのセッション固有の4軸分析とレポートを1件作成 | `POST /analysis-sessions/{id}/axis-assessments/generate`, `POST /analysis-sessions/{id}/finalize` | P0 |
| 経験カード確認 | AI抽出結果を本人が修正・確認 | `POST /analysis-sessions/{id}/experience-drafts`, `PATCH /experiences/{id}` | P0 |
| 経験一覧 | 確認済み／下書きの管理 | `GET /experiences`, `GET/PATCH/DELETE /experiences/{id}` | P0 |
| セッション4軸結果 | そのチャットの軸位置、コメント、左右・状況別根拠、本人評価 | `GET /axis-assessments`, `PATCH /axis-assessments/{id}`, `GET /self-analysis-reports/{id}` | P0 |
| 企業情報 | 任意の企業、出典、抽出事実を確認 | `GET/POST /companies`, `POST /companies/{id}/sources/text` | P0任意 |
| ES入力 | 文章貼り付け、PNG/JPEG画像、PDFから原文を入力し、抽出文を確認後に設問・文字数・任意の企業・経験と保存 | `POST /es-text-extractions`, `GET/POST /es-documents`, `GET/PATCH /es-documents/{id}` | P0 |
| ES検査結果 | 主張の根拠状態、問題箇所、コメントを表示 | `POST /es-documents/{id}/analyses` | P0 |
| ES完成版 | そのまま提出可能な品質を目標にしたES案と、その下の根拠状態・問題箇所・改善理由コメントを表示 | `POST /es-documents/{id}/revisions`, `POST /es-revisions/{id}/verify` | P0 |
| Googleログイン | Google認証、新規登録、ログイン状態確認、ログアウト | `GET /auth/google/start`, `GET /auth/google/callback`, `GET /auth/session`, `POST /auth/logout` | P1 |
| 企業提案 | 登録企業の公式情報に基づく本命／挑戦／意外枠 | `POST /company-recommendation-runs`, `GET /company-recommendation-runs/{id}` | P1 |
| 面接準備 | 確認済み経験の深掘り質問と、公式企業情報に基づく逆質問 | `POST /interview-questions/generate` | P1 |

パス表記では共通の`/api/v1`を省略している。

起動確認とGoogle認証開始・コールバックを除く画面APIはログイン必須である。`GET /auth/session`が未認証を返した場合、個人データ画面を描画せずGoogleログイン画面へ案内する。

## 2. ホーム表示状態

| 状態 | 表示 |
|---|---|
| 自己分析未開始 | 「まずは自己分析を始めましょう」と開始ボタン |
| 進行中セッションあり | 「続きから」と「初めから」を表示 |
| 総合プロフィールあり | 全セッションから再計算した4軸、要約、強み、弱み・注意点を表示 |
| データが少ない | 完了セッション数・USER発言数・確認済み経験数と注意文を表示。結果自体は隠さない |
| 総合プロフィールが古い | `STALE`と再集計ボタンを表示。過去セッション一覧は表示しない |
| ES下書きあり | 設問、保存日時、`DRAFT/ANALYZED/REVISED/VERIFIED`を表示 |

「初めから」は進行中セッションを`ABANDONED`にするが、確認済み経験、完了済みレポート、ESを削除しない。

## 3. 画面で必ず区別する状態

### 自己分析セッション

- `ACTIVE`: 会話中。「続きから」で再開できる。
- `READY_TO_FINALIZE`: USER回答1件以上、4軸分析済み、4軸すべて本人評価済み。確認済み経験が0件でも進めるが、根拠不足を表示する。
- `COMPLETED`: finalize済み。ホーム総合プロフィールとES生成の内部入力に使用する。
- `ABANDONED`: 「初めから」により中断。通常の再開候補には出さない。

### 経験

- `DRAFT`: AIの案。正式根拠には使えない。
- `CONFIRMED`: 本人が確認済み。4軸分析とES根拠に使用可能。

### 4軸の位置

- `LEFT`
- `LEANS_LEFT`
- `BALANCED_OR_BOTH`
- `LEANS_RIGHT`
- `RIGHT`
- `CONTEXT_DEPENDENT`
- `INSUFFICIENT_EVIDENCE`

左右に優劣を付けず、数値能力スコアへ変換しない。軸名に応じてLEFT／RIGHTをFocus／Connect等の表示名へ変換する。

グラフ上の`LEFT`、`LEANS_LEFT`、`BALANCED_OR_BOTH`、`LEANS_RIGHT`、`RIGHT`は、順番を表す固定位置へ置く。座標値はレイアウト専用でAPI・DB・画面文言に点数として出さない。`CONTEXT_DEPENDENT`は中央点へ潰さず、両側マーカーまたは状況依存ラベルで表す。`INSUFFICIENT_EVIDENCE`は位置を描かず、根拠不足と表示する。

### 4軸の根拠状態

- `CONFIRMED_PATTERN`: 確認済み根拠があり、本人が傾向を確認した。経験数の多さは別表示する。
- `CURRENT_HYPOTHESIS`: 根拠が少ない、矛盾がある、または本人確認が不足。
- `INSUFFICIENT_EVIDENCE`: 判断材料不足。

### ES主張

- `VERIFIED`: 「確認済み」とテキスト表示。
- `PARTIALLY_VERIFIED`: どこまで確認できたか表示。
- `NEEDS_CONFIRMATION`: ユーザーへの確認事項を表示。
- `CONTRADICTED`: 登録情報と違う箇所を表示。

ESは総合点を表示せず、設問回答状況、文字数、主張ごとの根拠状態、問題箇所、改善コメントで説明する。

完成版ES案は、全履歴を候補として参照した上で設問に関連する経験を選ぶ。再検査後、設問回答・文字数・根拠を満たした場合は`READY_TO_SUBMIT`、それ以外は`NEEDS_REVIEW`を表示する。AIコメントは完成版本文の下へ、根拠状態、問題箇所、改善理由の順で表示する。

## 4. チャット終了UI

- 初回説明に「終了したい時は、終了したいと入力するか終了ボタンを押してください」と表示する。
- AIが終了意図を検出した場合は`completionIntent=SUGGESTED`を受け取る。
- 検出だけではセッション状態を変更しない。
- 「ここまでの内容で分析結果を作りますか？」を表示する。
- 根拠不足でも結果生成を禁止せず、不足している軸・経験数と「続ける／この内容で結果を見る」を表示する。
- 確定操作後だけfinalize APIを呼ぶ。

## 5. 主要ローディング・失敗UI

| 状況 | UI |
|---|---|
| AI処理中 | 二重送信不可にし、処理名と経過表示 |
| ES文字抽出中 | ファイル名をログへ出さず、ページ処理中であることを表示して二重送信を防ぐ |
| ES文字抽出完了 | 抽出文を編集可能な入力欄へ表示し、「内容を確認して保存してください」と明示 |
| ES文字抽出失敗 | 選択済みファイルを勝手に再送せず、形式・10MB・PDF 10ページ・パスワード有無を確認する案内を表示 |
| `AI_UNAVAILABLE` | LM Studio起動、Developer画面、Local Server、モデルロードの4手順 |
| `AI_TIMEOUT` | 入力を保持し「再試行」。自動連打しない |
| `AI_INVALID_OUTPUT` | 入力を保持し、出力を保存せず再試行可能 |
| `VALIDATION_ERROR` | `details[].field`を入力欄へ対応づける |
| `CONFLICT` | 既存の進行中セッションや状態不一致を説明する |
| `STALE` | 古い結果であることを表示し、総合プロフィール再集計／ES再検査ボタン |
| データ不足 | 「※データが少ないため、今後結果が変わる可能性があります」と件数を表示 |
| 指摘範囲を特定できない | 原文ハイライトなしで対象文とコメントを表示 |

完成版ES案はコピー可能な文章として表示する。画像化・PDF出力ボタンはP0へ含めない。

## 6. 代表デモデータ

- 経験1: 一人で設計へ集中し、理解が深まることに満足した経験
- 経験2: チームで小さく試し、利用者の反応から元気を得た経験
- 経験3: 変化へ対応して成果は出たが、曖昧さで消耗した経験
- 4軸結果: 一方へ寄る軸、両方の軸、状況依存の軸、根拠不足の軸を含む
- ES入力ファイル: 同じ架空ES本文を含むPNG、文字PDF、画像PDFの3種類
- ES原文: 確認済み数字1件、未確認の役割1件、抽象表現1件を含む
- 企業情報を使うデモでは、架空企業の出典付き事実だけを使用する

fixtureは実在人物・実在企業の機微情報を使わない。
