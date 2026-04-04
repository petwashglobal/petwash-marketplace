/**
 * IntelligenceBadge — shows customer trust / behavior score
 * Can be used in admin lists, provider booking cards, or customer own profile.
 */

import { Shield, TrendingUp, AlertTriangle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface IntelligenceBadgeProps {
  trustScore: number;
  behaviorScore?: number;
  size?: 'sm' | 'md';
  showBehavior?: boolean;
  className?: string;
}

function trustColor(score: number) {
  if (score >= 75) return { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-700 dark:text-emerald-300', icon: 'text-emerald-600' };
  if (score >= 50) return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', icon: 'text-amber-600' };
  return { bg: 'bg-red-100 dark:bg-white', text: 'text-red-700 dark:text-red-300', icon: 'text-red-600' };
}

function TrustIcon({ score, className }: { score: number; className?: string }) {
  if (score >= 75) return <Shield className={cn('h-3.5 w-3.5', className)} />;
  if (score >= 50) return <TrendingUp className={cn('h-3.5 w-3.5', className)} />;
  return <AlertTriangle className={cn('h-3.5 w-3.5', className)} />;
}

export function IntelligenceBadge({
  trustScore,
  behaviorScore,
  size = 'sm',
  showBehavior = false,
  className,
}: IntelligenceBadgeProps) {
  const colors = trustColor(trustScore);
  const isSmall = size === 'sm';

  return (
    <TooltipProvider delayDuration={200}>
      <div className={cn('flex items-center gap-1.5', className)}>
        {/* Trust Score */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full font-medium border-0',
                colors.bg, colors.text,
                isSmall ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
              )}
            >
              <TrustIcon score={trustScore} className={colors.icon} />
              {Math.round(trustScore)}
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p className="font-medium">Trust Score: {trustScore.toFixed(1)}/100</p>
            <p className="text-muted-foreground mt-0.5">
              {trustScore >= 75 ? 'Highly trusted customer' : trustScore >= 50 ? 'Average trust' : 'Low trust — review bookings carefully'}
            </p>
          </TooltipContent>
        </Tooltip>

        {/* Behavior Score (optional) */}
        {showBehavior && behaviorScore !== undefined && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-white dark:text-blue-300',
                  isSmall ? 'text-xs px-2 py-0.5' : 'text-sm px-2.5 py-1',
                )}
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {Math.round(behaviorScore)}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              <p className="font-medium">Engagement Score: {behaviorScore.toFixed(1)}/100</p>
              <p className="text-muted-foreground mt-0.5">
                Based on booking history, recency, and repeat providers
              </p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

/**
 * Full intelligence panel — used in customer's own profile view
 */
export function IntelligencePanel({
  trustScore,
  behaviorScore,
  riskLevel,
  bookingHistoryCount,
  cancellationRate,
  journeyState,
}: {
  trustScore: number;
  behaviorScore: number;
  riskLevel: number;
  bookingHistoryCount: number;
  cancellationRate: number;
  journeyState?: string;
}) {
  const JOURNEY_LABELS: Record<string, { he: string; en: string; step: number }> = {
    visitor:      { he: 'מבקר',         en: 'Visitor',       step: 1 },
    browsing:     { he: 'מחפש שירות',   en: 'Browsing',      step: 2 },
    authenticated:{ he: 'מחובר',        en: 'Signed In',     step: 3 },
    ready_to_book:{ he: 'מוכן להזמנה', en: 'Ready to Book', step: 4 },
    booked:       { he: 'הוזמן',        en: 'Booked',        step: 5 },
  };

  const currentStep = JOURNEY_LABELS[journeyState ?? 'visitor']?.step ?? 1;

  return (
    <div className="space-y-4">
      {/* Score row */}
      <div className="grid grid-cols-3 gap-3">
        <ScoreCard label="Trust" labelHe="אמינות" score={trustScore} color="emerald" />
        <ScoreCard label="Engagement" labelHe="מעורבות" score={behaviorScore} color="blue" />
        <ScoreCard label="Risk" labelHe="סיכון" score={riskLevel} color="rose" invert />
      </div>

      {/* Journey progress */}
      {journeyState && (
        <div className="mt-3">
          <p className="text-xs text-muted-foreground mb-2 font-medium">מסע הלקוח</p>
          <div className="flex items-center gap-1">
            {Object.entries(JOURNEY_LABELS).map(([key, val]) => (
              <div key={key} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={cn(
                    'h-2 rounded-full w-full transition-all',
                    val.step <= currentStep ? 'bg-[#C6A664]' : 'bg-white dark:bg-white',
                  )}
                />
                {val.step === currentStep && (
                  <span className="text-[10px] text-[#C6A664] font-medium">{val.he}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
        <span>{bookingHistoryCount} הזמנות</span>
        <span>ביטולים: {(cancellationRate * 100).toFixed(0)}%</span>
      </div>
    </div>
  );
}

function ScoreCard({
  label, labelHe, score, color, invert,
}: {
  label: string; labelHe: string; score: number; color: string; invert?: boolean;
}) {
  const pct = Math.round(score);
  const colorMap: Record<string, string> = {
    emerald: 'stroke-emerald-500',
    blue:    'stroke-blue-500',
    rose:    'stroke-rose-500',
  };
  const trackMap: Record<string, string> = {
    emerald: 'stroke-emerald-100 dark:stroke-emerald-900/30',
    blue:    'stroke-blue-100 dark:stroke-blue-900/30',
    rose:    'stroke-rose-100 dark:stroke-rose-900/30',
  };

  // Mini arc SVG
  const r = 18;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center gap-1 p-3 rounded-xl bg-white dark:bg-white/40">
      <svg width="48" height="48" viewBox="0 0 48 48" className="-rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" strokeWidth="4" className={trackMap[color]} />
        <circle
          cx="24" cy="24" r={r} fill="none" strokeWidth="4"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          className={colorMap[color]}
        />
      </svg>
      <span className="text-lg font-bold -mt-10 relative z-10">{pct}</span>
      <span className="text-[10px] text-muted-foreground mt-1">{labelHe}</span>
    </div>
  );
}
