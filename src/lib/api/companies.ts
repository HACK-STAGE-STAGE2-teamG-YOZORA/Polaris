import { apiGet, apiPost } from "@/lib/api/client";
import type {
  Company,
  CompanyImportResult,
  CompanyPage,
  CreateCompanyRequest,
  ImportCompanyTextRequest,
} from "@/types/company";

export function listCompanies(): Promise<CompanyPage> {
  return apiGet<CompanyPage>("/companies");
}

export function getCompany(companyId: string): Promise<Company> {
  return apiGet<Company>(`/companies/${companyId}`);
}

export function createCompany(request: CreateCompanyRequest): Promise<Company> {
  return apiPost<Company>("/companies", request);
}

export function importCompanyText(
  companyId: string,
  request: ImportCompanyTextRequest,
): Promise<CompanyImportResult> {
  return apiPost<CompanyImportResult>(`/companies/${companyId}/sources/text`, request);
}
