import type {
  ConversationMessage,
  ExperienceQuote,
} from "./types.ts";

export function recoverExactQuote(
  source: string,
  candidate: string,
): string | null {
  if (source.includes(candidate)) {
    return candidate;
  }

  const characters = [...candidate].filter(
    (character) => !/\s/u.test(character),
  );

  if (characters.length === 0) {
    return null;
  }

  const escapeRegExp = (character: string) =>
    character.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const pattern = characters.map(escapeRegExp).join("\\s*");
  return source.match(new RegExp(pattern, "u"))?.[0] ?? null;
}

export function verifyAndRecoverMessageQuotes(
  quotes: ExperienceQuote[],
  messages: ConversationMessage[],
): void {
  for (const evidence of quotes) {
    const sourceMessage = messages.find(
      (message) =>
        message.id === evidence.messageId && message.role === "USER",
    );

    if (!sourceMessage) {
      throw new Error(
        `引用元のユーザーメッセージが存在しません: ${evidence.messageId}`,
      );
    }

    const exactQuote = recoverExactQuote(
      sourceMessage.content,
      evidence.quote,
    );

    if (!exactQuote) {
      throw new Error(`原文に存在しない引用です: ${evidence.quote}`);
    }

    evidence.quote = exactQuote;
  }
}
