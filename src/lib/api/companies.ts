import { apiGet } from "@/lib/api/client";
import type { CompanyPage } from "@/types/company";

export function listCompanies(): Promise<CompanyPage> {
  return apiGet<CompanyPage>("/companies");
}
