"use client";

import { useCallback, useEffect, useState } from "react";

import { toDisplayError } from "@/lib/api/error-messages";
import type { DisplayError } from "@/lib/api/error-messages";
import { deleteExperience, listExperiences, updateExperience } from "@/lib/api/experiences";
import type {
  ExperienceResponse,
  ExperienceStatus,
  UpdateExperienceRequest,
} from "@/types/experience";

// 「すべて」を含む絞り込み。APIのstatusクエリは省略時に全件を返す
export type ExperienceFilter = "ALL" | ExperienceStatus;

interface UseExperiencesState {
  items: ExperienceResponse[];
  loading: boolean;
  filter: ExperienceFilter;
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
  loading: true,
  filter: "ALL",
  editingId: null,
  saving: false,
  deletingId: null,
  notice: null,
  error: null,
};

// 経験一覧のロジック。確認済み(CONFIRMED)と下書き(DRAFT)の管理を担う
export function useExperiences() {
  const [state, setState] = useState<UseExperiencesState>(initialState);

  const load = useCallback(async (filter: ExperienceFilter) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const page = await listExperiences(filter === "ALL" ? {} : { status: filter });
      setState((prev) => ({ ...prev, items: page.items, loading: false }));
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

  return {
    ...state,
    confirmedCount: state.items.filter((item) => item.status === "CONFIRMED").length,
    reload: () => void load(state.filter),
    setFilter,
    startEdit,
    cancelEdit,
    save,
    remove,
  };
}
