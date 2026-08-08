-- CreateEnum
CREATE TYPE "AnalysisSessionStatus" AS ENUM ('ACTIVE', 'READY_TO_FINALIZE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');

-- CreateEnum
CREATE TYPE "QuestionTarget" AS ENUM ('ENERGY_SOURCE', 'ACTION_STYLE', 'SATISFACTION_SOURCE', 'PREFERRED_ENVIRONMENT', 'EXPERIENCE_DETAIL', 'CONTRADICTION', 'CONFIRMATION');

-- CreateEnum
CREATE TYPE "ExperienceType" AS ENUM ('ENGAGED', 'ACHIEVEMENT', 'CHALLENGE', 'DRAINING_SUCCESS', 'TEAM_CONFLICT', 'OTHER');

-- CreateEnum
CREATE TYPE "ExperienceStatus" AS ENUM ('DRAFT', 'CONFIRMED');

-- CreateEnum
CREATE TYPE "SelfAnalysisAxis" AS ENUM ('ENERGY_SOURCE', 'ACTION_STYLE', 'SATISFACTION_SOURCE', 'PREFERRED_ENVIRONMENT');

-- CreateEnum
CREATE TYPE "AxisPole" AS ENUM ('LEFT', 'RIGHT', 'BOTH', 'CONTEXT_DEPENDENT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AxisPosition" AS ENUM ('LEFT', 'LEANS_LEFT', 'BALANCED_OR_BOTH', 'LEANS_RIGHT', 'RIGHT', 'CONTEXT_DEPENDENT', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "EvidenceSupportType" AS ENUM ('SUPPORT', 'COUNTER', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "AxisAssessmentStatus" AS ENUM ('CONFIRMED_PATTERN', 'CURRENT_HYPOTHESIS', 'INSUFFICIENT_EVIDENCE');

-- CreateEnum
CREATE TYPE "UserAssessment" AS ENUM ('UNREVIEWED', 'MATCHES', 'PARTIALLY_MATCHES', 'DOES_NOT_MATCH', 'NEEDS_EXPLORATION');

-- CreateEnum
CREATE TYPE "CompanyOrigin" AS ENUM ('USER_REGISTERED', 'CURATED');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('URL', 'TEXT', 'PDF', 'DOCX', 'TXT');

-- CreateEnum
CREATE TYPE "SourceTrustLevel" AS ENUM ('OFFICIAL', 'USER_PROVIDED_UNVERIFIED');

-- CreateEnum
CREATE TYPE "CompanyFactCategory" AS ENUM ('MISSION', 'BUSINESS', 'PRODUCT_OR_SERVICE', 'DESIRED_CANDIDATE', 'REQUIRED_SKILL', 'WORK_ENVIRONMENT', 'INTERNSHIP_DETAIL', 'ELIGIBILITY', 'DEADLINE', 'LOCATION', 'WORK_STYLE', 'OTHER');

-- CreateEnum
CREATE TYPE "EsDocumentStatus" AS ENUM ('DRAFT', 'ANALYZED', 'REVISED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ResultFreshness" AS ENUM ('CURRENT', 'STALE');

-- CreateEnum
CREATE TYPE "EsSourceKind" AS ENUM ('ORIGINAL', 'REVISION');

-- CreateEnum
CREATE TYPE "QuestionCoverage" AS ENUM ('ANSWERED', 'PARTIALLY_ANSWERED', 'NOT_ANSWERED');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('PERSONAL_FACT', 'NUMBER', 'PERIOD', 'ROLE', 'RESULT', 'CAPABILITY', 'COMPANY_FACT', 'MOTIVATION', 'FUTURE_GOAL');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('VERIFIED', 'PARTIALLY_VERIFIED', 'NEEDS_CONFIRMATION', 'CONTRADICTED');

-- CreateEnum
CREATE TYPE "SourceEvidenceType" AS ENUM ('EXPERIENCE', 'COMPANY_FACT');

-- CreateEnum
CREATE TYPE "RevisionDecision" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SubmissionReadiness" AS ENUM ('READY_TO_SUBMIT', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "RecommendationRunStatus" AS ENUM ('QUEUED', 'FETCHING_SOURCES', 'ANALYZING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RecommendationSlot" AS ENUM ('PRIMARY', 'CHALLENGE', 'UNEXPECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "google_subject" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" BOOLEAN NOT NULL DEFAULT true,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "last_login_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "AnalysisSessionStatus" NOT NULL,
    "target_axes_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "analysis_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "role" "MessageRole" NOT NULL,
    "content" TEXT NOT NULL,
    "question_target" "QuestionTarget",
    "evidence_candidates_json" JSONB,
    "turn_metadata_json" JSONB,
    "client_message_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experiences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "source_session_id" TEXT,
    "source_message_id" TEXT,
    "type" "ExperienceType" NOT NULL,
    "title" TEXT NOT NULL,
    "situation" TEXT NOT NULL,
    "goal" TEXT,
    "role" TEXT NOT NULL,
    "options_json" JSONB NOT NULL,
    "decision" TEXT,
    "decision_reason" TEXT,
    "actions_json" JSONB NOT NULL,
    "result" TEXT,
    "positive_emotion" TEXT,
    "negative_emotion" TEXT,
    "energy_change" INTEGER NOT NULL,
    "environment_json" JSONB NOT NULL,
    "status" "ExperienceStatus" NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "experience_quotes" (
    "id" TEXT NOT NULL,
    "experience_id" TEXT NOT NULL,
    "message_id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "experience_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "axis_evidence_items" (
    "id" TEXT NOT NULL,
    "experience_id" TEXT NOT NULL,
    "message_id" TEXT,
    "axis" "SelfAnalysisAxis" NOT NULL,
    "pole" "AxisPole" NOT NULL,
    "statement" TEXT NOT NULL,
    "support_type" "EvidenceSupportType" NOT NULL,
    "quote" TEXT NOT NULL,
    "interpretation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "axis_evidence_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "axis_assessments" (
    "id" TEXT NOT NULL,
    "source_session_id" TEXT NOT NULL,
    "axis" "SelfAnalysisAxis" NOT NULL,
    "position" "AxisPosition" NOT NULL,
    "ai_statement" TEXT NOT NULL,
    "display_statement" TEXT NOT NULL,
    "status" "AxisAssessmentStatus" NOT NULL,
    "left_conditions_json" JSONB NOT NULL,
    "right_conditions_json" JSONB NOT NULL,
    "context_notes_json" JSONB NOT NULL,
    "user_assessment" "UserAssessment" NOT NULL DEFAULT 'UNREVIEWED',
    "user_note" TEXT,
    "internal_confidence" DOUBLE PRECISION,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "axis_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "axis_assessment_evidence" (
    "axis_assessment_id" TEXT NOT NULL,
    "evidence_id" TEXT NOT NULL,

    CONSTRAINT "axis_assessment_evidence_pkey" PRIMARY KEY ("axis_assessment_id","evidence_id")
);

-- CreateTable
CREATE TABLE "self_analysis_reports" (
    "id" TEXT NOT NULL,
    "source_session_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "axis_snapshots_json" JSONB NOT NULL,
    "must_conditions_json" JSONB NOT NULL,
    "prefer_conditions_json" JSONB NOT NULL,
    "avoid_conditions_json" JSONB NOT NULL,
    "verify_conditions_json" JSONB NOT NULL,
    "next_experiments_json" JSONB NOT NULL,
    "user_message_count" INTEGER NOT NULL,
    "confirmed_experience_count" INTEGER NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "self_analysis_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overall_self_analysis_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "axis_trends_json" JSONB NOT NULL,
    "strengths_json" JSONB NOT NULL,
    "weaknesses_json" JSONB NOT NULL,
    "source_report_ids_json" JSONB NOT NULL,
    "completed_session_count" INTEGER NOT NULL,
    "user_message_count" INTEGER NOT NULL,
    "confirmed_experience_count" INTEGER NOT NULL,
    "is_data_sparse" BOOLEAN NOT NULL,
    "data_warning_reasons_json" JSONB NOT NULL,
    "freshness" "ResultFreshness" NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overall_self_analysis_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "target_role" TEXT,
    "origin" "CompanyOrigin" NOT NULL DEFAULT 'USER_REGISTERED',
    "official_url" TEXT,
    "career_url" TEXT,
    "recommendation_eligible" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_sources" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "type" "SourceType" NOT NULL,
    "trust_level" "SourceTrustLevel" NOT NULL,
    "title" TEXT NOT NULL,
    "source_url" TEXT,
    "raw_text" TEXT NOT NULL,
    "content_hash" TEXT NOT NULL,
    "unknown_items_json" JSONB NOT NULL DEFAULT '[]',
    "retrieved_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_facts" (
    "id" TEXT NOT NULL,
    "company_source_id" TEXT NOT NULL,
    "category" "CompanyFactCategory" NOT NULL,
    "fact" TEXT NOT NULL,
    "evidence_quote" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_facts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "es_documents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_id" TEXT,
    "target_role" TEXT,
    "question" TEXT NOT NULL,
    "character_limit" INTEGER NOT NULL,
    "original_text" TEXT NOT NULL,
    "preferred_experience_ids_json" JSONB NOT NULL,
    "emphasis_json" JSONB NOT NULL,
    "status" "EsDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "es_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "es_analyses" (
    "id" TEXT NOT NULL,
    "es_document_id" TEXT NOT NULL,
    "revision_id" TEXT,
    "source_kind" "EsSourceKind" NOT NULL,
    "freshness" "ResultFreshness" NOT NULL,
    "character_count" INTEGER NOT NULL,
    "within_character_limit" BOOLEAN NOT NULL,
    "question_coverage" "QuestionCoverage" NOT NULL,
    "submission_readiness" "SubmissionReadiness" NOT NULL,
    "issues_json" JSONB NOT NULL,
    "comments_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "es_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "es_claims" (
    "id" TEXT NOT NULL,
    "es_analysis_id" TEXT NOT NULL,
    "sentence" TEXT NOT NULL,
    "claim_text" TEXT NOT NULL,
    "claim_type" "ClaimType" NOT NULL,
    "status" "ClaimStatus" NOT NULL,
    "explanation" TEXT,
    "start_offset" INTEGER,
    "end_offset" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "es_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "es_claim_evidence" (
    "id" TEXT NOT NULL,
    "es_claim_id" TEXT NOT NULL,
    "source_type" "SourceEvidenceType" NOT NULL,
    "source_id" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "es_claim_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "es_revisions" (
    "id" TEXT NOT NULL,
    "es_document_id" TEXT NOT NULL,
    "based_on_analysis_id" TEXT NOT NULL,
    "freshness" "ResultFreshness" NOT NULL,
    "revised_text" TEXT NOT NULL,
    "used_experience_ids_json" JSONB NOT NULL,
    "used_session_report_ids_json" JSONB NOT NULL,
    "character_count" INTEGER NOT NULL,
    "verification_analysis_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "es_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "revision_changes" (
    "id" TEXT NOT NULL,
    "es_revision_id" TEXT NOT NULL,
    "before_text" TEXT NOT NULL,
    "after_text" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence_json" JSONB NOT NULL,
    "decision" "RevisionDecision" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "revision_changes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recommendation_runs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "self_analysis_report_id" TEXT NOT NULL,
    "status" "RecommendationRunStatus" NOT NULL DEFAULT 'QUEUED',
    "candidate_company_ids_json" JSONB NOT NULL,
    "target_roles_json" JSONB NOT NULL,
    "preferred_locations_json" JSONB NOT NULL,
    "refresh_official_sources" BOOLEAN NOT NULL DEFAULT true,
    "progress_total" INTEGER NOT NULL DEFAULT 0,
    "progress_fetched" INTEGER NOT NULL DEFAULT 0,
    "progress_analyzed" INTEGER NOT NULL DEFAULT 0,
    "progress_failed" INTEGER NOT NULL DEFAULT 0,
    "warnings_json" JSONB NOT NULL,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recommendation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_recommendations" (
    "id" TEXT NOT NULL,
    "recommendation_run_id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "slot" "RecommendationSlot" NOT NULL,
    "rank" INTEGER NOT NULL,
    "recommended_role" TEXT,
    "rationale" TEXT NOT NULL,
    "connected_experience_ids_json" JSONB NOT NULL,
    "matching_conditions_json" JSONB NOT NULL,
    "concerns_json" JSONB NOT NULL,
    "unknowns" JSONB NOT NULL,
    "verification_questions_json" JSONB NOT NULL,
    "company_source_ids_json" JSONB NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "company_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "auth_sessions_user_id_expires_at_idx" ON "auth_sessions"("user_id", "expires_at");

-- CreateIndex
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "analysis_sessions_user_id_status_idx" ON "analysis_sessions"("user_id", "status");

-- CreateIndex
CREATE INDEX "messages_session_id_created_at_idx" ON "messages"("session_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "messages_session_id_client_message_id_key" ON "messages"("session_id", "client_message_id");

-- CreateIndex
CREATE INDEX "experiences_user_id_status_idx" ON "experiences"("user_id", "status");

-- CreateIndex
CREATE INDEX "experiences_source_message_id_idx" ON "experiences"("source_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "experience_quotes_experience_id_message_id_quote_key" ON "experience_quotes"("experience_id", "message_id", "quote");

-- CreateIndex
CREATE INDEX "axis_evidence_items_experience_id_idx" ON "axis_evidence_items"("experience_id");

-- CreateIndex
CREATE INDEX "axis_evidence_items_axis_pole_idx" ON "axis_evidence_items"("axis", "pole");

-- CreateIndex
CREATE INDEX "axis_assessments_axis_status_idx" ON "axis_assessments"("axis", "status");

-- CreateIndex
CREATE UNIQUE INDEX "axis_assessments_source_session_id_axis_key" ON "axis_assessments"("source_session_id", "axis");

-- CreateIndex
CREATE UNIQUE INDEX "self_analysis_reports_source_session_id_key" ON "self_analysis_reports"("source_session_id");

-- CreateIndex
CREATE INDEX "self_analysis_reports_generated_at_idx" ON "self_analysis_reports"("generated_at");

-- CreateIndex
CREATE UNIQUE INDEX "overall_self_analysis_profiles_user_id_key" ON "overall_self_analysis_profiles"("user_id");

-- CreateIndex
CREATE INDEX "companies_user_id_recommendation_eligible_idx" ON "companies"("user_id", "recommendation_eligible");

-- CreateIndex
CREATE INDEX "company_sources_company_id_idx" ON "company_sources"("company_id");

-- CreateIndex
CREATE INDEX "company_facts_company_source_id_idx" ON "company_facts"("company_source_id");

-- CreateIndex
CREATE INDEX "company_facts_category_idx" ON "company_facts"("category");

-- CreateIndex
CREATE INDEX "es_documents_user_id_updated_at_idx" ON "es_documents"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "es_documents_company_id_idx" ON "es_documents"("company_id");

-- CreateIndex
CREATE INDEX "es_analyses_es_document_id_created_at_idx" ON "es_analyses"("es_document_id", "created_at");

-- CreateIndex
CREATE INDEX "es_claims_es_analysis_id_idx" ON "es_claims"("es_analysis_id");

-- CreateIndex
CREATE UNIQUE INDEX "es_claim_evidence_es_claim_id_source_type_source_id_quote_key" ON "es_claim_evidence"("es_claim_id", "source_type", "source_id", "quote");

-- CreateIndex
CREATE UNIQUE INDEX "es_revisions_verification_analysis_id_key" ON "es_revisions"("verification_analysis_id");

-- CreateIndex
CREATE INDEX "es_revisions_es_document_id_created_at_idx" ON "es_revisions"("es_document_id", "created_at");

-- CreateIndex
CREATE INDEX "revision_changes_es_revision_id_idx" ON "revision_changes"("es_revision_id");

-- CreateIndex
CREATE INDEX "recommendation_runs_user_id_created_at_idx" ON "recommendation_runs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "company_recommendations_recommendation_run_id_rank_idx" ON "company_recommendations"("recommendation_run_id", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "company_recommendations_recommendation_run_id_company_id_key" ON "company_recommendations"("recommendation_run_id", "company_id");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_sessions" ADD CONSTRAINT "analysis_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "analysis_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_source_session_id_fkey" FOREIGN KEY ("source_session_id") REFERENCES "analysis_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_source_message_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiences" ADD CONSTRAINT "experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_quotes" ADD CONSTRAINT "experience_quotes_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experience_quotes" ADD CONSTRAINT "experience_quotes_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "axis_evidence_items" ADD CONSTRAINT "axis_evidence_items_experience_id_fkey" FOREIGN KEY ("experience_id") REFERENCES "experiences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "axis_evidence_items" ADD CONSTRAINT "axis_evidence_items_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "axis_assessments" ADD CONSTRAINT "axis_assessments_source_session_id_fkey" FOREIGN KEY ("source_session_id") REFERENCES "analysis_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "axis_assessment_evidence" ADD CONSTRAINT "axis_assessment_evidence_axis_assessment_id_fkey" FOREIGN KEY ("axis_assessment_id") REFERENCES "axis_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "axis_assessment_evidence" ADD CONSTRAINT "axis_assessment_evidence_evidence_id_fkey" FOREIGN KEY ("evidence_id") REFERENCES "axis_evidence_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_analysis_reports" ADD CONSTRAINT "self_analysis_reports_source_session_id_fkey" FOREIGN KEY ("source_session_id") REFERENCES "analysis_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overall_self_analysis_profiles" ADD CONSTRAINT "overall_self_analysis_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "companies" ADD CONSTRAINT "companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_sources" ADD CONSTRAINT "company_sources_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_facts" ADD CONSTRAINT "company_facts_company_source_id_fkey" FOREIGN KEY ("company_source_id") REFERENCES "company_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "es_documents" ADD CONSTRAINT "es_documents_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "es_documents" ADD CONSTRAINT "es_documents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "es_analyses" ADD CONSTRAINT "es_analyses_es_document_id_fkey" FOREIGN KEY ("es_document_id") REFERENCES "es_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "es_analyses" ADD CONSTRAINT "es_analyses_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "es_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "es_claims" ADD CONSTRAINT "es_claims_es_analysis_id_fkey" FOREIGN KEY ("es_analysis_id") REFERENCES "es_analyses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "es_claim_evidence" ADD CONSTRAINT "es_claim_evidence_es_claim_id_fkey" FOREIGN KEY ("es_claim_id") REFERENCES "es_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "es_revisions" ADD CONSTRAINT "es_revisions_es_document_id_fkey" FOREIGN KEY ("es_document_id") REFERENCES "es_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "es_revisions" ADD CONSTRAINT "es_revisions_based_on_analysis_id_fkey" FOREIGN KEY ("based_on_analysis_id") REFERENCES "es_analyses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "es_revisions" ADD CONSTRAINT "es_revisions_verification_analysis_id_fkey" FOREIGN KEY ("verification_analysis_id") REFERENCES "es_analyses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "revision_changes" ADD CONSTRAINT "revision_changes_es_revision_id_fkey" FOREIGN KEY ("es_revision_id") REFERENCES "es_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_self_analysis_report_id_fkey" FOREIGN KEY ("self_analysis_report_id") REFERENCES "self_analysis_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recommendation_runs" ADD CONSTRAINT "recommendation_runs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_recommendations" ADD CONSTRAINT "company_recommendations_recommendation_run_id_fkey" FOREIGN KEY ("recommendation_run_id") REFERENCES "recommendation_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "company_recommendations" ADD CONSTRAINT "company_recommendations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
