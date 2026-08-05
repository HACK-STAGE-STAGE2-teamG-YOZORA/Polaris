import type {
  ConversationMessage,
  ExperienceQuote,
} from "./types";

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

/**
 * チャットの根拠候補は補助情報なので、不正な引用だけを破棄する。
 * 経験カードなど保存対象の検証では使用せず、厳格な関数を使うこと。
 */
export function filterAndRecoverMessageQuotes<T extends ExperienceQuote>(
  quotes: T[],
  messages: ConversationMessage[],
): T[] {
  return quotes.filter((quote) => {
    try {
      verifyAndRecoverMessageQuotes([quote], messages);
      return true;
    } catch {
      return false;
    }
  });
}
