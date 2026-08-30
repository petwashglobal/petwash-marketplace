/**
 * ProviderHomeSectionsEvaluator — CEO PROGRAM 3 (Provider Home Brain).
 *
 * Pure evaluator. Given the provider's per-domain counts + flags,
 * returns an ORDERED list of sections the client should render on
 * /provider/today. The doctrine's priority order is:
 *   URGENT / today's active job or handoff
 *   Provider requests waiting on response
 *   Compliance blockers
 *   Earnings anomalies
 *   Upcoming jobs
 *   Messages
 *   Calendar
 *   Performance
 *   Profile
 *
 * The evaluator NEVER queries — it just orders sections the caller
 * has already gathered. Sections with zero relevant items are
 * dropped from the returned list.
 */

export type ProviderSection =
  | 'ACTIVE_JOB'
  | 'HANDOFF_DUE'
  | 'NEW_REQUESTS'
  | 'NEEDS_RESPONSE'
  | 'COMPLIANCE_BLOCKERS'
  | 'EARNINGS_ANOMALIES'
  | 'UPCOMING_JOBS'
  | 'MESSAGES'
  | 'CALENDAR'
  | 'PERFORMANCE'
  | 'PROFILE';

export interface ProviderHomeInput {
  hasActiveJobNow: boolean;
  handoffsDueNext30min: number;
  newRequestsAwaitingResponse: number;
  changeProposalsAwaitingResponse: number;
  complianceBlockers: number;                // KYC / insurance / etc.
  earningsAnomalies: number;                 // payout hold / dispute / fee issue
  upcomingJobsNext24h: number;
  unreadMessages: number;
  isProfileComplete: boolean;
}

export interface Section {
  code: ProviderSection;
  count?: number;
  reasonCode: string;
}

export function composeProviderHome(input: ProviderHomeInput): Section[] {
  const out: Section[] = [];
  if (input.hasActiveJobNow) out.push({ code: 'ACTIVE_JOB', reasonCode: 'ACTIVE_JOB_NOW' });
  if (input.handoffsDueNext30min > 0) out.push({ code: 'HANDOFF_DUE', count: input.handoffsDueNext30min, reasonCode: 'HANDOFF_DUE_SOON' });
  if (input.newRequestsAwaitingResponse > 0) out.push({ code: 'NEW_REQUESTS', count: input.newRequestsAwaitingResponse, reasonCode: 'NEW_REQUESTS_PENDING' });
  if (input.changeProposalsAwaitingResponse > 0) out.push({ code: 'NEEDS_RESPONSE', count: input.changeProposalsAwaitingResponse, reasonCode: 'CHANGE_PROPOSALS_PENDING' });
  if (input.complianceBlockers > 0) out.push({ code: 'COMPLIANCE_BLOCKERS', count: input.complianceBlockers, reasonCode: 'COMPLIANCE_ATTENTION' });
  if (input.earningsAnomalies > 0) out.push({ code: 'EARNINGS_ANOMALIES', count: input.earningsAnomalies, reasonCode: 'EARNINGS_ATTENTION' });
  if (input.upcomingJobsNext24h > 0) out.push({ code: 'UPCOMING_JOBS', count: input.upcomingJobsNext24h, reasonCode: 'UPCOMING_JOBS_24H' });
  if (input.unreadMessages > 0) out.push({ code: 'MESSAGES', count: input.unreadMessages, reasonCode: 'UNREAD_MESSAGES' });
  out.push({ code: 'CALENDAR', reasonCode: 'CALENDAR_SNAPSHOT' });
  out.push({ code: 'PERFORMANCE', reasonCode: 'PERFORMANCE_SNAPSHOT' });
  if (!input.isProfileComplete) out.push({ code: 'PROFILE', reasonCode: 'PROFILE_INCOMPLETE' });
  return out;
}
