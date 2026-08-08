import Box from "@mui/material/Box";

const STARS = [
  [12, 12],
  [45, 29],
  [58, 58],
  [43, 79],
  [77, 104],
  [101, 87],
  [72, 62],
] as const;

// ロゴの横に添える北斗七星。ホーム画面とログイン画面で共有する
export function Constellation({ size = 116 }: { size?: number }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 120 120"
      aria-label="北斗七星"
      sx={{ width: size, height: size, flex: "none" }}
    >
      <g fill="none" stroke="rgba(255,255,255,0.88)" strokeWidth="2">
        <path d="M12 12 45 29 58 58 43 79 77 104 101 87 72 62" />
        <path d="M77 104 101 87" />
      </g>
      {STARS.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="3.4" fill="#fff" />
      ))}
    </Box>
  );
}
