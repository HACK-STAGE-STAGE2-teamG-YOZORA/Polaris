import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { LmStudioPolarisAiGateway } from "../src/infrastructure/ai/lm-studio-ai-gateway.ts";
import type {
  ConversationMessage,
  ExperienceType,
  HypothesisCategory,
} from "../src/infrastructure/ai/types.ts";

const experienceTypes: Array<{
  value: ExperienceType;
  label: string;
}> = [
  { value: "ENGAGED", label: "夢中になった経験" },
  { value: "ACHIEVEMENT", label: "成果を出した経験" },
  { value: "CHALLENGE", label: "挑戦・失敗した経験" },
  { value: "DRAINING_SUCCESS", label: "成果は出たが消耗した経験" },
  { value: "TEAM_CONFLICT", label: "チームで意見が割れた経験" },
  { value: "OTHER", label: "その他の印象的な経験" },
];

const focusAreas: HypothesisCategory[] = [
  "CAN",
  "WANT",
  "ENERGY",
  "CONTEXT",
];

const terminal = createInterface({ input, output });
const ai = new LmStudioPolarisAiGateway();

function printExperienceTypeMenu(): void {
  for (const [index, experienceType] of experienceTypes.entries()) {
    console.log(`${index + 1}. ${experienceType.label}`);
  }
}

try {
  console.log("\nPolaris 自己分析AI（開発用CLI）");
  console.log("話した内容は、この実行中だけメモリに保持します。\n");
  printExperienceTypeMenu();

  const selected = await terminal.question(
    "\n最初に振り返る経験を番号で選んでください [1]: ",
  );
  const selectedIndex = selected.trim() === "" ? 0 : Number(selected) - 1;
  const requestedType = experienceTypes[selectedIndex]?.value;

  if (!requestedType) {
    throw new Error("経験の番号が正しくありません。");
  }

  console.log(
    "\n印象に残っている出来事を、まずは自由に話してください。",
  );
  console.log("経験カードを作る: /card　終了: /quit\n");

  const sessionId = randomUUID();
  const messages: ConversationMessage[] = [];
  let missingAreas = [...focusAreas];
  let experienceReady = false;

  while (true) {
    const answer = await terminal.question("あなた: ");
    const command = answer.trim().toLowerCase();

    if (command === "/quit") {
      break;
    }

    if (command === "/card") {
      if (messages.every((message) => message.role !== "USER")) {
        console.log("AI: まだ経験が話されていません。\n");
        continue;
      }

      if (!experienceReady) {
        console.log(
          "AI: まだ不足している情報がありますが、現時点の下書きを作ります。",
        );
      }

      const draft = await ai.extractExperience({
        requestedType,
        messages,
      });

      console.log("\n--- 経験カード案（本人確認前） ---");
      console.log(JSON.stringify(draft, null, 2));
      console.log(
        "\nこの内容はDRAFTです。画面実装後は本人が修正・確認してから分析に使います。\n",
      );
      continue;
    }

    if (answer.trim() === "") {
      continue;
    }

    messages.push({
      id: randomUUID(),
      role: "USER",
      content: answer,
    });

    const turn = await ai.createChatTurn({
      session: {
        id: sessionId,
        focusAreas,
        coveredExperienceTypes: [],
        missingAreas,
      },
      messages,
    });

    messages.push({
      id: randomUUID(),
      role: "ASSISTANT",
      content: turn.reply,
    });
    missingAreas = turn.missingAreas;
    experienceReady = turn.experienceReady;

    console.log(`AI: ${turn.reply}`);

    if (experienceReady) {
      console.log(
        "[経験カードを作成できる情報が集まりました。必要なら /card と入力してください]",
      );
    }

    console.log();
  }
} finally {
  terminal.close();
  await ai[Symbol.asyncDispose]();
}
