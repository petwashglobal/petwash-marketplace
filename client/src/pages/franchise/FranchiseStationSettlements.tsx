/**
 * FranchiseStationSettlements — Phase 12.6 Drill-down
 * Route: /franchise/:franchiseId/stations/:stationId/settlements
 *
 * Shows individual station_settlements rows for one station owned by
 * this franchise. Back link returns to the franchise dashboard.
 */

import { useParams, Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ArrowRight, Building2 } from 'lucide-react';
import {
  PeriodSelector,
  SettlementLedger,
} from '@/components/franchise-finance';
import type { Period, SettlementRow, SettlementLedgerSummary } from '@/components/franchise-finance';

interface DrilldownResponse {
  franchiseId:  number;
  stationId:    number;
  stationName:  string;
  stationCode:  string;
  period:       Period;
  currency:     string;
  settlements:  SettlementRow[];
  summary:      SettlementLedgerSummary;
}

export default function FranchiseStationSettlements() {
  const { franchiseId, stationId } = useParams<{ franchiseId: string; stationId: string }>();
  const [period, setPeriod] = useState<Period>('last30');

  const url = `/api/franchise/${franchiseId}/stations/${stationId}/settlements?period=${period}`;
  const { data, isLoading, error } = useQuery<DrilldownResponse>({
    queryKey: [url],
  });

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

        {/* Back navigation */}
        <Link
          href={`/franchise/${franchiseId}/dashboard`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
        >
          <ArrowRight className="h-4 w-4 rotate-180" />
          Back to dashboard
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
              <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-black">
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
          ownerType="franchise"
          isLoading={isLoading}
        />

      </div>
    </div>
  );
}
