"use client";

import { useCallback, useEffect, useState } from "react";

import { recomputeOverallSelfAnalysis } from "@/lib/api/analysis-sessions";
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

    void apiGet<DashboardResponse>("/dashboard")
      .then((dashboard) => {
        if (!cancelled) setState((prev) => ({ ...prev, dashboard, loading: false }));
      })
      .catch((err: unknown) => {
        if (!cancelled) {
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
