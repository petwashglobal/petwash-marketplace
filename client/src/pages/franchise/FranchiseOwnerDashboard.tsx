/**
 * Franchise Owner Dashboard — Phase 12, Step 2
 *
 * Route:   /franchise/:franchiseId/dashboard
 * Auth:    Firebase Bearer token → requireFranchiseOwner (backend)
 * Layout:  Period-filtered summary → station table → cycles + audit side-by-side
 *
 * Rules:
 *   - No business logic here — components are stateless renderers
 *   - Page owns: period selection, data fetching, severity sort for audit feed
 *   - Audit events sorted high → medium → low before hand-off to AuditEventFeed
 *   - Default fetcher uses queryKey[0] as URL — full URL including params goes there
 */

import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { AlertTriangle, Calendar, Activity } from 'lucide-react';
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
  franchiseId: number;
  currency:    string;
  today:       FinancialWindow;
  mtd:         FinancialWindow;
  last30:      FinancialWindow;
}

interface StationsResponse {
  franchiseId: number;
  period:      string;
  currency:    string;
  stations:    StationFinancial[];
}

interface PayoutsResponse {
  franchiseId: number;
  currency:    string;
  cycles:      PayoutCycle[];
}

interface AuditFeedResponse {
  franchiseId:  number;
  totalEvents:  number;
  events:       AuditEvent[];
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

// ─── Page component ───────────────────────────────────────────────────────────

export default function FranchiseOwnerDashboard() {
  const params = useParams<{ franchiseId: string }>();
  const franchiseId = params.franchiseId ?? '';

  const [period, setPeriod] = useState<Period>('last30');

  // ── Summary: all three periods in one call ────────────────────────────────
  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
  } = useQuery<SummaryResponse>({
    queryKey: [`/api/franchise/${franchiseId}/finance/summary`],
    enabled:  !!franchiseId,
  });

  // ── Station financials: re-fetches on period change ───────────────────────
  const {
    data: stationsData,
    isLoading: stationsLoading,
  } = useQuery<StationsResponse>({
    queryKey: [`/api/franchise/${franchiseId}/stations/financials?period=${period}`],
    enabled:  !!franchiseId,
  });

  // ── Payout cycles ─────────────────────────────────────────────────────────
  const {
    data: payoutsData,
    isLoading: payoutsLoading,
  } = useQuery<PayoutsResponse>({
    queryKey: [`/api/franchise/${franchiseId}/payouts`],
    enabled:  !!franchiseId,
  });

  // ── Audit feed ─────────────────────────────────────────────────────────────
  const {
    data: auditData,
    isLoading: auditLoading,
  } = useQuery<AuditFeedResponse>({
    queryKey: [`/api/franchise/${franchiseId}/audit-feed`],
    enabled:  !!franchiseId,
  });

  // ── Active financial window (selected period) ─────────────────────────────
  const activeWindow: FinancialWindow = summaryData?.[period] ?? EMPTY_WINDOW;

  // ── Audit events sorted: high severity first ──────────────────────────────
  const sortedEvents = auditData?.events ? sortBySeverity(auditData.events) : [];

  // ── Mismatch badge count ──────────────────────────────────────────────────
  const mismatchCount = payoutsData?.cycles.filter(c => c.hasReconciliationMismatch).length ?? 0;

  // ── Missing franchiseId ───────────────────────────────────────────────────
  if (!franchiseId) {
    return (
      <LuxuryPageWrapper title="Dashboard" description="Franchise financial overview">
        <div className="flex items-center justify-center h-48 text-sm text-gray-500">
          Franchise ID missing from URL.
        </div>
      </LuxuryPageWrapper>
    );
  }

  // ── API error ─────────────────────────────────────────────────────────────
  if (summaryError) {
    return (
      <LuxuryPageWrapper title="Dashboard" description="Franchise financial overview">
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          <span>Unable to load financial summary. Please refresh or contact support.</span>
        </div>
      </LuxuryPageWrapper>
    );
  }

  return (
    <LuxuryPageWrapper
      title="Financial Overview"
      description="Settlement-sourced P&L · Franchise view"
    >
      <div className="space-y-5 pb-10">

        {/* ── Header row ─────────────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              Financial Overview
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Franchise #{franchiseId} · All figures sourced from settled records
            </p>
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

        {/* ── Summary tiles (4 across) ────────────────────────────────────── */}
        <FinanceSummaryPanel
          data={activeWindow}
          ownerType="franchise"
          isLoading={summaryLoading}
        />

        {/* ── Station table (full width) ──────────────────────────────────── */}
        <StationFinancialsTable
          stations={stationsData?.stations ?? []}
          ownerType="franchise"
          isLoading={stationsLoading}
        />

        {/* ── Settlement cycles + Audit feed (side by side on large screens) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Settlement cycles */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Settlement Cycles
              </h2>
            </div>
            <PayoutCycleList
              cycles={payoutsData?.cycles ?? []}
              ownerType="franchise"
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
