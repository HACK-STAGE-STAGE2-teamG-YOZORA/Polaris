import type { InterviewQuestionsInput } from './types.ts';

type JsonObject = Record<string, unknown>;

function isObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string' || value.trim() === '') return null;
  return [...value.trim()].slice(0, maxLength).join('');
}

function question(value: unknown): string | null {
  const normalized = text(value, 1000);
  if (!normalized) return null;
  return /[？?]$/u.test(normalized) ? normalized : `${normalized}？`;
}

function allowedIds(value: unknown, allowed: Set<string>): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && allowed.has(item)))];
}

export function stabilizeInterviewQuestionsCandidate(value: unknown, input: InterviewQuestionsInput): void {
  if (!isObject(value)) return;
  const experienceIds = new Set(input.confirmedExperiences.map((experience) => experience.id));
  const companySourceIds = new Set(input.company?.sources.map((source) => source.id) ?? []);
  const seenDeepDive = new Set<string>();
  const seenReverse = new Set<string>();

  const deepDiveQuestions = (Array.isArray(value.deepDiveQuestions) ? value.deepDiveQuestions : [])
    .flatMap((candidate) => {
      if (!isObject(candidate)) return [];
      const normalizedQuestion = question(candidate.question);
      const connectedExperienceIds = allowedIds(candidate.connectedExperienceIds, experienceIds);
      if (!normalizedQuestion || connectedExperienceIds.length === 0 || seenDeepDive.has(normalizedQuestion)) return [];
      seenDeepDive.add(normalizedQuestion);
      return [{
        question: normalizedQuestion,
        purpose: text(candidate.purpose, 1000) ?? '確認済み経験の具体的な背景と判断を確認するため。',
        connectedExperienceIds,
      }];
    })
    .slice(0, input.deepDiveCount);

  const reverseQuestions = (Array.isArray(value.reverseQuestions) ? value.reverseQuestions : [])
    .flatMap((candidate) => {
      if (!isObject(candidate)) return [];
      const normalizedQuestion = question(candidate.question);
      const sourceIds = allowedIds(candidate.companySourceIds, companySourceIds);
      if (!normalizedQuestion || seenReverse.has(normalizedQuestion)) return [];
      if (input.company && sourceIds.length === 0) return [];
      seenReverse.add(normalizedQuestion);
      return [{
        question: normalizedQuestion,
        purpose: text(candidate.purpose, 1000) ?? '応募先で働く条件を具体的に確認するため。',
        companySourceIds: input.company ? sourceIds : [],
      }];
    })
    .slice(0, input.reverseQuestionCount);

  for (const key of Object.keys(value)) delete value[key];
  Object.assign(value, { deepDiveQuestions, reverseQuestions });
}
