"use client";

import { useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";

import { FieldLabel, fieldSx } from "@/app/components/FormFields";
import { createCompany, importCompanyText } from "@/lib/api/companies";
import { toDisplayError } from "@/lib/api/error-messages";
import { CHAT_COLORS } from "@/shared/ui/chat-colors";
import type { CompanySummary, SourceTrustLevel } from "@/types/company";

interface CompanyInfoPanelProps {
  companies: CompanySummary[];
  onCompaniesChanged: () => Promise<boolean>;
}

interface FormError {
  message: string;
}

const dialogPaperSx = {
  bgcolor: CHAT_COLORS.navy,
  color: CHAT_COLORS.textOnDark,
  backgroundImage: "none",
  border: `1px solid ${CHAT_COLORS.navyBorder}`,
  borderRadius: 3,
};

function optionalUrl(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isHttpUrlOrEmpty(value: string): boolean {
  if (!value.trim()) return true;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function CompanyInfoPanel({ companies, onCompaniesChanged }: CompanyInfoPanelProps) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [importCompany, setImportCompany] = useState<CompanySummary | null>(null);
  const [name, setName] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [officialUrl, setOfficialUrl] = useState("");
  const [registering, setRegistering] = useState(false);
  const [sourceTitle, setSourceTitle] = useState("採用・企業情報");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [trustLevel, setTrustLevel] = useState<SourceTrustLevel>("OFFICIAL");
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const sortedCompanies = useMemo(
    () => [...companies].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [companies],
  );

  const resetRegisterForm = () => {
    setName("");
    setTargetRole("");
    setOfficialUrl("");
    setError(null);
  };

  const openImport = (company: CompanySummary) => {
    setImportCompany(company);
    setSourceTitle("採用・企業情報");
    setSourceUrl(company.careerUrl ?? company.officialUrl ?? "");
    setSourceText("");
    setTrustLevel("OFFICIAL");
    setError(null);
  };

  const handleRegister = async () => {
    if (!name.trim()) {
      setError({ message: "企業名を入力してください。" });
      return;
    }
    if (!isHttpUrlOrEmpty(officialUrl)) {
      setError({ message: "公式URLは http:// または https:// から入力してください。" });
      return;
    }

    setRegistering(true);
    setError(null);
    try {
      const company = await createCompany({
        name: name.trim(),
        targetRole: targetRole.trim() || undefined,
        officialUrl: optionalUrl(officialUrl),
      });
      await onCompaniesChanged();
      setRegisterOpen(false);
      resetRegisterForm();
      setNotice("企業を登録しました。続けてESの根拠に使う公式情報を追加できます。");
      openImport(company);
    } catch (err) {
      setError({ message: toDisplayError(err, "企業を登録できませんでした。").message });
    } finally {
      setRegistering(false);
    }
  };

  const handleImport = async () => {
    if (!importCompany) return;
    if (!sourceTitle.trim() || !sourceText.trim()) {
      setError({ message: "資料名と企業情報の本文を入力してください。" });
      return;
    }
    if (!isHttpUrlOrEmpty(sourceUrl)) {
      setError({ message: "出典URLは http:// または https:// から入力してください。" });
      return;
    }

    setImporting(true);
    setError(null);
    try {
      const result = await importCompanyText(importCompany.id, {
        title: sourceTitle.trim(),
        text: sourceText.trim(),
        sourceUrl: optionalUrl(sourceUrl),
        trustLevel,
      });
      await onCompaniesChanged();
      setImportCompany(null);
      setNotice(
        `企業情報を追加しました（確認できた事実 ${result.facts.length}件${
          result.unknownItems.length > 0 ? `・未確認 ${result.unknownItems.length}件` : ""
        }）。`,
      );
    } catch (err) {
      setError({ message: toDisplayError(err, "企業情報を追加できませんでした。").message });
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Stack spacing={1.5}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography component="h2" sx={{ fontSize: 21, letterSpacing: "0.08em" }}>
              企業情報
            </Typography>
            <Typography variant="body2" sx={{ mt: 0.5, color: CHAT_COLORS.textOnDarkMuted, lineHeight: 1.7 }}>
              公式ページの文章を登録すると、志望動機などの企業に関する主張も出典付きで確認できます。
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={() => {
              resetRegisterForm();
              setRegisterOpen(true);
            }}
            sx={{ flexShrink: 0, color: CHAT_COLORS.orange, borderColor: CHAT_COLORS.orange, borderRadius: "999px" }}
          >
            企業を登録
          </Button>
        </Box>

        {sortedCompanies.length === 0 ? (
          <Box sx={{ borderRadius: 3, border: `1px dashed ${CHAT_COLORS.navyBorder}`, p: 2 }}>
            <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
              登録済み企業はありません。企業指定なしでも、本人の経験に関するES検査は利用できます。
            </Typography>
          </Box>
        ) : (
          <Stack spacing={1}>
            {sortedCompanies.map((company) => (
              <Box
                key={company.id}
                sx={{ borderRadius: 2.5, border: `1px solid ${CHAT_COLORS.navyBorder}`, bgcolor: CHAT_COLORS.navySurface, p: 1.5 }}
              >
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      {company.name}
                    </Typography>
                    <Typography variant="caption" sx={{ display: "block", color: CHAT_COLORS.textOnDarkMuted }}>
                      {company.targetRole || "応募職種未設定"} ・ 出典 {company.sourceCount}件 ・ 確認済み事実 {company.factCount}件
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="text"
                    onClick={() => openImport(company)}
                    sx={{ alignSelf: { xs: "flex-start", sm: "center" }, color: CHAT_COLORS.orange }}
                  >
                    公式情報を追加
                  </Button>
                </Stack>
              </Box>
            ))}
          </Stack>
        )}
      </Stack>

      <Dialog
        open={registerOpen}
        onClose={registering ? undefined : () => setRegisterOpen(false)}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle>企業を登録</DialogTitle>
        <DialogContent dividers sx={{ borderColor: CHAT_COLORS.navyBorder }}>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            {error && <Typography role="alert" variant="body2" sx={{ color: "#FFD1D1" }}>{error.message}</Typography>}
            <Stack spacing={0.75}>
              <FieldLabel required>企業名</FieldLabel>
              <TextField value={name} onChange={(event) => setName(event.target.value)} disabled={registering} fullWidth sx={fieldSx} />
            </Stack>
            <Stack spacing={0.75}>
              <FieldLabel>応募職種（任意）</FieldLabel>
              <TextField value={targetRole} onChange={(event) => setTargetRole(event.target.value)} disabled={registering} fullWidth sx={fieldSx} />
            </Stack>
            <Stack spacing={0.75}>
              <FieldLabel>企業公式URL（任意）</FieldLabel>
              <TextField
                type="url"
                placeholder="https://example.com"
                value={officialUrl}
                onChange={(event) => setOfficialUrl(event.target.value)}
                disabled={registering}
                fullWidth
                sx={fieldSx}
              />
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setRegisterOpen(false)} disabled={registering} sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            キャンセル
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleRegister()}
            disabled={registering}
            startIcon={registering ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700, borderRadius: "999px" }}
          >
            {registering ? "登録中…" : "登録して公式情報へ"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={importCompany !== null}
        onClose={importing ? undefined : () => setImportCompany(null)}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: dialogPaperSx } }}
      >
        <DialogTitle>{importCompany?.name}の公式情報を追加</DialogTitle>
        <DialogContent dividers sx={{ borderColor: CHAT_COLORS.navyBorder }}>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <Typography variant="body2" sx={{ color: CHAT_COLORS.textOnDarkMuted, lineHeight: 1.7 }}>
              企業サイトや募集要項の文章を貼り付けてください。AIが事実と引用を抽出し、ES検査の根拠として保存します。
            </Typography>
            {error && <Typography role="alert" variant="body2" sx={{ color: "#FFD1D1" }}>{error.message}</Typography>}
            <FormControl fullWidth>
              <InputLabel id="company-source-trust-label" sx={{ color: CHAT_COLORS.textOnDarkMuted }}>情報の種類</InputLabel>
              <Select
                labelId="company-source-trust-label"
                label="情報の種類"
                value={trustLevel}
                onChange={(event) => setTrustLevel(event.target.value as SourceTrustLevel)}
                disabled={importing}
                sx={{ ...fieldSx, bgcolor: CHAT_COLORS.userBubble, color: CHAT_COLORS.bubbleText }}
              >
                <MenuItem value="OFFICIAL">企業公式ページ・公式資料</MenuItem>
                <MenuItem value="USER_PROVIDED_UNVERIFIED">出典未確認のメモ</MenuItem>
              </Select>
              <FormHelperText sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
                企業主張を確認済みにできるのは、公式情報として登録した内容だけです。
              </FormHelperText>
            </FormControl>
            <Stack spacing={0.75}>
              <FieldLabel required>資料名</FieldLabel>
              <TextField value={sourceTitle} onChange={(event) => setSourceTitle(event.target.value)} disabled={importing} fullWidth sx={fieldSx} />
            </Stack>
            <Stack spacing={0.75}>
              <FieldLabel>出典URL（任意）</FieldLabel>
              <TextField
                type="url"
                value={sourceUrl}
                onChange={(event) => setSourceUrl(event.target.value)}
                disabled={importing}
                fullWidth
                sx={fieldSx}
              />
            </Stack>
            <Stack spacing={0.75}>
              <FieldLabel required>企業情報の本文</FieldLabel>
              <TextField
                placeholder="企業サイトや募集要項の文章を貼り付けてください"
                value={sourceText}
                onChange={(event) => setSourceText(event.target.value)}
                disabled={importing}
                multiline
                minRows={8}
                fullWidth
                sx={fieldSx}
              />
              <Typography variant="caption" sx={{ color: CHAT_COLORS.textOnDarkMuted, textAlign: "right" }}>
                {sourceText.length} / 100000文字
              </Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setImportCompany(null)} disabled={importing} sx={{ color: CHAT_COLORS.textOnDarkMuted }}>
            あとで
          </Button>
          <Button
            variant="contained"
            onClick={() => void handleImport()}
            disabled={importing || sourceText.length > 100000}
            startIcon={importing ? <CircularProgress size={16} color="inherit" /> : undefined}
            sx={{ bgcolor: CHAT_COLORS.orange, color: CHAT_COLORS.bubbleText, fontWeight: 700, borderRadius: "999px" }}
          >
            {importing ? "事実を抽出中…" : "公式情報を登録"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={notice !== null}
        autoHideDuration={5000}
        onClose={() => setNotice(null)}
        message={notice}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      />
    </>
  );
}
