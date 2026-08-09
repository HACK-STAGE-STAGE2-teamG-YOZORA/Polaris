"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { TutorialSkipButton } from "./TutorialSkipButton";
import { loadTutorialStep, saveTutorialStep } from "@/shared/tutorial/tutorial-storage";
import { isTutorialActiveStep, nextTutorialStep, type TutorialStep } from "@/shared/tutorial/tutorial-steps";

interface TutorialContextValue {
  step: TutorialStep;
  // storageからの読み込みが終わるまでは何も表示しない（未開始と誤判定してちらつくのを防ぐ）
  ready: boolean;
  isActive: boolean;
  // Home初回表示時にNOT_STARTEDならHOME_INTROへ進める
  start: () => void;
  // 現在のstepがexpectedと一致するときだけ次のstepへ進める。
  // 画面遷移やAPI応答の順序がずれても、想定外のstepを飛ばして進めてしまわないようにする
  completeStep: (expected: TutorialStep) => void;
  skip: () => void;
  // 「チュートリアルをもう一度見る」用。今は導線を置いていないが、
  // 呼べば最初からやり直せる状態にしておく
  restart: () => void;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  const ctx = useContext(TutorialContext);
  if (!ctx) {
    throw new Error("useTutorial must be used within TutorialProvider");
  }
  return ctx;
}

interface TutorialProviderProps {
  // ログイン中のユーザーID。未ログインではnullを渡し、進捗の読み書きをしない
  userId: string | null;
  children: ReactNode;
}

// 初回チュートリアルの進行状態を持つだけのProvider。
// スポットライト・吹き出し自体の見た目はTutorialHint側に任せ、ここでは
// 「今どのstepか」「次へ進めてよいか」だけを管理する
export function TutorialProvider({ userId, children }: TutorialProviderProps) {
  const [step, setStep] = useState<TutorialStep>("NOT_STARTED");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!userId) {
      setStep("NOT_STARTED");
      setReady(false);
      return;
    }
    setStep(loadTutorialStep(userId));
    setReady(true);
  }, [userId]);

  const persist = useCallback(
    (next: TutorialStep) => {
      setStep(next);
      if (userId) saveTutorialStep(userId, next);
    },
    [userId],
  );

  const start = useCallback(() => {
    setStep((current) => {
      if (current !== "NOT_STARTED") return current;
      const next = nextTutorialStep(current);
      if (userId) saveTutorialStep(userId, next);
      return next;
    });
  }, [userId]);

  const completeStep = useCallback(
    (expected: TutorialStep) => {
      setStep((current) => {
        if (current !== expected) return current;
        const next = nextTutorialStep(current);
        if (userId) saveTutorialStep(userId, next);
        return next;
      });
    },
    [userId],
  );

  const skip = useCallback(() => {
    persist("SKIPPED");
  }, [persist]);

  const restart = useCallback(() => {
    persist("HOME_INTRO");
  }, [persist]);

  const value = useMemo<TutorialContextValue>(
    () => ({
      step,
      ready,
      isActive: ready && Boolean(userId) && isTutorialActiveStep(step),
      start,
      completeStep,
      skip,
      restart,
    }),
    [step, ready, userId, start, completeStep, skip, restart],
  );

  return (
    <TutorialContext.Provider value={value}>
      {children}
      {value.isActive && <TutorialSkipButton onSkip={skip} />}
    </TutorialContext.Provider>
  );
}
