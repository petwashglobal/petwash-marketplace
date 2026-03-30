/**
 * CompanyStationSettlements — Phase 12.6 Drill-down (company view)
 * Route: /company/stations/:stationId/settlements
 *
 * Shows individual station_settlements rows for one company-owned station.
 * Franchise share column is hidden (company stations never have a franchise split).
 * Back link returns to the company HQ dashboard.
 */

import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowRight, Factory } from 'lucide-react';
import {
  PeriodSelector,
  SettlementLedger,
} from '@/components/franchise-finance';
import type { Period, SettlementRow, SettlementLedgerSummary } from '@/components/franchise-finance';

interface DrilldownResponse {
  ownerType:    string;
  ownerId:      string;
  stationId:    number;
  stationName:  string;
  stationCode:  string;
  period:       Period;
  currency:     string;
  settlements:  SettlementRow[];
  summary:      SettlementLedgerSummary;
}

export default function CompanyStationSettlements() {
  const { stationId } = useParams<{ stationId: string }>();
  const [period, setPeriod] = useState<Period>('last30');

  const url = `/api/network/company/main/stations/${stationId}/settlements?period=${period}`;
  const { data, isLoading, error } = useQuery<DrilldownResponse>({
    queryKey: [url],
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Back navigation */}
        <Link
          href="/company/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          Back to HQ dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center flex-shrink-0">
              <Factory className="h-5 w-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {isLoading ? '...' : data?.stationName ?? `Station ${stationId}`}
              </h1>
              {data?.stationCode && (
                <p className="text-sm text-gray-500">{data.stationCode} · Settlement Ledger</p>
              )}
            </div>
          </div>
          <PeriodSelector value={period} onChange={setPeriod} />
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-4 text-sm text-red-700 dark:text-red-300">
            Failed to load settlements. Please try again.
          </div>
        )}

        <SettlementLedger
          rows={data?.settlements ?? []}
          summary={data?.summary ?? { total: 0, settled: 0, pending: 0, disputed: 0, mismatchCount: 0 }}
          ownerType="company"
          isLoading={isLoading}
        />

      </div>
    </div>
  );
}
