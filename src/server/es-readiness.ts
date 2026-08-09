export function esSubmissionReadiness(input: {
  withinCharacterLimit: boolean;
  questionCoverage: string;
  claimStatuses: string[];
}): 'READY_TO_SUBMIT' | 'NEEDS_REVIEW' {
  return input.withinCharacterLimit
    && input.questionCoverage === 'ANSWERED'
    && input.claimStatuses.length > 0
    && input.claimStatuses.every((status) => status === 'VERIFIED')
    ? 'READY_TO_SUBMIT'
    : 'NEEDS_REVIEW';
}
