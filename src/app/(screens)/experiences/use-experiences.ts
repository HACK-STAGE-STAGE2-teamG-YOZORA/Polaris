"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { listAnalysisSessions } from "@/lib/api/analysis-sessions";
import { toDisplayError } from "@/lib/api/error-messages";
import type { DisplayError } from "@/lib/api/error-messages";
import { deleteExperience, listExperiences, updateExperience } from "@/lib/api/experiences";
import type { AnalysisSession } from "@/types/analysis-session";
import type {
  ExperienceResponse,
  ExperienceStatus,
  UpdateExperienceRequest,
} from "@/types/experience";

// 「すべて」を含む絞り込み。APIのstatusクエリは省略時に全件を返す
export type ExperienceFilter = "ALL" | ExperienceStatus;

// UPDATED: 更新順(既定、サーバーの並びそのまま)
// HISTORY: 履歴順(チャットを行った順=セッション開始日時の古い方から)
// BY_SESSION: セッション別(セッションごとにグルーピング。新しいセッションを上に)
export type ExperienceSortMode = "UPDATED" | "HISTORY" | "BY_SESSION";

export interface ExperienceSessionGroup {
  sessionId: string | null;
  sessionTitle: string;
  sessionCreatedAt: string | null;
  items: ExperienceResponse[];
}

interface UseExperiencesState {
  items: ExperienceResponse[];
  // sourceSessionId -> セッション（グルーピングと履歴順ソートのタイトル・日時に使う）
  sessionsById: Map<string, AnalysisSession>;
  loading: boolean;
  filter: ExperienceFilter;
  sortMode: ExperienceSortMode;
  // 編集フォームを開いている経験のID
  editingId: string | null;
  saving: boolean;
  deletingId: string | null;
  // 保存・削除の結果と、その操作で古くなった4軸分析の件数を伝える
  notice: string | null;
  error: DisplayError | null;
}

const initialState: UseExperiencesState = {
  items: [],
  sessionsById: new Map(),
  loading: true,
  filter: "ALL",
  sortMode: "UPDATED",
  editingId: null,
  saving: false,
  deletingId: null,
  notice: null,
  error: null,
};

// 経験一覧のロジック。確認済み(CONFIRMED)と下書き(DRAFT)の管理、
// 表示順の切り替え(更新順／履歴順／セッション別)を担う
export function useExperiences() {
  const [state, setState] = useState<UseExperiencesState>(initialState);

  const load = useCallback(async (filter: ExperienceFilter) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      // セッションはグルーピング・履歴順ソートのタイトル・日時表示だけに使うため、
      // ステータスを絞らず全件（ABANDONED・COMPLETEDも含む）を取得する
      const [page, sessionPage] = await Promise.all([
        listExperiences(filter === "ALL" ? {} : { status: filter }),
        listAnalysisSessions({ limit: 100 }),
      ]);
      setState((prev) => ({
        ...prev,
        items: page.items,
        sessionsById: new Map(sessionPage.items.map((session) => [session.id, session])),
        loading: false,
      }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: toDisplayError(err, "経験一覧を読み込めませんでした。"),
      }));
    }
  }, []);

  useEffect(() => {
    void load(state.filter);
  }, [load, state.filter]);

  const setFilter = useCallback((filter: ExperienceFilter) => {
    setState((prev) => ({ ...prev, filter, editingId: null, notice: null }));
  }, []);

  const setSortMode = useCallback((sortMode: ExperienceSortMode) => {
    setState((prev) => ({ ...prev, sortMode }));
  }, []);

  const startEdit = useCallback((experienceId: string) => {
    setState((prev) => ({ ...prev, editingId: experienceId, notice: null, error: null }));
  }, []);

  const cancelEdit = useCallback(() => {
    setState((prev) => ({ ...prev, editingId: null }));
  }, []);

  // 保存。staledAssessmentsが返った場合は、再生成が必要になったことを画面へ伝える
  const save = useCallback(
    async (experienceId: string, body: UpdateExperienceRequest): Promise<boolean> => {
      setState((prev) => ({ ...prev, saving: true, error: null }));
      try {
        const { experience, staledAssessments } = await updateExperience(experienceId, body);
        const staleNotice =
          staledAssessments.length > 0
            ? `この変更で4軸分析${staledAssessments.length}件が古くなりました。チャット画面で作り直してください。`
            : "";
        setState((prev) => ({
          ...prev,
          saving: false,
          editingId: null,
          // 絞り込み条件から外れた場合もあるため、一覧の該当行を差し替えたうえで再読込はしない
          items: prev.items.map((item) => (item.id === experience.id ? experience : item)),
          notice:
            `${experience.status === "CONFIRMED" ? "確認済みにしました。" : "下書きとして保存しました。"}${staleNotice}`,
        }));
        return true;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          saving: false,
          error: toDisplayError(err, "経験カードを保存できませんでした。"),
        }));
        return false;
      }
    },
    [],
  );

  const remove = useCallback(async (experienceId: string): Promise<boolean> => {
    setState((prev) => ({ ...prev, deletingId: experienceId, error: null }));
    try {
      await deleteExperience(experienceId);
      setState((prev) => ({
        ...prev,
        deletingId: null,
        editingId: prev.editingId === experienceId ? null : prev.editingId,
        items: prev.items.filter((item) => item.id !== experienceId),
        notice: "経験カードを削除しました。関連する分析結果は古い状態になります。",
      }));
      return true;
    } catch (err) {
      setState((prev) => ({
        ...prev,
        deletingId: null,
        error: toDisplayError(err, "経験カードを削除できませんでした。"),
      }));
      return false;
    }
  }, []);

  // 表示順を適用した結果。BY_SESSIONだけグループ配列、それ以外はフラット配列を返す
  const sortedItems = useMemo(() => {
    if (state.sortMode === "UPDATED") return state.items;
    // HISTORY: セッションの開始日時が古い順（=チャットを行った順）。
    // フォーム作成などセッションを持たない経験は末尾へ、経験自身の作成日時で並べる
    const sessionCreatedAt = (item: ExperienceResponse) =>
      (item.sourceSessionId && state.sessionsById.get(item.sourceSessionId)?.createdAt) || null;
    return [...state.items].sort((a, b) => {
      const aTime = sessionCreatedAt(a) ?? a.createdAt;
      const bTime = sessionCreatedAt(b) ?? b.createdAt;
      return aTime.localeCompare(bTime);
    });
  }, [state.items, state.sortMode, state.sessionsById]);

  const sessionGroups = useMemo<ExperienceSessionGroup[]>(() => {
    if (state.sortMode !== "BY_SESSION") return [];
    const groups = new Map<string, ExperienceSessionGroup>();
    for (const item of state.items) {
      const session = item.sourceSessionId ? state.sessionsById.get(item.sourceSessionId) : undefined;
      const key = item.sourceSessionId ?? "__none__";
      const existing = groups.get(key);
      if (existing) {
        existing.items.push(item);
      } else {
        groups.set(key, {
          sessionId: item.sourceSessionId,
          sessionTitle: session?.title ?? "セッションに属さない経験",
          sessionCreatedAt: session?.createdAt ?? null,
          items: [item],
        });
      }
    }
    // 新しいセッションを上に。セッションを持たない経験は末尾
    return [...groups.values()].sort((a, b) => {
      if (!a.sessionCreatedAt) return 1;
      if (!b.sessionCreatedAt) return -1;
      return b.sessionCreatedAt.localeCompare(a.sessionCreatedAt);
    });
  }, [state.items, state.sortMode, state.sessionsById]);

  return {
    ...state,
    sortedItems,
    sessionGroups,
    confirmedCount: state.items.filter((item) => item.status === "CONFIRMED").length,
    reload: () => void load(state.filter),
    setFilter,
    setSortMode,
    startEdit,
    cancelEdit,
    save,
    remove,
  };
}
