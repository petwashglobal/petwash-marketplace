/**
 * LoyaltyStreakCard — streak progress visualization for dashboard embeds.
 * Shows walk / sit booking counts + same-provider streak with milestone progress bars.
 *
 * Milestone schedule (must match loyalty_rules in DB):
 *   Walks  : 3, 5, 10, 15
 *   Sits   : 3, 5, 10, 15
 *   Provider: 3, 5
 */

import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Footprints, Home, Star, Loader2 } from "lucide-react";
import { useFirebaseAuth } from "@/auth/AuthProvider";

interface StreakSummary {
  walkBookings:  number;
  sitBookings:   number;
  consecutiveSameProvider: { providerId: string; count: number } | null;
}

interface SummaryData {
  streaks: StreakSummary;
}

interface Props {
  data?: SummaryData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const MILESTONES = [3, 5, 10, 15];
const PROVIDER_MILESTONES = [3, 5];

function nextMilestone(count: number, milestones: number[]): number {
  return milestones.find(m => m > count) ?? milestones[milestones.length - 1];
}

function prevMilestone(count: number, milestones: number[]): number {
  const prev = [...milestones].reverse().find(m => m <= count);
  return prev ?? 0;
}

function progress(count: number, milestones: number[]): number {
  const prev = prevMilestone(count, milestones);
  const next = nextMilestone(count, milestones);
  if (next === prev) return 100;
  return Math.round(((count - prev) / (next - prev)) * 100);
}

// ── Sub-component ─────────────────────────────────────────────────────────────

function StreakRow({
  icon,
  label,
  count,
  milestones,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  milestones: number[];
  color: string;
}) {
  const next = nextMilestone(count, milestones);
  const pct  = progress(count, milestones);
  const done = count >= milestones[milestones.length - 1];

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className="text-base">{icon}</span>
          <span className="text-xs font-semibold text-gray-700">{label}</span>
        </div>
        <div className="text-xs text-gray-400">
          {count}
          {!done && <span className="text-gray-300"> / {next}</span>}
          {done && <span className="text-emerald-500"> ✓</span>}
        </div>
      </div>
      {/* Progress track */}
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(100, pct)}%`, backgroundColor: color }}
        />
      </div>
      {/* Milestone markers */}
      <div className="relative h-3 mt-0.5">
        {milestones.map(m => {
          const pos = prevMilestone(m, milestones);
          const max = milestones[milestones.length - 1];
          const left = `${(m / max) * 100}%`;
          return (
            <span
              key={m}
              className={`absolute text-[9px] -translate-x-1/2 ${count >= m ? "text-emerald-500 font-bold" : "text-gray-300"}`}
              style={{ left }}
            >
              {m}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LoyaltyStreakCard({ data: propData }: Props) {
  const { user } = useFirebaseAuth();

  const { data: fetchedData, isLoading } = useQuery<SummaryData>({
    queryKey: ["/api/loyalty-credits/summary"],
    enabled:  !!user && !propData,
    staleTime: 60_000,
  });

  const data   = propData ?? fetchedData;
  const streaks = data?.streaks;

  if (!user) return null;

  if (isLoading || !streaks) {
    return (
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 flex items-center justify-center h-32">
        <Loader2 className="w-5 h-5 text-gray-200 animate-spin" />
      </div>
    );
  }

  const providerCount = streaks.consecutiveSameProvider?.count ?? 0;

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-800">התקדמות רצף</p>
        <Link href="/loyalty/credits">
          <a className="text-[11px] text-[#C5A55A] hover:underline">היסטוריה</a>
        </Link>
      </div>

      <StreakRow
        icon={<Footprints className="w-4 h-4 text-blue-400" />}
        label="טיולים שהושלמו"
        count={streaks.walkBookings}
        milestones={MILESTONES}
        color="#3B82F6"
      />

      <StreakRow
        icon={<Home className="w-4 h-4 text-purple-400" />}
        label="שמירות שהושלמו"
        count={streaks.sitBookings}
        milestones={MILESTONES}
        color="#A855F7"
      />

      <StreakRow
        icon={<Star className="w-4 h-4 text-[#C5A55A]" />}
        label="הזמנות רצופות — ספק קבוע"
        count={providerCount}
        milestones={PROVIDER_MILESTONES}
        color="#C5A55A"
      />

      <p className="text-[10px] text-gray-300 text-center">
        השלם הזמנות כדי לפתוח בונוסים
      </p>
    </div>
  );
}

export default LoyaltyStreakCard;
