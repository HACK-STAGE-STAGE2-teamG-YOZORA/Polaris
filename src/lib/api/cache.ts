// BottomNavのタブを移動するたびに同じ一覧を取り直していたため、取得済みの応答をメモリへ保持する。
// 方針:
// - 保存先はメモリだけ。localStorageなどの永続領域には書かないので、リロードすると消える
// - ユーザーIDごとに分離し、別ユーザーのデータは再利用しない
// - ログアウト時と401受信時に全消去する
// - 作成・更新・削除の後は関連キーを無効化する（APIクライアントの各関数から呼ぶ）
// - 認証セッション（GET /auth/session）はキャッシュしない。ログイン状態は毎回サーバーに確認する
// - STALE・CONFIRMEDなどの業務状態はサーバー応答の値をそのまま保持する。
//   キャッシュが古いかどうかとは無関係な情報なので、この層で書き換えたり導出したりしない
//
// ブラウザ側だけで使うモジュール。サーバー側からimportしないこと（プロセス間で共有されてしまう）

interface CacheEntry {
  value: unknown;
}

// キャッシュキー。`種類:引数` の形にして、種類ごとの前方一致で無効化できるようにしている
export const CACHE_KEYS = {
  dashboard: "dashboard",
  // チャット画面と経験カード画面は同じ条件（SESSION_LIST_LIMIT件）で一覧を取るため、キャッシュを共有する
  analysisSessions: "analysis-sessions",
  experiences: (filter: string) => `experiences:${filter}`,
  esRevisionContext: (documentId: string | null | undefined) =>
    `es-revision-context:${documentId ?? ""}`,
} as const;

const store = new Map<string, CacheEntry>();

// 現在キャッシュを保持しているユーザー。未確定（null）のうちは書き込まない
let ownerUserId: string | null = null;

// AuthGateがセッション確認を終えた時点で呼ぶ。
// 別ユーザーに切り替わった場合は、前のユーザーのデータを見せないよう全消去する
export function setCacheOwner(userId: string | null): void {
  if (ownerUserId === userId) return;
  ownerUserId = userId;
  store.clear();
}

// ログアウト時と401受信時に呼ぶ
export function clearCache(): void {
  ownerUserId = null;
  store.clear();
}

export function readCache<T>(key: string): T | null {
  const entry = store.get(key);
  return entry ? (entry.value as T) : null;
}

export function writeCache<T>(key: string, value: T): void {
  // 誰のデータか確定していない状態では保存しない
  if (ownerUserId === null) return;
  store.set(key, { value });
}

// 種類（キーの接頭辞）単位でまとめて無効化する
function invalidateCache(...kinds: string[]): void {
  for (const key of [...store.keys()]) {
    if (kinds.some((kind) => key === kind || key.startsWith(`${kind}:`))) store.delete(key);
  }
}

// 経験カードの作成・更新・削除後。ESの根拠候補と総合プロフィールにも影響する
export function invalidateExperienceCaches(): void {
  invalidateCache("experiences", "es-revision-context", "dashboard");
}

// 企業の作成・更新・削除・企業情報の取り込み後。ES画面の企業一覧に影響する
export function invalidateCompanyCaches(): void {
  invalidateCache("es-revision-context");
}

// ES文書の作成・更新・削除・検査・推敲後。ホームの保存済みES要約にも影響する
export function invalidateEsCaches(): void {
  invalidateCache("es-revision-context", "dashboard");
}

// チャットの開始・送信・4軸生成・確定後。経験カード画面もセッション情報を参照する
export function invalidateAnalysisSessionCaches(): void {
  invalidateCache("analysis-sessions", "experiences", "dashboard");
}
