// 画面のパス定数。認証周りはAPIクライアントからも参照するため共有モジュールに置く
export const LOGIN_PATH = "/login";
export const HOME_PATH = "/";
export const ANALYSIS_CHAT_PATH = "/analysis-chat";
export const ES_REVISION_PATH = "/es-revision";
export const EXPERIENCES_PATH = "/experiences";
export const SYSTEM_STATUS_PATH = "/system-status";
export const ACCOUNT_PATH = "/account";

// ログインしていなくても開ける画面。
// docs/screen-api-map.md「起動確認とGoogle認証開始・コールバックを除く画面APIはログイン必須」に対応し、
// 起動確認はDB・LM Studioが落ちている状況を確認するための画面なので認証を要求しない
export const PUBLIC_PATHS: readonly string[] = [LOGIN_PATH, SYSTEM_STATUS_PATH];

export function isPublicPath(pathname: string | null): boolean {
  return pathname !== null && PUBLIC_PATHS.includes(pathname);
}
