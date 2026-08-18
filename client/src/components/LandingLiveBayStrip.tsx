/**
 * LandingLiveBayStrip — a compact, live status strip for the Landing hero.
 *
 * Reads the SAME `/api/k9000/stations/:id/bay-status` that /k9000/wash-now uses
 * (see client/src/pages/k9000/BayStatus.tsx) but presents it as a slim two-chip
 * bar (Bay 1 · Bay 2) with a subtle "LIVE" indicator. Renders directly under
 * the hero image on Landing to prove — visibly — that we run real hardware.
 * Competitors without a station literally cannot match this signal.
 *
 * Fail-quiet: if the API is unreachable or the station is offline, we still
 * render the strip in a neutral "checking…" state rather than hiding it — a
 * missing strip would silently regress the visual proof; a neutral one keeps
 * the shape and reads honestly.
 */
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Circle, WifiOff } from 'lucide-react';

interface BayStatusResponse {
  station_id: string;
  station_online: boolean;
  bay_1_status: string;
  bay_2_status: string;
  bay_1_ready: boolean;
  bay_2_ready: boolean;
  maintenance_mode: boolean;
  estimated_wait_minutes: number | null;
}

interface Props {
  /** Station ID to poll. Defaults to the Kfar Saba flagship (id "1"). */
  stationId?: string;
  language?: string;
}

export function LandingLiveBayStrip({ stationId = '1', language = 'en' }: Props) {
  const isHe = language === 'he';
  const { data, isLoading, isError } = useQuery<BayStatusResponse>({
    queryKey: ['/api/k9000/stations', stationId, 'bay-status'],
    queryFn: async () => {
      const res = await fetch(`/api/k9000/stations/${stationId}/bay-status`);
      if (!res.ok) throw new Error('bay-status unavailable');
      return res.json();
    },
    refetchInterval: 15000, // Live signal — the whole point.
    staleTime: 10000,
    // Never let a failed poll take out the Landing page — surface via isError.
    retry: 1,
  });

  const stationLabel = isHe ? 'עמדת כפר סבא · פארק 80' : 'Kfar Saba · Park 80';

  return (
    <div
      data-testid="landing-live-bay-strip"
      className="mx-auto mt-6 max-w-sm sm:max-w-lg lg:max-w-2xl rounded-2xl border border-[#c6a664]/30 bg-white/95 backdrop-blur px-4 py-3 shadow-sm"
      dir={isHe ? 'rtl' : 'ltr'}
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-600">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" aria-hidden />
            {isHe ? 'שידור חי' : 'Live'}
          </span>
          <span className="text-xs sm:text-sm text-[#333] truncate">{stationLabel}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BayChip
            label={isHe ? 'עמדה 1' : 'Bay 1'}
            isReady={!!data?.bay_1_ready}
            isLoading={isLoading}
            isError={isError || !data?.station_online}
          />
          <BayChip
            label={isHe ? 'עמדה 2' : 'Bay 2'}
            isReady={!!data?.bay_2_ready}
            isLoading={isLoading}
            isError={isError || !data?.station_online}
          />
        </div>
      </div>
    </div>
  );
}

function BayChip({ label, isReady, isLoading, isError }: {
  label: string; isReady: boolean; isLoading: boolean; isError: boolean;
}) {
  if (isError) {
    return (
      <span
        data-testid={`bay-chip-${label.replace(/\s+/g, '-').toLowerCase()}`}
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] sm:text-xs text-gray-500"
        title="Signal not available right now"
      >
        <WifiOff className="w-3 h-3" aria-hidden />
        {label}
      </span>
    );
  }
  if (isLoading) {
    return (
      <span
        data-testid={`bay-chip-${label.replace(/\s+/g, '-').toLowerCase()}`}
        className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2 py-1 text-[11px] sm:text-xs text-gray-400"
      >
        <Circle className="w-3 h-3 animate-pulse" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <span
      data-testid={`bay-chip-${label.replace(/\s+/g, '-').toLowerCase()}`}
      className={
        isReady
          ? 'inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-1 text-[11px] sm:text-xs text-green-700 font-semibold'
          : 'inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] sm:text-xs text-amber-700 font-semibold'
      }
    >
      {isReady ? <CheckCircle2 className="w-3 h-3" aria-hidden /> : <Circle className="w-3 h-3" aria-hidden />}
      {label}
    </span>
  );
}
