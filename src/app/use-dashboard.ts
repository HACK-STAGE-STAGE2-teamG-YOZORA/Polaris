"use client";

import { useCallback, useEffect, useState } from "react";

import { recomputeOverallSelfAnalysis } from "@/lib/api/analysis-sessions";
import { CACHE_KEYS, readCache, writeCache } from "@/lib/api/cache";
import { apiGet } from "@/lib/api/client";
import { toDisplayError } from "@/lib/api/error-messages";
import type { DisplayError } from "@/lib/api/error-messages";
import type { DashboardResponse } from "@/types/dashboard";

interface UseDashboardState {
  dashboard: DashboardResponse | null;
  loading: boolean;
  // 総合プロフィールの再集計中。STALE表示から実行する
  recomputing: boolean;
  error: DisplayError | null;
}

const initialState: UseDashboardState = {
  dashboard: null,
  loading: true,
  recomputing: false,
  error: null,
};

// ホーム画面のロジック。GET /dashboard で進行中セッション・総合プロフィール・保存済みESを
// まとめて受け取り、STALEのときだけ再集計（POST /overall-self-analysis/recompute）を実行する
export function useDashboard() {
  const [state, setState] = useState<UseDashboardState>(initialState);

  useEffect(() => {
    let cancelled = false;

    // タブを戻ってきた場合は取得済みデータで即描画し、そのうえで背面から取り直す
    const cached = readCache<DashboardResponse>(CACHE_KEYS.dashboard);
    if (cached) setState((prev) => ({ ...prev, dashboard: cached, loading: false }));

    void apiGet<DashboardResponse>("/dashboard")
      .then((dashboard) => {
        if (cancelled) return;
        writeCache(CACHE_KEYS.dashboard, dashboard);
        setState((prev) => ({ ...prev, dashboard, loading: false }));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          // キャッシュを表示できている場合は内容を残し、再取得の失敗だけを知らせる
          setState((prev) => ({
            ...prev,
            loading: false,
            error: toDisplayError(err, "分析結果を読み込めませんでした。"),
          }));
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const recompute = useCallback(async (): Promise<boolean> => {
    setState((prev) => ({ ...prev, recomputing: true, error: null }));
    try {
      const overallProfile = await recomputeOverallSelfAnalysis();
      setState((prev) => ({
        ...prev,
        recomputing: false,
        dashboard: prev.dashboard ? { ...prev.dashboard, overallProfile } : prev.dashboard,
      }));
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        recomputing: false,
        error: toDisplayError(err, "総合結果を再集計できませんでした。"),
      }));
      return false;
    }
  }, []);

  return { ...state, recompute };
}
