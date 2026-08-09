// APIから返るUTC ISO 8601文字列を、画面表示のときだけ端末ローカル時刻に変換する。
// 保存・通信は常にUTCのままとし、変換は表示直前のこの関数だけに閉じ込める。
export function formatLocalDateTime(isoUtc: string): string {
  const date = new Date(isoUtc);
  if (Number.isNaN(date.getTime())) {
    // 不正な日時文字列が来た場合は変換せずそのまま返す（画面を壊さない）
    return isoUtc;
  }
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}
