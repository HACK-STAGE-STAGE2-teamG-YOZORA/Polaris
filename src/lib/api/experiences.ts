import { apiGet } from "@/lib/api/client";
import type { ExperiencePage } from "@/types/experience";

export function listConfirmedExperiences(): Promise<ExperiencePage> {
  return apiGet<ExperiencePage>("/experiences?status=CONFIRMED&limit=100");
}
