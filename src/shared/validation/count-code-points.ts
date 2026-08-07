// docs/implementation-rules.md の countEsCharacters と同一の実装。
// text.length はUTF-16単位でサロゲートペア（絵文字など）を2文字とカウントしてしまうため、
// スプレッド構文でUnicodeコードポイント単位に分解してから数える。
// CRLF/CRはLFへ正規化してから数える（改行コードの違いで文字数が変わらないように）。
export function countCodePoints(text: string): number {
  return [...text.replace(/\r\n?/g, "\n")].length;
}
