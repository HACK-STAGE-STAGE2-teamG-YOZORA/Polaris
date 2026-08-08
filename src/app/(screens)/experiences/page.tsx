"use client";

import { useState } from "react";
import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";

import { ExperienceListItem } from "./components/ExperienceListItem";
import { useExperiences } from "./use-experiences";
import type { ExperienceFilter } from "./use-experiences";
import { ExperienceCardForm } from "@/app/components/ExperienceCardForm";
import { SessionReportDialog } from "@/app/components/SessionReportDialog";
import { ANALYSIS_CHAT_PATH, SYSTEM_STATUS_PATH } from "@/shared/routes";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";

const FILTERS: ReadonlyArray<{ value: ExperienceFilter; label: string }> = [
  { value: "ALL", label: "すべて" },
  { value: "DRAFT", label: "下書き" },
  { value: "CONFIRMED", label: "確認済み" },
];

// 経験一覧。docs/screen-api-map.md「経験一覧 | 確認済み／下書きの管理」に対応する。
// 確認済み(CONFIRMED)にした経験だけが4軸分析とESの正式根拠になる
export default function ExperiencesPage() {
  const {
    items,
    loading,
    filter,
    editingId,
    saving,
    deletingId,
    notice,
    error,
    confirmedCount,
    setFilter,
    startEdit,
    cancelEdit,
    save,
    remove,
  } = useExperiences();

  // 削除確認ダイアログの対象。取り消せない操作なので必ず確認を挟む
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDelete = items.find((item) => item.id === pendingDeleteId) ?? null;
  const editing = items.find((item) => item.id === editingId) ?? null;
  // 「このセッションの結果を見る」で開くダイアログの対象セッションID
  const [viewingSessionId, setViewingSessionId] = useState<string | null>(null);

  return (
    <Box
      component="main"
      sx={{
        minHeight: "100dvh",
        pb: "72px",
        color: CHAT_COLORS.textOnDark,
        background: `linear-gradient(180deg, ${CHAT_COLORS.gradientTop} 0%, ${CHAT_COLORS.gradientMid} 46%, ${CHAT_COLORS.gradientBottom} 100%)`,
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 560, mx: "auto", px: 2, pt: 3 }}>
        <Typography component="h1" sx={{ fontSize: 28, fontWeight: 400, letterSpacing: "0.08em", mb: 1 }}>
          経験一覧
        </Typography>
        <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted, mb: 2 }}>
          確認済み{confirmedCount}件。確認済みにした経験だけが4軸分析とESの根拠になります。
        </Typography>

        <Stack spacing={2}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={filter}
            onChange={(_event, value: ExperienceFilter | null) => value && setFilter(value)}
            sx={{
              "& .MuiToggleButton-root": {
                color: CHAT_COLORS.textOnDarkMuted,
                borderColor: CHAT_COLORS.navyBorder,
                "&.Mui-selected": {
                  color: CHAT_COLORS.bubbleText,
                  bgcolor: CHAT_COLORS.orange,
                  "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
                },
              },
            }}
          >
            {FILTERS.map((item) => (
              <ToggleButton key={item.value} value={item.value}>
                {item.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          {notice && (
            <Typography variant="body2" sx={{ color: CHAT_COLORS.orange }}>
              {notice}
            </Typography>
          )}

          {error && (
            <Stack spacing={1}>
              <Typography variant="body2" sx={{ color: "#FFD1D1" }}>
                {error.message}
              </Typography>
              {error.code === "AI_UNAVAILABLE" && (
                <Button
                  component={Link}
                  href={SYSTEM_STATUS_PATH}
                  size="small"
                  variant="outlined"
                  sx={{ alignSelf: "flex-start", color: "#ffe0de", borderColor: "#f28b82" }}
                >
                  起動確認をひらく
                </Button>
              )}
            </Stack>
          )}

          {/* 編集中は一覧を隠さず、フォームを一覧の上へ差し込む */}
          {editing && (
            <ExperienceCardForm
              key={editing.id}
              experience={editing}
              saving={saving}
              onSave={(body) => void save(editing.id, body)}
              onCancel={cancelEdit}
            />
          )}

          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress size={24} sx={{ color: CHAT_COLORS.orange }} />
            </Box>
          )}

          {!loading && items.length === 0 && (
            <Stack spacing={1.5} sx={{ alignItems: "flex-start" }}>
              <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                {filter === "ALL"
                  ? "経験カードがまだありません。自己分析チャットで会話すると作成できます。"
                  : "この条件に当てはまる経験カードはありません。"}
              </Typography>
              <Button
                component={Link}
                href={ANALYSIS_CHAT_PATH}
                variant="contained"
                sx={{
                  bgcolor: CHAT_COLORS.orange,
                  color: CHAT_COLORS.bubbleText,
                  fontWeight: 700,
                  borderRadius: "999px",
                  "&:hover": { bgcolor: CHAT_COLORS.orangeDark },
                }}
              >
                自己分析チャットへ
              </Button>
            </Stack>
          )}

          {!loading &&
            items.map((experience) => (
              <ExperienceListItem
                key={experience.id}
                experience={experience}
                onEdit={() => startEdit(experience.id)}
                onDelete={() => setPendingDeleteId(experience.id)}
                onViewSession={setViewingSessionId}
                deleting={deletingId === experience.id}
                disabled={saving || deletingId !== null}
              />
            ))}
        </Stack>
      </Box>

      <Dialog open={pendingDelete !== null} onClose={() => setPendingDeleteId(null)}>
        <DialogTitle>この経験カードを削除しますか？</DialogTitle>
        <DialogContent>
          <DialogContentText>
            「{pendingDelete?.title}」を削除します。これまでの分析結果は残りますが、
            この経験を根拠にしていた4軸分析は古い状態になります。
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDeleteId(null)}>キャンセル</Button>
          <Button
            color="error"
            onClick={() => {
              if (pendingDeleteId) void remove(pendingDeleteId);
              setPendingDeleteId(null);
            }}
          >
            削除する
          </Button>
        </DialogActions>
      </Dialog>

      {viewingSessionId && (
        <SessionReportDialog
          open={viewingSessionId !== null}
          sessionId={viewingSessionId}
          onClose={() => setViewingSessionId(null)}
        />
      )}
    </Box>
  );
}
