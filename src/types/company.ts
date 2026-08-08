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
