"use client";

import { useEffect, useRef, useState } from "react";

import { TutorialCelebration } from "./TutorialCelebration";
import { TutorialHint } from "./TutorialHint";
import { useTutorial } from "./TutorialProvider";
import type { AnalysisSession } from "@/types/analysis-session";

interface ChatTutorialHintsProps {
  loadingResumable: boolean;
  // 進行中セッション一覧からの選択画面（「初めから」ボタンを含む）を表示しているか
  showPicker: boolean;
  session: AnalysisSession | null;
}

// 自己分析チャット画面のチュートリアル導線。
// 「初めから」→タイトル入力→初回回答→経験カード作成→結果を見る、の各stepを
// 実際のユーザー操作・セッション進捗から検知して進める。
//
// 初めてのユーザーは進行中セッションが0件のため、選択画面（「初めから」ボタン）は
// 表示されずタイトル入力フォームへ直接進む（既存画面の分岐と同じ）。
// その場合はSTART_NEWのstepを対象なしで自動的に読み飛ばす
export function ChatTutorialHints({
  loadingResumable,
  showPicker,
  session,
}: ChatTutorialHintsProps) {
  const tutorial = useTutorial();
  const [titleTyped, setTitleTyped] = useState(false);
  const [showFirstCardCelebration, setShowFirstCardCelebration] = useState(false);
  const [showAnalysisStartCelebration, setShowAnalysisStartCelebration] = useState(false);
  const prevConfirmedRef = useRef<number | null>(null);

  // 「初めから」画面が今回は出ない（進行中セッションが元々ない）ならSTART_NEWを読み飛ばす
  useEffect(() => {
    if (tutorial.step !== "START_NEW" || loadingResumable) return;
    if (!showPicker) tutorial.completeStep("START_NEW");
  }, [tutorial, loadingResumable, showPicker]);

  // セッションが確定した時点でTITLE_INPUTは完了。以後はFIRST_ANSWERの完了判定へ
  useEffect(() => {
    if (!session) return;
    if (tutorial.step === "TITLE_INPUT") {
      tutorial.completeStep("TITLE_INPUT");
      return;
    }
    if (tutorial.step === "FIRST_ANSWER" && session.progress.userMessageCount >= 1) {
      tutorial.completeStep("FIRST_ANSWER");
    }
  }, [tutorial, session]);

  // タイトル欄への入力を検知して、案内をタイトル欄→「開始する」ボタンへ切り替える
  useEffect(() => {
    setTitleTyped(false);
    if (tutorial.step !== "TITLE_INPUT") return;

    const handleInput = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) return;
      if (target.getAttribute("data-tutorial") !== "session-title-input") return;
      setTitleTyped(target.value.trim() !== "");
    };

    document.addEventListener("input", handleInput, true);
    return () => document.removeEventListener("input", handleInput, true);
  }, [tutorial.step]);

  // 経験カードの確認済み数が1件になった瞬間だけ、小さな成功演出を出す
  useEffect(() => {
    const current = session?.progress.confirmedExperienceCount ?? null;
    if (current === null) return;
    const prev = prevConfirmedRef.current;
    if (tutorial.step === "RESULT_BUTTON" && prev === 0 && current === 1) {
      setShowFirstCardCelebration(true);
    }
    prevConfirmedRef.current = current;
  }, [tutorial.step, session?.progress.confirmedExperienceCount]);

  const confirmedCount = session?.progress.confirmedExperienceCount ?? 0;

  return (
    <>
      <TutorialHint
        open={tutorial.step === "START_NEW" && showPicker}
        selector='[data-tutorial="start-new-button"]'
        message={"まずはここから始めましょう！\n振り返りたい経験について、新しく話してみましょう。"}
        advanceOn="click"
        onAdvance={() => tutorial.completeStep("START_NEW")}
      />

      <TutorialHint
        open={tutorial.step === "TITLE_INPUT" && !titleTyped}
        selector='[data-tutorial="session-title-input"]'
        message={"どんな経験について話しますか？\n『大学受験』『アルバイト』『ハッカソン』など、簡単なタイトルでOKです。"}
        advanceOn="none"
      />
      <TutorialHint
        open={tutorial.step === "TITLE_INPUT" && titleTyped}
        selector='[data-tutorial="session-start-button"]'
        message={"タイトルを入力したら、ここから対話スタートです！"}
        advanceOn="click"
        onAdvance={() => tutorial.completeStep("TITLE_INPUT")}
      />

      <TutorialHint
        open={
          tutorial.step === "FIRST_ANSWER" &&
          session !== null &&
          session.progress.userMessageCount === 0
        }
        selector='[data-tutorial="message-composer-input"]'
        message={"AIの質問に、あなた自身の経験を自由に答えてみてください。\n正解はありません。思い出せる範囲で大丈夫です！"}
        advanceOn="none"
      />

      <TutorialHint
        open={tutorial.step === "CREATE_CARD" && (session?.progress.userMessageCount ?? 0) >= 2}
        selector='[data-tutorial="create-draft-button"]'
        message={"この経験について少し見えてきました！\n今まで話した内容を『経験カード』として残してみましょう。"}
        advanceOn="click"
        onAdvance={() => tutorial.completeStep("CREATE_CARD")}
      />

      <TutorialHint
        open={
          tutorial.step === "RESULT_BUTTON" &&
          confirmedCount >= 2 &&
          session?.status !== "COMPLETED" &&
          !showFirstCardCelebration
        }
        selector='[data-tutorial="generate-result-button"]'
        message={"経験が集まってきました！\nここから、あなたの経験をもとに特徴や強みを分析してみましょう。\nもちろん、もっと経験カードを増やしてから分析することもできます。"}
        advanceOn="click"
        onAdvance={() => {
          tutorial.completeStep("RESULT_BUTTON");
          setShowAnalysisStartCelebration(true);
        }}
      />

      <TutorialCelebration
        open={showFirstCardCelebration}
        lines={[
          "🎉 1枚目の経験カードができました！",
          "違う経験についても話してみると、あなたの特徴がもっと見えてきます。",
        ]}
        onClose={() => setShowFirstCardCelebration(false)}
      />
      <TutorialCelebration
        open={showAnalysisStartCelebration}
        lines={["🚀 自己分析スタート！"]}
        durationMs={1400}
        onClose={() => setShowAnalysisStartCelebration(false)}
      />
    </>
  );
}
