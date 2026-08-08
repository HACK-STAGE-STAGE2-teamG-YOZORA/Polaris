// デザイン画像から起こした仮の配色。正確な色コードは後で調整するため、
// 参照箇所を増やさずここだけ差し替えれば全体に反映されるようにまとめている。
export const CHAT_COLORS = {
  // Home画面と統一した背景グラデーション（黒 → ネイビー → ブルー、180degで0%/46%/100%に配置）
  gradientTop: "#000000",
  gradientMid: "#061C2B",
  gradientBottom: "#075685",
  navy: "#0B2545",
  navySurface: "rgba(255, 255, 255, 0.08)",
  navyBorder: "rgba(255, 255, 255, 0.16)",
  orange: "#F0A939",
  orangeDark: "#D98F22",
  orangeMuted: "rgba(240, 169, 57, 0.16)",
  aiBubble: "#F0A939",
  userBubble: "#FFFFFF",
  bubbleText: "#231A0F",
  textOnDark: "#FFFFFF",
  textOnDarkMuted: "rgba(255, 255, 255, 0.68)",
} as const;
