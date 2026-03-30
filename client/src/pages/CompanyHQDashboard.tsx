/**
 * Company / HQ Dashboard — Phase 12, Step 3
 *
 * Route:   /company/dashboard
 * Auth:    Firebase admin claim OR x-admin-secret → requireNetworkOwner (backend)
 * API:     /api/network/company/main/... (ownerType=company, ownerId=main)
 *
 * Uses the SAME five shared components as FranchiseOwnerDashboard.
 * ownerType='company' activates company-specific label/visibility rules:
 *   - Franchise Share column hidden (N/A — no external cut on company-owned stations)
 *   - Payout cycles show "Internal Settlement" status
 *   - No wording suggesting money is owed to an outside franchise operator
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { AlertTriangle, Calendar, Activity, Building2 } from 'lucide-react';
import {
  PeriodSelector,
  FinanceSummaryPanel,
  StationFinancialsTable,
  PayoutCycleList,
  AuditEventFeed,
} from '@/components/franchise-finance';
import type {
  Period,
  FinancialWindow,
  StationFinancial,
  PayoutCycle,
  AuditEvent,
  Severity,
} from '@/components/franchise-finance';

// ─── API response types ───────────────────────────────────────────────────────

interface SummaryResponse {
  currency:    string;
  today:       FinancialWindow;
  mtd:         FinancialWindow;
  last30:      FinancialWindow;
}

interface StationsResponse {
  period:      string;
  currency:    string;
  stations:    StationFinancial[];
}

interface PayoutsResponse {
  currency:    string;
  cycles:      PayoutCycle[];
}

interface AuditFeedResponse {
  totalEvents: number;
  events:      AuditEvent[];
}

// ─── Severity sort: high → medium → low, then most recent first ──────────────

const SEVERITY_ORDER: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

function sortBySeverity(events: AuditEvent[]): AuditEvent[] {
  return [...events].sort((a, b) => {
    const sd = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity];
    if (sd !== 0) return sd;
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  });
}

// ─── Empty financial window used while loading ────────────────────────────────

const EMPTY_WINDOW: FinancialWindow = {
  grossRevenue: 0, platformFees: 0, franchiseShare: 0,
  stationPayouts: 0, bookingCount: 0, settledCount: 0,
  pendingCount: 0, disputedCount: 0, disputedAmount: 0,
};

// ─── Base API path ────────────────────────────────────────────────────────────

const BASE = '/api/network/company/main';

// ─── Page component ───────────────────────────────────────────────────────────

export default function CompanyHQDashboard() {
  const [period, setPeriod] = useState<Period>('last30');

  // ── Summary: all three periods in one call ────────────────────────────────
  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery<SummaryResponse>({
    queryKey: [`${BASE}/finance/summary`],
  });

  // ── Station financials: re-fetches on period change ───────────────────────
  const {
    data: stationsData,
    isLoading: stationsLoading,
  } = useQuery<StationsResponse>({
    queryKey: [`${BASE}/stations/financials?period=${period}`],
  });

  // ── Settlement cycles ─────────────────────────────────────────────────────
  const {
    data: payoutsData,
    isLoading: payoutsLoading,
  } = useQuery<PayoutsResponse>({
    queryKey: [`${BASE}/payouts`],
  });

  // ── Audit feed ────────────────────────────────────────────────────────────
  const {
    data: auditData,
    isLoading: auditLoading,
  } = useQuery<AuditFeedResponse>({
    queryKey: [`${BASE}/audit-feed`],
  });

  // ── Active financial window ────────────────────────────────────────────────
  const activeWindow: FinancialWindow = summaryData?.[period] ?? EMPTY_WINDOW;

  // ── Audit events: high severity first ─────────────────────────────────────
  const sortedEvents = auditData?.events ? sortBySeverity(auditData.events) : [];

  // ── Reconciliation mismatch count ─────────────────────────────────────────
  const mismatchCount = payoutsData?.cycles.filter(c => c.hasReconciliationMismatch).length ?? 0;

  // ── Error state ───────────────────────────────────────────────────────────
  if (summaryError) {
    return (
      <LuxuryPageWrapper title="HQ Finance" description="Company financial overview">
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Unable to load HQ financial summary. Please refresh or contact support.</span>
        </div>
      </LuxuryPageWrapper>
    );
  }

  return (
    <LuxuryPageWrapper
      title="HQ Finance"
      description="Settlement-sourced P&L · Company view"
    >
      <div className="space-y-5 pb-10">

        {/* ── Header row ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-gray-500 flex-shrink-0" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                HQ Finance
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                Pet Wash Ltd · All figures sourced from settled records
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {mismatchCount > 0 && (
              <span className="flex items-center gap-1.5 rounded border border-red-400 bg-red-50 dark:bg-red-950 px-2.5 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                {mismatchCount} split mismatch{mismatchCount > 1 ? 'es' : ''} — review payouts
              </span>
            )}
            <PeriodSelector value={period} onChange={setPeriod} />
          </div>
        </div>

        {/* ── Summary tiles (company: franchise share hidden = N/A logic in component) */}
        <FinanceSummaryPanel
          data={activeWindow}
          ownerType="company"
          isLoading={summaryLoading}
        />

        {/* ── Station table (franchise share column suppressed for company view) */}
        <StationFinancialsTable
          stations={stationsData?.stations ?? []}
          ownerType="company"
          isLoading={stationsLoading}
          buildDrilldownUrl={(sid) => `/company/stations/${sid}/settlements`}
        />

        {/* ── Internal settlement cycles + audit feed ─────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Internal settlement cycles */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Internal Settlement Cycles
              </h2>
            </div>
            <PayoutCycleList
              cycles={payoutsData?.cycles ?? []}
              ownerType="company"
              isLoading={payoutsLoading}
            />
          </div>

          {/* Audit feed — high severity first */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Network Events
              </h2>
              <span className="ml-auto text-xs text-gray-400">High severity first</span>
            </div>
            <AuditEventFeed
              events={sortedEvents}
              isLoading={auditLoading}
            />
          </div>
        </div>

      </div>
    </LuxuryPageWrapper>
  );
}
