"use client";

import { useState } from "react";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import CircularProgress from "@mui/material/CircularProgress";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormGroup from "@mui/material/FormGroup";
import FormHelperText from "@mui/material/FormHelperText";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import type { SelfAnalysisAxis } from "@/types/analysis-session";

// docs/openapi.yaml SelfAnalysisAxis の4値。括弧内はスキーマ説明にある両極の呼び名
const TARGET_AXIS_OPTIONS: { value: SelfAnalysisAxis; label: string }[] = [
  { value: "ENERGY_SOURCE", label: "エネルギー源（Focus ↔ Connect）" },
  { value: "ACTION_STYLE", label: "行動スタイル（Plan ↔ Experiment）" },
  { value: "SATISFACTION_SOURCE", label: "満足の源（Mastery ↔ Impact）" },
  { value: "PREFERRED_ENVIRONMENT", label: "好む環境（Stable ↔ Dynamic）" },
];

interface SessionStartFormProps {
  submitting: boolean;
  fieldErrors: Record<string, string>;
  onSubmit: (title: string, targetAxes: SelfAnalysisAxis[]) => void;
}

// セッション開始フォーム。タイトル（任意）とtargetAxes（デフォルト4軸全選択）を持つ。
// 「進行中セッションなし」の初回と「初めから」選択後の両方から使われる。
// startMode(START_NEW/RESTART_ACTIVE)の判断はこのコンポーネントでは行わず、hook側に任せる
export function SessionStartForm({ submitting, fieldErrors, onSubmit }: SessionStartFormProps) {
  const [title, setTitle] = useState("");
  // 未指定時はデフォルトで4軸全部を選択済みにしておく
  const [targetAxes, setTargetAxes] = useState<SelfAnalysisAxis[]>(
    TARGET_AXIS_OPTIONS.map((option) => option.value),
  );

  const toggleTargetAxis = (value: SelfAnalysisAxis) => {
    setTargetAxes((prev) =>
      prev.includes(value) ? prev.filter((axis) => axis !== value) : [...prev, value],
    );
  };

  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Typography variant="subtitle1">セッションを開始する</Typography>
        <TextField
          label="タイトル（任意）"
          placeholder="自己分析"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          error={Boolean(fieldErrors.title)}
          helperText={fieldErrors.title}
          fullWidth
          disabled={submitting}
        />
        <FormGroup>
          {TARGET_AXIS_OPTIONS.map((option) => (
            <FormControlLabel
              key={option.value}
              control={
                <Checkbox
                  checked={targetAxes.includes(option.value)}
                  onChange={() => toggleTargetAxis(option.value)}
                  disabled={submitting}
                />
              }
              label={option.label}
            />
          ))}
          {fieldErrors.targetAxes && (
            <FormHelperText error>{fieldErrors.targetAxes}</FormHelperText>
          )}
        </FormGroup>
        <Button
          variant="contained"
          disabled={submitting || targetAxes.length === 0}
          onClick={() => onSubmit(title, targetAxes)}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : undefined}
        >
          開始する
        </Button>
      </Stack>
    </Paper>
  );
}
