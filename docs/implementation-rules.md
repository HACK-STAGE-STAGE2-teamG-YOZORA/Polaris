# 実装共通ルール

## 1. HTTPとJSON

- APIベースパスは`/api/v1`。
- JSONのキーは`camelCase`、DB列は`snake_case`。
- IDはUUID v4を基本とし、APIでは文字列として扱う。
- 日時は保存時UTC、APIはISO 8601の`date-time`。画面だけで端末ローカル時刻へ変換する。
- `completedAt`、`confirmedAt`、`companyId`、`targetRole`など、未設定自体に意味がある成功レスポンス項目は省略せず`null`を返し、OpenAPIでもnullableとして定義する。
- 成功レスポンスはリソースまたは`items`を直接返し、不要な`data`ラッパーを付けない。
- エラーは`application/problem+json`とし、OpenAPIの`ErrorResponse`を使う。
- `clientMessageId`付きチャット送信は冪等。同じIDの再送では同じ保存済み結果を返す。
- 4軸のAPI enumは`ENERGY_SOURCE`、`ACTION_STYLE`、`SATISFACTION_SOURCE`、`PREFERRED_ENVIRONMENT`を使う。画面表示名をDB値にしない。
- 文字範囲offsetはUnicodeコードポイント基準で、`startOffset`を含み`endOffset`を含まない。

## 2. 文字数

ES文字数はJavaScriptの次の結果を正とする。

```typescript
export function countEsCharacters(text: string): number {
  return [...text.replace(/\r\n?/g, "\n")].length;
}
```

- Unicodeコードポイントで数える。
- CRLF/CRをLFへ正規化する。
- 改行、空白、句読点も1文字として数える。
- 英字、製品名、技術用語、コード識別子を許可し、自動翻訳・削除しない。
- ES全体の基本言語は日本語とするが、文字種だけで入力を拒否しない。
- UTF-16の`.length`をそのまま使わない。
- 企業の入力フォームに別ルールが明記されている場合は、画面に注意を表示し手動確認を促す。

### 2.1 ES画像・PDFからの文字抽出

- P0で受け付けるMIME typeは`image/png`、`image/jpeg`、`application/pdf`だけとする。
- P0は1回1ファイル・1設問の回答本文として扱う。複数設問や複数画像は分けて登録する。
- 1ファイル10MB（10 × 1024 × 1024 bytes）以下、PDFは10ページ以下とする。
- 拡張子やブラウザ送信のContent-Typeだけを信用せず、ファイルシグネチャと実データを検査する。
- パスワード付き・暗号化PDF、破損ファイル、文字を抽出できないファイルは`422 VALIDATION_ERROR`とする。
- PDFは埋め込みテキストを先に抽出し、文字を取得できないページだけ日本語・英語のローカルOCRを行う。
- PNG/JPEGは日本語・英語のローカルOCRを行う。外部OCR APIへESを送信しない。
- 抽出文はCRLF/CRをLFへ正規化し、1〜20,000文字に収まる場合だけ返す。
- OCR・PDF抽出結果は必ず`requiresReview=true`とし、画面でユーザーが確認・修正するまで`originalText`として保存しない。
- アップロード元ファイル、中間画像、未確認の抽出文はDBへ保存しない。処理成功・失敗・タイムアウトのすべてで一時データを破棄する。
- AIによるES検査・添削へ渡すのは確認済み`originalText`だけとし、AIが返す完成版も文章の`revisedText`だけとする。

## 3. AI出力の扱い

全AI処理は次の順で行う。

1. 許可した入力だけでプロンプトを組み立てる。
2. JSON Schemaに従う構造化出力を要求する。
3. ZodまたはJSON Schema validatorで検証する。
4. 参照IDが入力集合に存在するか検査する。
5. 引用文が参照元原文に含まれるか、改行・連続空白の正規化後に検査する。
6. 決定的な業務ルールをTypeScriptで再計算する。
7. 全検査成功後だけDBへ保存する。

AI入力は`LM_STUDIO_CONTEXT_LENGTH`から出力トークンとJSON Schema分を予約し、入力上限を超えた状態でLM Studioを呼ばない。会話は最新ターン、ESはユーザー指定経験・設問との関連度・新しいレポートを優先する。候補から外した履歴をDBから削除しない。企業の長文原文は段落境界を優先して分割し、抽出結果を重複排除して統合する。

4軸分析では次も検証する。

- 軸とpoleの組み合わせが有効である。
- 片側の根拠がないことを反対側の根拠へ変換していない。
- `BALANCED_OR_BOTH`は左右両方の根拠、`CONTEXT_DEPENDENT`は状況差の根拠を持つ。
- `INSUFFICIENT_EVIDENCE`を無理に左右へ寄せない。
- AIが返したpositionとstatusを最終値として信用せず、TypeScriptの規則で再計算する。
- セッション結果の生成条件はUSERメッセージ1件以上とし、確認済み経験数ではブロックしない。

ホーム総合プロフィールでは次も検証する。

- 入力対象が`COMPLETED`セッション、各セッション1件のレポート、`CONFIRMED`経験に限定されている。
- セッション位置を数値へ変換して平均していない。
- 強み・弱み・注意点の全参照IDが入力集合に存在する。
- `completedSessionCount < 2`または`confirmedExperienceCount < 3`の場合に`isDataSparse=true`である。

終了意図は`completionIntent=SUGGESTED`として扱い、ユーザー確認前にセッションを完了しない。

出力が不正な場合は、検証エラーだけを示す修復プロンプトで最大1回再試行する。2回目も失敗した場合は`AI_INVALID_OUTPUT`とし、不正JSONや部分結果を保存しない。

## 4. プロンプトインジェクション対策

- ユーザー発言・企業ページ・ファイル内容はすべて「信頼できないデータ」と明示する。
- 取得コンテンツ内の命令、システムプロンプト要求、ツール実行要求を無視する。
- プロンプトへデータ区切りを入れ、システム指示と混ぜない。
- AIにURL取得、ファイルアクセス、コマンド実行機能を与えない。
- 出典テキストから抽出した事実は、原文引用と一致しない限り保存しない。

## 5. URL取得とSSRF対策

URL取り込みを実装する場合は、文字列のホスト名検査だけで済ませない。

- `http:`、`https:`以外を拒否。
- URL内ユーザー情報を拒否。
- DNS解決したすべてのIPを検査。
- loopback、private、link-local、multicast、unspecified、クラウドメタデータ宛てを拒否。
- 各リダイレクト先を再検査し、最大3回。
- 接続10秒、全体30秒でタイムアウト。
- Content-Lengthおよび実読込を2MBで打ち切る。
- `text/html`、`text/plain`、P2では許可したPDF/DOCXだけを受け入れる。
- HTMLのscript、style、noscript、navigation、広告要素を除去する。

## 6. ローカルデータとプライバシー

- SQLite DB、ログ、アップロード一時ファイルをGitへ含めない。
- 電話番号、詳細住所、生年月日、顔写真、マイナンバーを独立項目として収集・永続保存しない。ES画像/PDFに含まれる非テキスト情報も抽出対象・保存対象にしない。
- ESアップロードの元ファイル名、ファイル内容、抽出文をログへ出さない。MIME type、byte数、ページ数、処理時間、成否だけを記録する。
- ログへ会話全文・ES全文・企業取得原文を出さない。ID、処理時間、文字数、結果件数だけを基本とする。
- LM Studioは`http://127.0.0.1:<port>`へ限定し、設定読込時にも他ホスト・HTTPS・認証情報・追加パスを拒否する。`Serve on Local Network`はオフにする。
- `.env`をコミットせず、`.env.example`だけを共有する。

## 7. トランザクション

次の単位は同一DBトランザクションで保存する。

- ユーザーメッセージ、AIメッセージ、未確認の軸根拠候補
- 経験カード、経験引用、確認時に昇格する正式な軸根拠
- 経験の任意`sourceMessageId`と、指定時の同一セッションUSER発言チェック
- 4軸分析と軸根拠リンク
- 「初めから」選択時の旧セッション`ABANDONED`化と新規セッション作成
- finalize時のセッション完了と自己分析レポートスナップショット
- 企業出典と抽出した企業事実
- ES検査、主張、主張根拠
- ES推敲、変更、変更根拠

途中失敗した場合は全体をロールバックし、部分データを画面へ返さない。

ホーム総合プロフィールの再計算はfinalizeとは別処理にする。再計算に失敗しても完成済みセッションレポートを戻さず、以前の総合プロフィールを`STALE`にして再試行可能にする。

## 8. タイムアウトと再試行

| 処理 | 目安 | 再試行 |
|---|---:|---:|
| DB | 3秒 | なし |
| LM Studio接続確認 | 3秒 | なし |
| チャット | 60秒 | JSON修復のみ1回 |
| 経験抽出・4軸分析 | 90秒 | JSON修復のみ1回 |
| ES画像・PDF文字抽出 | 60秒 | 自動再送なし |
| ES検査・推敲 | 120秒 | JSON修復のみ1回 |
| URL取得 | 接続10秒・全体30秒 | なし |

同じ生成要求を無条件で再試行すると二重保存になるため、DB書き込み前後と冪等キーを明確にする。

## 9. テストの最低ライン

### 単体テスト

- ES文字数（日本語、絵文字、サロゲートペア、CRLF）
- ESファイルのMIME/シグネチャ、10MB、PDF 10ページ、暗号化、空抽出、抽出文正規化
- 4軸のposition・status判定
- 全セッション根拠からの総合4軸判定、データ不足判定、強み・弱みの参照ID検証
- セッションの初回／続きから／初めから状態遷移
- 経験の確認必須項目
- ES主張4判定
- URL/IP拒否ルール
- stale伝播ルール
- AI出力のID・引用検証

### 契約テスト

- OpenAPI YAMLを重複キーも含めて完全にparseし、P0 operationとRoute実装の対応を検査する。
- 決定的API E2EとLM Studio使用E2Eの全レスポンスを、status・Content-Type・JSON Schemaまで`openapi.yaml`へ照合する。
- AI代表出力が`contracts/ai`へ適合する。
- すべてのエラーが`ErrorResponse`へ適合する。
- ES文字抽出レスポンスが`EsTextExtraction`へ適合し、`requiresReview=true`である。

### デモE2E

1. LM Studio接続
2. USER回答1件以上でセッション固有結果を作成
3. 確認済み経験が0件の軸を根拠不足として表示
4. 複数セッション完了後、ホーム総合4軸・強み・弱みを再集計
5. 文章貼り付け、PNG/JPEG、文字PDF、画像PDFから原文を入力し、抽出文を本人確認
6. 未確認の役割・数字を含むESを検出
7. 全履歴を候補にして文章の完成版ES案を生成
8. 完成版の下に根拠状態・問題箇所・改善理由を表示
9. 再検査で新規未確認事実0件かつ`READY_TO_SUBMIT`

`npm.cmd run test:ci`はLM StudioなしでOpenAPI/Route対応、主要CRUD、PNG/PDF/OCR、入力上限、loopback限定を検証する。`npm.cmd run test:ai-p0`は一時DBと実際のLM Studioを使い、1〜4、6〜9、追加回答後の再分析、企業公式情報付きES、およびAIの504／502／503変換と失敗時の非保存を検証する。ファイル抽出後の本人確認操作を含む画面通し確認はフロント統合後の受け入れテストで行う。

## 10. 完了の定義

機能は「画面が動く」だけで完了にしない。

- OpenAPIまたはAI Schemaが更新済み
- 正常・入力不正・LM Studio停止の3経路を確認済み
- DBへ部分結果が残らない
- ログに機微本文が出ない
- 担当外のメンバーがREADMEから起動・操作できる
