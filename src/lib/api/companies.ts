import { invalidateCompanyCaches } from "@/lib/api/cache";
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

export async function createCompany(request: CreateCompanyRequest): Promise<Company> {
  const company = await apiPost<Company>("/companies", request);
  invalidateCompanyCaches();
  return company;
}

export async function importCompanyText(
  companyId: string,
  request: ImportCompanyTextRequest,
): Promise<CompanyImportResult> {
  const result = await apiPost<CompanyImportResult>(`/companies/${companyId}/sources/text`, request);
  invalidateCompanyCaches();
  return result;
}
