import { Chat, LMStudioClient } from "@lmstudio/sdk";
import { loadPolarisAiConfig } from "./config";
import {
  buildChatTurnPrompt,
  buildExperienceDraftPrompt,
  buildExperienceGroundingPrompt,
  buildEsAnalysisPrompt,
  buildEsRevisionPrompt,
  buildHypothesesPrompt,
} from "./prompts";
import {
  filterAndRecoverMessageQuotes,
  recoverExactQuote,
  verifyAndRecoverMessageQuotes,
} from "./quotes";
import { loadAiSchema } from "./schema";
import type {
  ChatTurnInput,
  ChatTurnOutput,
  ExperienceDraftInput,
  ExperienceDraftOutput,
  ExperienceGroundingField,
  ExperienceGroundingOutput,
  EsAnalysisInput,
  EsAnalysisOutput,
  EsRevisionInput,
  EsRevisionOutput,
  HypothesesInput,
  HypothesesOutput,
  PolarisAiConfig,
} from "./types";

type StructuredTaskOptions<T> = {
  schemaFileName: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  beforeValidation?: (output: unknown) => void;
  afterValidation?: (output: T) => void;
};

export class PolarisAiError extends Error {
  readonly code:
    | "AI_UNAVAILABLE"
    | "AI_INVALID_OUTPUT"
    | "AI_REQUEST_FAILED";

  constructor(
    code:
      | "AI_UNAVAILABLE"
      | "AI_INVALID_OUTPUT"
      | "AI_REQUEST_FAILED",
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "PolarisAiError";
    this.code = code;
  }
}

export class LmStudioPolarisAiGateway implements AsyncDisposable {
  readonly #client: LMStudioClient;
  readonly #config: PolarisAiConfig;

  constructor(config: PolarisAiConfig = loadPolarisAiConfig()) {
    this.#config = config;
    this.#client = new LMStudioClient({
      baseUrl: config.baseUrl.replace(/^http/, "ws"),
    });
  }

  async createChatTurn(input: ChatTurnInput): Promise<ChatTurnOutput> {
    const prompt = buildChatTurnPrompt(input);

    return this.#runStructuredTask<ChatTurnOutput>({
      schemaFileName: "chat-turn-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: this.#config.chatTemperature,
      maxTokens: this.#config.chatMaxTokens,
      afterValidation: (output) => {
        const questionMarks = [...output.reply.matchAll(/[？?]/gu)].length;

        if (questionMarks !== 1) {
          throw new Error(
            `replyには質問を一つだけ含めてください。現在の疑問符数: ${questionMarks}`,
          );
        }

        output.evidenceCandidates = filterAndRecoverMessageQuotes(
          output.evidenceCandidates,
          input.messages,
        );
      },
    });
  }

  async extractExperience(
    input: ExperienceDraftInput,
  ): Promise<ExperienceDraftOutput> {
    const prompt = buildExperienceDraftPrompt(input);

    const draft = await this.#runStructuredTask<ExperienceDraftOutput>({
      schemaFileName: "experience-draft-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: this.#config.structuredTemperature,
      maxTokens: this.#config.taskMaxTokens,
      beforeValidation: (value) => {
        if (
          value &&
          typeof value === "object" &&
          Array.isArray((value as { hypotheses?: unknown }).hypotheses)
        ) {
          const object = value as {
            hypotheses: Array<{ statement?: unknown }>;
          };
          object.hypotheses = object.hypotheses.filter(
            (hypothesis) =>
              typeof hypothesis.statement === "string" &&
              hypothesis.statement.trim() !== "",
          );
        }
      },
      afterValidation: (output) => {
        if (output.type !== input.requestedType) {
          throw new Error(
            `要求した経験種別と一致しません: ${output.type}`,
          );
        }

        const nullableFields = [
          "goal",
          "decision",
          "decisionReason",
          "result",
          "positiveEmotion",
          "negativeEmotion",
        ] as const;

        for (const field of nullableFields) {
          if (
            output[field] !== null &&
            output[field].trim() === ""
          ) {
            output[field] = null;
          }
        }

        output.options = output.options.filter((value) => value.trim() !== "");
        output.actions = output.actions.filter((value) => value.trim() !== "");
        output.environment = output.environment.filter(
          (value) => value.trim() !== "",
        );

        verifyAndRecoverMessageQuotes(output.evidenceQuotes, input.messages);
      },
    });

    const groundingPrompt = buildExperienceGroundingPrompt({
      messages: input.messages,
      draft,
    });
    const expectedFields: ExperienceGroundingField[] = [
      "goal",
      "options",
      "decision",
      "decisionReason",
    ];

    const grounding = await this.#runStructuredTask<ExperienceGroundingOutput>({
      schemaFileName: "experience-grounding-output.schema.json",
      systemPrompt: groundingPrompt.system,
      userPrompt: groundingPrompt.user,
      temperature: this.#config.structuredTemperature,
      maxTokens: Math.min(this.#config.taskMaxTokens, 2000),
      afterValidation: (output) => {
        const actualFields = output.assessments.map(
          (assessment) => assessment.field,
        );

        if (
          actualFields.length !== expectedFields.length ||
          new Set(actualFields).size !== expectedFields.length ||
          expectedFields.some((field) => !actualFields.includes(field))
        ) {
          throw new Error(
            "事実検証はgoal、options、decision、decisionReasonを各1件返してください。",
          );
        }

        const quotes = output.assessments
          .filter(
            (assessment) =>
              assessment.grounded &&
              assessment.messageId !== null &&
              assessment.quote !== null,
          )
          .map((assessment) => ({
            messageId: assessment.messageId as string,
            quote: assessment.quote as string,
          }));

        for (const assessment of output.assessments) {
          if (
            assessment.grounded !==
            (assessment.messageId !== null && assessment.quote !== null)
          ) {
            throw new Error(
              `${assessment.field}のgroundedと引用の有無が一致しません。`,
            );
          }
        }

        verifyAndRecoverMessageQuotes(quotes, input.messages);
      },
    });

    for (const assessment of grounding.assessments) {
      if (assessment.grounded) {
        continue;
      }

      if (assessment.field === "options") {
        draft.options = [];
      } else {
        draft[assessment.field] = null;
      }

      if (!draft.missingFields.includes(assessment.field)) {
        draft.missingFields.push(assessment.field);
      }
    }

    return draft;
  }

  async generateHypotheses(
    input: HypothesesInput,
  ): Promise<HypothesesOutput> {
    const prompt = buildHypothesesPrompt(input);
    const evidenceById = new Map(
      input.evidenceItems.map((evidence) => [evidence.id, evidence]),
    );

    return this.#runStructuredTask<HypothesesOutput>({
      schemaFileName: "hypotheses-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: this.#config.structuredTemperature,
      maxTokens: this.#config.taskMaxTokens,
      afterValidation: (output) => {
        for (const hypothesis of output.hypotheses) {
          const supporting = new Set(hypothesis.supportingEvidenceIds);

          for (const evidenceId of [
            ...hypothesis.supportingEvidenceIds,
            ...hypothesis.counterEvidenceIds,
          ]) {
            const evidence = evidenceById.get(evidenceId);

            if (!evidence) {
              throw new Error(`存在しない根拠IDです: ${evidenceId}`);
            }

            if (evidence.category !== hypothesis.category) {
              throw new Error(
                `仮説と根拠のcategoryが一致しません: ${evidenceId}`,
              );
            }
          }

          if (
            hypothesis.counterEvidenceIds.some((id) => supporting.has(id))
          ) {
            throw new Error("同じ根拠を支持と反証の両方に使えません。");
          }

          if (hypothesis.counterEvidenceIds.length === 0) {
            hypothesis.riskConditions = [];
          }
        }
      },
    });
  }

  async analyzeEs(input: EsAnalysisInput): Promise<EsAnalysisOutput> {
    const prompt = buildEsAnalysisPrompt(input);

    return this.#runStructuredTask<EsAnalysisOutput>({
      schemaFileName: "es-analysis-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: this.#config.structuredTemperature,
      maxTokens: this.#config.taskMaxTokens,
      afterValidation: (output) => {
        for (const claim of output.claims) {
          this.#verifySourceEvidence(claim.evidence, input);
        }

        output.issues = output.issues.filter(
          (issue) => issue.code !== "CHARACTER_LIMIT_EXCEEDED",
        );

        if (this.#countEsCharacters(input.text) > input.characterLimit) {
          output.issues.push({
            code: "CHARACTER_LIMIT_EXCEEDED",
            severity: "ERROR",
            message: `文字数が上限${input.characterLimit}字を超えています。`,
            sentence: null,
          });
        }
      },
    });
  }

  async reviseEs(input: EsRevisionInput): Promise<EsRevisionOutput> {
    const prompt = buildEsRevisionPrompt(input);

    return this.#runStructuredTask<EsRevisionOutput>({
      schemaFileName: "es-revision-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: 0.3,
      maxTokens: this.#config.taskMaxTokens,
      afterValidation: (output) => {
        for (const change of output.changes) {
          this.#verifySourceEvidence(change.evidence, input);
        }
      },
    });
  }

  async reviseAndVerifyEs(input: EsRevisionInput): Promise<{
    revision: EsRevisionOutput;
    verification: EsAnalysisOutput;
  }> {
    const revision = await this.reviseEs(input);
    const verification = await this.analyzeEs({
      question: input.question,
      characterLimit: input.characterLimit,
      text: revision.revisedText,
      allowedExperiences: input.allowedExperiences,
      allowedCompanyFacts: input.allowedCompanyFacts,
      confirmedHypothesesForVoice: input.confirmedHypothesesForVoice,
    });

    return { revision, verification };
  }

  #verifySourceEvidence(
    evidences: Array<{
      sourceType: "EXPERIENCE" | "COMPANY_FACT";
      sourceId: string;
      quote: string;
    }>,
    input: EsAnalysisInput,
  ): void {
    for (const evidence of evidences) {
      let sourceTexts: string[] | undefined;

      if (evidence.sourceType === "EXPERIENCE") {
        const experience = input.allowedExperiences.find(
          (experience) => experience.id === evidence.sourceId,
        );
        sourceTexts = experience
          ? [...experience.sourceQuotes, ...experience.confirmedFacts]
          : undefined;
      } else {
        const companyFact = input.allowedCompanyFacts.find(
          (fact) => fact.id === evidence.sourceId,
        );
        sourceTexts = companyFact ? [companyFact.evidenceQuote] : undefined;
      }

      if (!sourceTexts) {
        throw new Error(`許可されていない根拠IDです: ${evidence.sourceId}`);
      }

      const exactQuote = sourceTexts
        .map((source) => recoverExactQuote(source, evidence.quote))
        .find((quote) => quote !== null);

      if (!exactQuote) {
        throw new Error(`根拠原文に存在しない引用です: ${evidence.quote}`);
      }

      evidence.quote = exactQuote;
    }
  }

  #countEsCharacters(text: string): number {
    return [...text.replace(/\r\n?/g, "\n")].length;
  }

  async #runStructuredTask<T>(
    options: StructuredTaskOptions<T>,
  ): Promise<T> {
    const schema = await loadAiSchema<T>(options.schemaFileName);

    let model;

    try {
      model = await this.#client.llm.model(this.#config.modelId);
    } catch (error) {
      throw new PolarisAiError(
        "AI_UNAVAILABLE",
        "LM Studioへ接続できないか、指定モデルがロードされていません。",
        { cause: error },
      );
    }

    let validationError: unknown;
    let previousOutput = "";

    for (
      let attempt = 0;
      attempt <= this.#config.repairAttempts;
      attempt += 1
    ) {
      const chat = Chat.from([
        { role: "system", content: options.systemPrompt },
        { role: "user", content: options.userPrompt },
        ...(attempt === 0
          ? []
          : [
              {
                role: "assistant" as const,
                content: previousOutput,
              },
              {
                role: "user" as const,
                content: `直前の出力は検証に失敗しました。次のエラーだけを修正し、同じJSON Schemaに適合するJSONオブジェクトだけを再出力してください。\n${String(validationError)}`,
              },
            ]),
      ]);

      try {
        const result = await model.respond(chat, {
          structured: {
            type: "json",
            jsonSchema: schema.generationSchema,
          },
          temperature: options.temperature,
          maxTokens: options.maxTokens,
        });

        previousOutput = result.content;
        const parsed: unknown = JSON.parse(result.content);
        options.beforeValidation?.(parsed);
        const output = schema.validateStrict(parsed);
        options.afterValidation?.(output);
        return output;
      } catch (error) {
        validationError = error;
      }
    }

    throw new PolarisAiError(
      "AI_INVALID_OUTPUT",
      "AI出力を検証できませんでした。入力を保持したまま再試行してください。",
      { cause: validationError },
    );
  }

  async [Symbol.asyncDispose](): Promise<void> {
    await this.#client[Symbol.asyncDispose]();
  }
}
