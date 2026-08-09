export type CompanyOrigin = "USER_REGISTERED" | "CURATED";

export interface CompanySummary {
  id: string;
  name: string;
  targetRole: string | null;
  origin: CompanyOrigin;
  officialUrl: string | null;
  careerUrl: string | null;
  recommendationEligible: boolean;
  sourceCount: number;
  factCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyPage {
  items: CompanySummary[];
}

export interface CreateCompanyRequest {
  name: string;
  targetRole?: string;
  officialUrl?: string;
  careerUrl?: string;
  recommendationEligible?: boolean;
  note?: string;
}

export type SourceType = "URL" | "TEXT" | "PDF" | "DOCX" | "TXT";
export type SourceTrustLevel = "OFFICIAL" | "USER_PROVIDED_UNVERIFIED";

export interface CompanySource {
  id: string;
  type: SourceType;
  trustLevel: SourceTrustLevel;
  title: string;
  url: string | null;
  retrievedAt: string;
}

export type CompanyFactCategory =
  | "MISSION"
  | "BUSINESS"
  | "PRODUCT_OR_SERVICE"
  | "DESIRED_CANDIDATE"
  | "REQUIRED_SKILL"
  | "WORK_ENVIRONMENT"
  | "INTERNSHIP_DETAIL"
  | "ELIGIBILITY"
  | "DEADLINE"
  | "LOCATION"
  | "WORK_STYLE"
  | "OTHER";

export interface CompanyFact {
  id: string;
  sourceId: string;
  category: CompanyFactCategory;
  fact: string;
  evidenceQuote: string;
  sourceUrl: string | null;
}

export interface Company extends CompanySummary {
  note: string | null;
  sources: CompanySource[];
  facts: CompanyFact[];
  unknownItems: string[];
}

export interface ImportCompanyTextRequest {
  title: string;
  text: string;
  sourceUrl?: string;
  trustLevel: SourceTrustLevel;
}

export interface CompanyImportResult {
  source: CompanySource;
  facts: CompanyFact[];
  unknownItems: string[];
}
