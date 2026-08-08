import {
  fitInputByDropping,
  relevanceScore,
  type AiPrompt,
  type AiPromptBudget,
} from './context-budget.ts';
import { buildCompanyRecommendationsPrompt } from './prompts.ts';
import type { CompanyRecommendationsInput } from './types.ts';

function lowestValueIndex<T>(values: T[], score: (value: T) => number): number {
  let selected = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (score(values[index]) < score(values[selected])) selected = index;
  }
  return selected;
}

export function fitCompanyRecommendationsInput(
  input: CompanyRecommendationsInput,
  budget: AiPromptBudget,
): { input: CompanyRecommendationsInput; prompt: AiPrompt; dropped: boolean } {
  const query = [
    input.selfAnalysisReport.summary,
    JSON.stringify(input.selfAnalysisReport.mustConditions),
    JSON.stringify(input.selfAnalysisReport.preferConditions),
    ...input.targetRoles,
    ...input.preferredLocations,
  ].join('\n');

  const prepared = structuredClone(input);
  prepared.companies = prepared.companies.map((company) => ({
    ...company,
    sources: company.sources
      .filter((source) => source.facts.length > 0)
      .map((source) => ({
        ...source,
        facts: [...source.facts].sort((left, right) => relevanceScore(query, left) - relevanceScore(query, right)),
      })),
  }));
  prepared.confirmedExperiences.sort(
    (left, right) => relevanceScore(query, left) - relevanceScore(query, right),
  );

  return fitInputByDropping(
    prepared,
    buildCompanyRecommendationsPrompt,
    budget,
    [
      (candidate) => {
        const sources = candidate.companies.flatMap((company) => company.sources);
        const source = sources.find((item) => item.facts.length > 1);
        if (!source) return false;
        source.facts.shift();
        return true;
      },
      (candidate) => {
        const company = candidate.companies.find((item) => item.sources.length > 1);
        if (!company) return false;
        const index = lowestValueIndex(company.sources, (source) => relevanceScore(query, source));
        company.sources.splice(index, 1);
        return true;
      },
      (candidate) => candidate.confirmedExperiences.length > 1
        ? Boolean(candidate.confirmedExperiences.shift())
        : false,
    ],
  );
}
