import { TUTORIAL_STEP_ORDER, type TutorialStep } from "./tutorial-steps";

// 現状はlocalStorageで永続化する（DB移行時はこのモジュールの中身だけ差し替えれば済むようにする）。
// ユーザーごとに分離しないと、同じブラウザで複数のGoogleアカウントを使った場合に
// 別ユーザーの進捗を誤って引き継いでしまう
function storageKey(userId: string): string {
  return `polaris:tutorial:${userId}`;
}

interface StoredTutorialProgress {
  step: TutorialStep;
}

function isTutorialStep(value: unknown): value is TutorialStep {
  return (
    typeof value === "string" &&
    (TUTORIAL_STEP_ORDER as readonly string[]).concat("SKIPPED").includes(value)
  );
}

export function loadTutorialStep(userId: string): TutorialStep {
  if (typeof window === "undefined") return "NOT_STARTED";
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return "NOT_STARTED";
    const parsed = JSON.parse(raw) as Partial<StoredTutorialProgress>;
    return isTutorialStep(parsed.step) ? parsed.step : "NOT_STARTED";
  } catch {
    // 壊れた値・プライベートモードでの例外などは未開始として扱う
    return "NOT_STARTED";
  }
}

export function saveTutorialStep(userId: string, step: TutorialStep): void {
  if (typeof window === "undefined") return;
  try {
    const body: StoredTutorialProgress = { step };
    window.localStorage.setItem(storageKey(userId), JSON.stringify(body));
  } catch {
    // 保存に失敗しても操作自体は継続できるようにする（チュートリアルは補助UIのため）
  }
}
