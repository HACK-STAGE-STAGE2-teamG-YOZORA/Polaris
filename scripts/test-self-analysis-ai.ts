import { randomUUID } from "node:crypto";
import { LmStudioPolarisAiGateway } from "../src/infrastructure/ai/lm-studio-ai-gateway.ts";
import type { ConversationMessage } from "../src/infrastructure/ai/types.ts";

const ai = new LmStudioPolarisAiGateway();
const userMessageId = randomUUID();

const messages: ConversationMessage[] = [
  {
    id: userMessageId,
    role: "USER",
    content:
      "大学の授業で4人チームのWebアプリを作りました。私はAPI設計とタスク分解を担当し、得意分野ごとに役割を決めました。期限内に完成して達成感がありましたが、途中の進捗調整は少し疲れました。",
  },
];

try {
  console.log("自己分析チャットを生成しています...");

  const turn = await ai.createChatTurn({
    session: {
      id: randomUUID(),
      focusAreas: ["CAN", "WANT", "ENERGY", "CONTEXT"],
      coveredExperienceTypes: [],
      missingAreas: ["CAN", "WANT", "ENERGY", "CONTEXT"],
    },
    messages,
  });

  const questionMarks = [...turn.reply.matchAll(/[？?]/gu)].length;

  if (questionMarks !== 1) {
    throw new Error(`質問が一つではありません: ${turn.reply}`);
  }

  console.log("\n検証済みチャット応答:");
  console.log(JSON.stringify(turn, null, 2));

  console.log("\n経験カードを抽出しています...");
  const draft = await ai.extractExperience({
    requestedType: "ENGAGED",
    messages,
  });

  console.log("\n検証済み経験カード:");
  console.log(JSON.stringify(draft, null, 2));

  if (draft.type !== "ENGAGED") {
    throw new Error(`経験種別が一致しません: ${draft.type}`);
  }

  const expectedMissingFields = [
    "goal",
    "options",
    "decision",
    "decisionReason",
  ];

  for (const field of expectedMissingFields) {
    if (!draft.missingFields.includes(field)) {
      throw new Error(
        `入力に明示されていない${field}が不足項目になっていません。`,
      );
    }
  }

  if (draft.goal !== null || draft.decisionReason !== null) {
    throw new Error(
      "結果や行動から、目標または判断理由を推測しています。",
    );
  }

  console.log("\n自己分析AIの縦方向テスト成功");
} finally {
  await ai[Symbol.asyncDispose]();
}
