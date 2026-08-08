"use client";

import { useEffect, useRef } from "react";

import { TutorialHint } from "./TutorialHint";
import { useTutorial } from "./TutorialProvider";

// Home画面用のチュートリアル導線。
// 1. 初めてのHome表示ならHOME_INTROを開始し、短い説明を出す（時間経過で自動的に次へ）
// 2. 続けてChatタブをスポットライトし、実際にタップしたら次のstepへ進む
export function HomeTutorialHints() {
  const tutorial = useTutorial();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!tutorial.ready || startedRef.current) return;
    if (tutorial.step === "NOT_STARTED") {
      startedRef.current = true;
      tutorial.start();
    }
  }, [tutorial]);

  return (
    <>
      <TutorialHint
        open={tutorial.step === "HOME_INTRO"}
        message={"ようこそ！\nここでは、これまでの経験を振り返りながら、あなた自身の強みや特徴を見つけていきます。"}
        advanceOn="auto"
        autoAdvanceMs={3400}
        onAdvance={() => tutorial.completeStep("HOME_INTRO")}
      />
      <TutorialHint
        open={tutorial.step === "CHAT_TAB"}
        selector='[data-tutorial="nav-chat-tab"]'
        message={"まずは、あなたの経験についてAIと話してみましょう！\nChatを開いてみてください。"}
        advanceOn="click"
        onAdvance={() => tutorial.completeStep("CHAT_TAB")}
      />
    </>
  );
}
