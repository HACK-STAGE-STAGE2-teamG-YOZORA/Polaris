import type { AxisPosition } from '@/types/dashboard';

type EvidenceLike = {
  id: string;
  experienceId: string;
  pole: string;
  supportType: string;
};

export function deriveAxisPosition(suggested: AxisPosition, evidence: EvidenceLike[]): AxisPosition {
  const supporting = evidence.filter((item) => item.supportType === 'SUPPORT');
  if (supporting.length === 0) return 'INSUFFICIENT_EVIDENCE';
  const poles = new Set(supporting.map((item) => item.pole));
  if (poles.has('CONTEXT_DEPENDENT')) return 'CONTEXT_DEPENDENT';
  if (poles.has('BOTH')) return 'BALANCED_OR_BOTH';
  const left = new Set(supporting.filter((item) => item.pole === 'LEFT').map((item) => item.experienceId)).size;
  const right = new Set(supporting.filter((item) => item.pole === 'RIGHT').map((item) => item.experienceId)).size;
  if (left > 0 && right > 0) {
    if ((suggested === 'LEFT' || suggested === 'LEANS_LEFT') && left > right) return suggested;
    if ((suggested === 'RIGHT' || suggested === 'LEANS_RIGHT') && right > left) return suggested;
    return 'BALANCED_OR_BOTH';
  }
  if (left > 0) return suggested === 'LEFT' || suggested === 'LEANS_LEFT' ? suggested : left > 1 ? 'LEFT' : 'LEANS_LEFT';
  if (right > 0) return suggested === 'RIGHT' || suggested === 'LEANS_RIGHT' ? suggested : right > 1 ? 'RIGHT' : 'LEANS_RIGHT';
  return 'INSUFFICIENT_EVIDENCE';
}

export function deriveAxisStatus(
  position: AxisPosition,
  userAssessment: string,
  evidence: EvidenceLike[],
): 'CONFIRMED_PATTERN' | 'CURRENT_HYPOTHESIS' | 'INSUFFICIENT_EVIDENCE' {
  if (position === 'INSUFFICIENT_EVIDENCE') return 'INSUFFICIENT_EVIDENCE';
  const hasSupportingExperience = evidence.some((item) => item.supportType === 'SUPPORT');
  const hasCounter = evidence.some((item) => item.supportType === 'COUNTER');
  if (hasSupportingExperience && !hasCounter && (userAssessment === 'MATCHES' || userAssessment === 'PARTIALLY_MATCHES')) {
    return 'CONFIRMED_PATTERN';
  }
  return 'CURRENT_HYPOTHESIS';
}
