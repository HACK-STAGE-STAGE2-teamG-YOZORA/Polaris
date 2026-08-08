// 初回チュートリアルの状態遷移。tutorialStepが「今どこまで進んだか」を表す単一の値で、
// 途中でリロードしても同じ地点から再開できるようにする。
//
// NOT_STARTED → HOME_INTRO → CHAT_TAB → START_NEW → TITLE_INPUT → FIRST_ANSWER
//   → CREATE_CARD → RESULT_BUTTON → COMPLETED
// SKIPPEDはいつでも入れる終端で、以後は自動表示しない。
export type TutorialStep =
  | "NOT_STARTED"
  | "HOME_INTRO"
  | "CHAT_TAB"
  | "START_NEW"
  | "TITLE_INPUT"
  | "FIRST_ANSWER"
  | "CREATE_CARD"
  | "RESULT_BUTTON"
  | "COMPLETED"
  | "SKIPPED";

// SKIPPEDを除いた通常の進行順。nextTutorialStepはこの並びだけを見て次を決める
export const TUTORIAL_STEP_ORDER: readonly TutorialStep[] = [
  "NOT_STARTED",
  "HOME_INTRO",
  "CHAT_TAB",
  "START_NEW",
  "TITLE_INPUT",
  "FIRST_ANSWER",
  "CREATE_CARD",
  "RESULT_BUTTON",
  "COMPLETED",
];

export function nextTutorialStep(step: TutorialStep): TutorialStep {
  const index = TUTORIAL_STEP_ORDER.indexOf(step);
  if (index === -1 || index === TUTORIAL_STEP_ORDER.length - 1) return step;
  return TUTORIAL_STEP_ORDER[index + 1];
}

// チュートリアルの案内（スポットライト・吹き出し）を出してよい状態かどうか
export function isTutorialActiveStep(step: TutorialStep): boolean {
  return step !== "NOT_STARTED" && step !== "COMPLETED" && step !== "SKIPPED";
}
