import { Chat, LMStudioClient } from "@lmstudio/sdk";
import { loadPolarisAiConfig } from "./config.ts";
import {
  buildChatTurnPrompt,
  buildCompanyFactsPrompt,
  buildExperienceDraftPrompt,
  buildExperienceGroundingPrompt,
  buildEsAnalysisPrompt,
  buildEsRevisionPrompt,
  buildAxisAssessmentsPrompt,
  buildOverallSelfAnalysisPrompt,
  buildSelfAnalysisReportPrompt,
} from "./prompts.ts";
import {
  filterAndRecoverMessageQuotes,
  recoverExactQuote,
  verifyAndRecoverMessageQuotes,
} from "./quotes.ts";
import { loadAiSchema } from "./schema.ts";
import type {
  ChatTurnInput,
  ChatTurnOutput,
  CompanyFactsInput,
  CompanyFactsOutput,
  ExperienceDraftInput,
  ExperienceDraftOutput,
  ExperienceGroundingField,
  ExperienceGroundingOutput,
  EsAnalysisInput,
  EsAnalysisOutput,
  EsRevisionInput,
  EsRevisionOutput,
  AxisAssessmentsInput,
  AxisAssessmentsOutput,
  OverallSelfAnalysisInput,
  OverallSelfAnalysisOutput,
  PolarisAiConfig,
  SelfAnalysisReportInput,
  SelfAnalysisReportOutput,
} from "./types.ts";

type StructuredTaskOptions<T> = {
  schemaFileName: string;
  systemPrompt: string;
  userPrompt: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  beforeValidation?: (output: unknown) => void;
  afterValidation?: (output: T) => void;
};

export class PolarisAiError extends Error {
  readonly code:
    | "AI_UNAVAILABLE"
    | "AI_TIMEOUT"
    | "AI_INVALID_OUTPUT"
    | "AI_REQUEST_FAILED";

  constructor(
    code:
      | "AI_UNAVAILABLE"
      | "AI_TIMEOUT"
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
      timeoutMs: this.#config.chatTimeoutMs,
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
    const deadline = Date.now() + this.#config.taskTimeoutMs;

    const draft = await this.#runStructuredTask<ExperienceDraftOutput>({
      schemaFileName: "experience-draft-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: this.#config.structuredTemperature,
      maxTokens: this.#config.taskMaxTokens,
      timeoutMs: Math.max(1, deadline - Date.now()),
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
      timeoutMs: Math.max(1, deadline - Date.now()),
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

  async generateAxisAssessments(
    input: AxisAssessmentsInput,
  ): Promise<AxisAssessmentsOutput> {
    const prompt = buildAxisAssessmentsPrompt(input);
    const evidenceById = new Map(
      input.evidenceItems.map((evidence) => [evidence.id, evidence]),
    );

    return this.#runStructuredTask<AxisAssessmentsOutput>({
      schemaFileName: "hypotheses-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: this.#config.structuredTemperature,
      maxTokens: this.#config.taskMaxTokens,
      timeoutMs: this.#config.taskTimeoutMs,
      afterValidation: (output) => {
        const axes = output.assessments.map((assessment) => assessment.axis);
        if (new Set(axes).size !== axes.length) {
          throw new Error("同じ軸の分析を複数返せません。");
        }

        for (const assessment of output.assessments) {
          const referencedIds = new Set([
            ...assessment.leftEvidenceIds,
            ...assessment.rightEvidenceIds,
            ...assessment.bothEvidenceIds,
            ...assessment.contextEvidenceIds,
            ...assessment.counterEvidenceIds,
          ]);
          const normalized = {
            left: [] as string[],
            right: [] as string[],
            both: [] as string[],
            context: [] as string[],
            counter: [] as string[],
          };

          for (const evidenceId of referencedIds) {
            const evidence = evidenceById.get(evidenceId);

            if (!evidence) {
              throw new Error(`存在しない根拠IDです: ${evidenceId}`);
            }

            if (evidence.axis !== assessment.axis) {
              throw new Error(
                `軸分析と根拠のaxisが一致しません: ${evidenceId}`,
              );
            }

            if (evidence.supportType === "COUNTER") {
              normalized.counter.push(evidenceId);
            } else if (evidence.pole === "LEFT") {
              normalized.left.push(evidenceId);
            } else if (evidence.pole === "RIGHT") {
              normalized.right.push(evidenceId);
            } else if (evidence.pole === "BOTH") {
              normalized.both.push(evidenceId);
            } else if (evidence.pole === "CONTEXT_DEPENDENT") {
              normalized.context.push(evidenceId);
            }
          }

          assessment.leftEvidenceIds = normalized.left;
          assessment.rightEvidenceIds = normalized.right;
          assessment.bothEvidenceIds = normalized.both;
          assessment.contextEvidenceIds = normalized.context;
          assessment.counterEvidenceIds = normalized.counter;
        }
      },
    });
  }

  async writeSelfAnalysisReport(
    input: SelfAnalysisReportInput,
  ): Promise<SelfAnalysisReportOutput> {
    const prompt = buildSelfAnalysisReportPrompt(input);
    const assessmentIds = new Set(input.axisAssessments.map((item) => item.id));

    return this.#runStructuredTask<SelfAnalysisReportOutput>({
      schemaFileName: "career-report-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: this.#config.structuredTemperature,
      maxTokens: this.#config.taskMaxTokens,
      timeoutMs: this.#config.taskTimeoutMs,
      afterValidation: (output) => {
        if (new Set(output.axisComments.map((item) => item.axisAssessmentId)).size !== output.axisComments.length) {
          throw new Error('同じ4軸分析へのコメントが重複しています。');
        }
        const referencedIds = [
          ...output.axisComments.map((item) => item.axisAssessmentId),
          ...output.mustConditions.flatMap((item) => item.axisAssessmentIds),
          ...output.preferConditions.flatMap((item) => item.axisAssessmentIds),
          ...output.avoidConditions.flatMap((item) => item.axisAssessmentIds),
          ...output.verifyConditions.flatMap((item) => item.axisAssessmentIds),
        ];
        for (const id of referencedIds) {
          if (!assessmentIds.has(id)) {
            throw new Error(`存在しない4軸分析IDです: ${id}`);
          }
        }
        for (const comment of output.axisComments) {
          const assessment = input.axisAssessments.find((item) => item.id === comment.axisAssessmentId);
          if (!assessment || assessment.axis !== comment.axis) {
            throw new Error(`軸コメントのaxisとaxisAssessmentIdが一致しません: ${comment.axisAssessmentId}`);
          }
        }
      },
    });
  }

  async generateOverallSelfAnalysis(
    input: OverallSelfAnalysisInput,
  ): Promise<OverallSelfAnalysisOutput> {
    const prompt = buildOverallSelfAnalysisPrompt(input);
    const reportIds = new Set(input.completedSessionReports.map((report) => report.id));
    const evidenceIds = new Set(
      input.completedSessionReports.flatMap((report) => report.axes.flatMap((axis) => axis.evidenceIds)),
    );

    return this.#runStructuredTask<OverallSelfAnalysisOutput>({
      schemaFileName: "overall-self-analysis-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: this.#config.structuredTemperature,
      maxTokens: this.#config.taskMaxTokens,
      timeoutMs: this.#config.taskTimeoutMs,
      afterValidation: (output) => {
        if (new Set(output.axisTrends.map((item) => item.axis)).size !== output.axisTrends.length) {
          throw new Error('総合4軸のaxisが重複しています。');
        }
        for (const id of [
          ...output.axisTrends.flatMap((item) => item.sourceReportIds),
          ...output.strengths.flatMap((item) => item.sourceReportIds),
          ...output.weaknesses.flatMap((item) => item.sourceReportIds),
        ]) {
          if (!reportIds.has(id)) throw new Error(`存在しないレポートIDです: ${id}`);
        }
        for (const id of [
          ...output.axisTrends.flatMap((item) => item.evidenceIds),
          ...output.strengths.flatMap((item) => item.evidenceIds),
          ...output.weaknesses.flatMap((item) => item.evidenceIds),
        ]) {
          if (!evidenceIds.has(id)) throw new Error(`存在しない根拠IDです: ${id}`);
        }
      },
    });
  }

  async extractCompanyFacts(input: CompanyFactsInput): Promise<CompanyFactsOutput> {
    const prompt = buildCompanyFactsPrompt(input);
    return this.#runStructuredTask<CompanyFactsOutput>({
      schemaFileName: "company-facts-output.schema.json",
      systemPrompt: prompt.system,
      userPrompt: prompt.user,
      temperature: this.#config.structuredTemperature,
      maxTokens: this.#config.taskMaxTokens,
      timeoutMs: this.#config.taskTimeoutMs,
      afterValidation: (output) => {
        for (const fact of output.facts) {
          const exact = recoverExactQuote(input.source.text, fact.evidenceQuote);
          if (!exact) throw new Error(`企業情報本文に存在しない引用です: ${fact.evidenceQuote}`);
          fact.evidenceQuote = exact;
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
      timeoutMs: this.#config.taskTimeoutMs,
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
      timeoutMs: this.#config.taskTimeoutMs,
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
      allConfirmedExperiences: input.allConfirmedExperiences,
      allowedCompanyFacts: input.allowedCompanyFacts,
      allSessionReports: input.allSessionReports,
      ...(input.overallSelfAnalysisProfile ? { overallSelfAnalysisProfile: input.overallSelfAnalysisProfile } : {}),
      preferredExperienceIds: input.preferredExperienceIds,
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
        const experience = input.allConfirmedExperiences.find(
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
    const timeoutSignal = AbortSignal.timeout(options.timeoutMs);

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
          signal: timeoutSignal,
        });

        previousOutput = result.content;
        const parsed: unknown = JSON.parse(result.content);
        options.beforeValidation?.(parsed);
        const output = schema.validateStrict(parsed);
        options.afterValidation?.(output);
        return output;
      } catch (error) {
        if (timeoutSignal.aborted) {
          throw new PolarisAiError(
            "AI_TIMEOUT",
            `AI処理が制限時間（${options.timeoutMs}ms）を超えました。入力を保持したまま再試行してください。`,
            { cause: error },
          );
        }
        console.warn(
          `AI構造化出力の検証に失敗しました（${attempt + 1}/${this.#config.repairAttempts + 1}）:`,
          error instanceof Error ? error.message : String(error),
        );
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
