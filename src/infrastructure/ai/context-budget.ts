export type AiPrompt = { system: string; user: string };

export type AiPromptBudget = {
  contextLength: number;
  maxOutputTokens: number;
  schemaReserveTokens: number;
  estimatedCharsPerToken: number;
};

type Dropper<T> = (input: T) => boolean;

export function estimateTextTokens(text: string, estimatedCharsPerToken: number): number {
  return Math.ceil([...text].length / estimatedCharsPerToken);
}

export function promptFitsBudget(prompt: AiPrompt, budget: AiPromptBudget, extraText = ''): boolean {
  const inputTokens = estimateTextTokens(
    `${prompt.system}\n${prompt.user}\n${extraText}`,
    budget.estimatedCharsPerToken,
  );
  return inputTokens + budget.maxOutputTokens + budget.schemaReserveTokens <= budget.contextLength;
}

export function fitInputByDropping<T>(
  input: T,
  buildPrompt: (value: T) => AiPrompt,
  budget: AiPromptBudget,
  droppers: Array<Dropper<T>>,
): { input: T; prompt: AiPrompt; dropped: boolean } {
  const candidate = structuredClone(input);
  let prompt = buildPrompt(candidate);
  let dropped = false;
  while (!promptFitsBudget(prompt, budget)) {
    let changed = false;
    for (const drop of droppers) {
      if (drop(candidate)) {
        dropped = true;
        changed = true;
        break;
      }
    }
    if (!changed) break;
    prompt = buildPrompt(candidate);
  }
  return { input: candidate, prompt, dropped };
}

function normalizedBigrams(text: string): Set<string> {
  const normalized = text.toLocaleLowerCase('ja-JP').replace(/\s+/gu, '');
  const values = [...normalized];
  if (values.length < 2) return new Set(values);
  return new Set(values.slice(0, -1).map((value, index) => `${value}${values[index + 1]}`));
}

export function relevanceScore(query: string, value: unknown): number {
  const queryBigrams = normalizedBigrams(query);
  if (queryBigrams.size === 0) return 0;
  const valueBigrams = normalizedBigrams(JSON.stringify(value));
  let score = 0;
  for (const bigram of queryBigrams) {
    if (valueBigrams.has(bigram)) score += 1;
  }
  return score;
}

export function splitTextForBudget(text: string, maximumCharacters: number, overlapCharacters = 200): string[] {
  if ([...text].length <= maximumCharacters) return [text];
  const paragraphs = text.replace(/\r\n?/gu, '\n').split(/\n{2,}/gu);
  const chunks: string[] = [];
  let current = '';

  const pushCurrent = () => {
    const value = current.trim();
    if (value) chunks.push(value);
    current = '';
  };

  for (const paragraph of paragraphs) {
    const values = [...paragraph];
    if (values.length > maximumCharacters) {
      pushCurrent();
      const step = Math.max(1, maximumCharacters - overlapCharacters);
      for (let index = 0; index < values.length; index += step) {
        chunks.push(values.slice(index, index + maximumCharacters).join('').trim());
      }
      continue;
    }
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if ([...next].length > maximumCharacters) pushCurrent();
    current = current ? `${current}\n\n${paragraph}` : paragraph;
  }
  pushCurrent();
  return chunks.filter(Boolean);
}
