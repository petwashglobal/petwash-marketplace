/**
 * Phase 9 — Provider Ranking Transparency Panel
 *
 * Providers see their tier, trust score, and a plain-language breakdown
 * of every factor that affects their marketplace ranking.
 *
 * Route: /provider/ranking
 * Auth:  provider Firebase token
 */

import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/lib/languageStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Crown,
  Award,
  Shield,
  Zap,
  TrendingUp,
  AlertTriangle,
  Star,
  Calendar,
  MessageSquareWarning,
  CheckCircle2,
  Info,
} from 'lucide-react';

// ─── Tier config ──────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  prestige: { label: 'Prestige', labelHe: 'פרסטיז', icon: Crown, color: 'bg-purple-100 text-purple-700 border-purple-300', barColor: 'bg-purple-500' },
  gold:     { label: 'Gold',     labelHe: 'זהב',    icon: Award,  color: 'bg-yellow-100 text-yellow-700 border-yellow-300', barColor: 'bg-yellow-500' },
  silver:   { label: 'Silver',   labelHe: 'כסף',   icon: Shield, color: 'bg-white text-gray-600 border-gray-300',       barColor: 'bg-gray-400' },
  bronze:   { label: 'Bronze',   labelHe: 'ארד',   icon: Zap,    color: 'bg-orange-100 text-orange-700 border-orange-300', barColor: 'bg-orange-500' },
  at_risk:  { label: 'At Risk',  labelHe: 'בסיכון',icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-300',   barColor: 'bg-red-500' },
  new:      { label: 'New',      labelHe: 'חדש',   icon: TrendingUp,    color: 'bg-blue-100 text-blue-700 border-blue-300', barColor: 'bg-blue-500' },
} as const;

type TierKey = keyof typeof TIER_CONFIG;

// ─── API response type ────────────────────────────────────────────────────────

type RankingFactor = {
  label: string;
  value?: string | number | null;
  count?: number;
  impact: string | number;
  description: string;
};

type MyRankingResponse = {
  tier: TierKey;
  rankingScore: number | null;
  trustScore: number | null;
  ratingAvg: string;
  ratingCount: number;
  isFlagged: boolean;
  breakdown: {
    trustComponent: number;
    ratingComponent: number;
    newProviderBoost: number;
    atRiskPenalty: number;
    adminBoost: number;
  };
  openDisputeCount: number;
  recentActions: Array<{ action: string; createdAt: string }>;
  factors: {
    trust: RankingFactor;
    rating: RankingFactor;
    availability: RankingFactor;
    disputes: RankingFactor;
  };
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function FactorCard({
  icon: Icon,
  label,
  impact,
  description,
  value,
  highlight,
}: {
  icon: React.ElementType;
  label: string;
  impact: string | number;
  description: string;
  value?: string | number | null;
  highlight?: 'good' | 'warn' | 'neutral';
}) {
  const highlightClasses = {
    good: 'border-green-200 bg-green-50',
    warn: 'border-red-200 bg-red-50',
    neutral: 'border-gray-200 bg-white',
  };

  return (
    <div className={`rounded-xl border p-4 flex gap-4 transition-colors ${highlightClasses[highlight ?? 'neutral']}`}>
      <div className="shrink-0 mt-0.5">
        <Icon className={`w-5 h-5 ${highlight === 'warn' ? 'text-red-500' : highlight === 'good' ? 'text-green-600' : 'text-gray-500'}`} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="font-semibold text-sm text-gray-800">{label}</span>
          {value !== undefined && value !== null && (
            <span className="text-sm font-bold text-gray-600">{value}</span>
          )}
          <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${
            typeof impact === 'number' && impact > 0
              ? 'bg-green-100 text-green-700'
              : typeof impact === 'number' && impact < 0
              ? 'bg-red-100 text-red-700'
              : 'bg-white text-gray-600'
          }`}>
            {typeof impact === 'number' ? (impact > 0 ? `+${impact}` : impact) : impact}
          </span>
        </div>
        <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function ProviderRankingPanel() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const { data, isLoading, error } = useQuery<MyRankingResponse>({
    queryKey: ['/api/marketplace/rankings/my-ranking'],
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-4 md:p-8" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
        <div className="max-w-2xl mx-auto space-y-4">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 p-8 flex items-center justify-center" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
        <Card className="max-w-sm w-full">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-gray-600 text-sm">
              {isHebrew ? 'לא נמצא פרופיל ספק' : 'Provider profile not found'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const tierCfg = TIER_CONFIG[data.tier] ?? TIER_CONFIG.silver;
  const TierIcon = tierCfg.icon;
  const score = data.rankingScore;

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950 p-4 md:p-8" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto space-y-5">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-black">
            {isHebrew ? 'הדירוג שלי' : 'My Marketplace Ranking'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">
            {isHebrew
              ? 'הבן מה משפיע על הנראות שלך בשוק'
              : 'Understand what drives your visibility in search results'}
          </p>
        </div>

        {/* Tier + Score card */}
        <Card className="overflow-hidden">
          <div className={`h-2 ${tierCfg.barColor}`} />
          <CardContent className="pt-5 pb-5">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold border ${tierCfg.color}`}>
                    <TierIcon className="w-4 h-4" />
                    {isHebrew ? tierCfg.labelHe : tierCfg.label}
                  </span>
                  {data.isFlagged && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300">
                      <AlertTriangle className="w-3 h-3" />
                      {isHebrew ? 'בבדיקה' : 'Under Review'}
                    </span>
                  )}
                </div>
                <div className="text-gray-500 text-sm">
                  {isHebrew ? 'דירוג מחושב' : 'Computed ranking score'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-5xl font-black text-gray-800 dark:text-black leading-none">
                  {score ?? '—'}
                </div>
                <div className="text-xs text-gray-400 mt-1">{isHebrew ? 'מתוך 100' : '/ 100'}</div>
              </div>
            </div>

            {/* Score bar */}
            {score !== null && (
              <div className="mt-4">
                <div className="h-2 bg-white rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${tierCfg.barColor}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>0</span>
                  <span className="text-gray-500 font-medium">
                    {score >= 80 ? (isHebrew ? 'פרסטיז — מצוין!' : 'Prestige — Excellent!')
                      : score >= 60 ? (isHebrew ? 'זהב — טוב מאוד' : 'Gold — Very Good')
                      : score >= 40 ? (isHebrew ? 'כסף — ממוצע' : 'Silver — Average')
                      : (isHebrew ? 'שפר ציונים' : 'Improve your score')}
                  </span>
                  <span>100</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Score breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-500" />
              {isHebrew ? 'פירוט הציון' : 'Score Breakdown'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-1 text-sm">
              {[
                {
                  label: isHebrew ? 'אמינות (trustScore)' : 'Trust component',
                  value: `+${data.breakdown.trustComponent}`,
                  desc: isHebrew ? 'trustScore × 0.45' : 'trustScore × 0.45',
                  color: 'text-green-700',
                },
                {
                  label: isHebrew ? 'דירוג לקוחות' : 'Rating component',
                  value: `+${data.breakdown.ratingComponent}`,
                  desc: isHebrew ? 'ממוצע × ביקורות' : 'avg rating × review weight',
                  color: 'text-green-700',
                },
                data.breakdown.newProviderBoost > 0 && {
                  label: isHebrew ? 'בונוס ספק חדש' : 'New provider boost',
                  value: `+${data.breakdown.newProviderBoost}`,
                  desc: isHebrew ? 'פחות מ-3 ביקורות' : 'Fewer than 3 reviews',
                  color: 'text-blue-700',
                },
                data.breakdown.adminBoost > 0 && {
                  label: isHebrew ? 'בונוס מנהל' : 'Admin boost',
                  value: `+${data.breakdown.adminBoost}`,
                  desc: isHebrew ? 'הופעל זמנית' : 'Temporarily active',
                  color: 'text-blue-700',
                },
                {
                  label: isHebrew ? 'זמינות' : 'Availability',
                  value: isHebrew ? 'עד +15' : 'up to +15',
                  desc: isHebrew ? 'פחות הזמנות = יותר נראות' : 'Fewer bookings = more visibility',
                  color: 'text-green-700',
                },
                data.breakdown.atRiskPenalty > 0 && {
                  label: isHebrew ? 'עונש בסיכון' : 'At-risk penalty',
                  value: `−${data.breakdown.atRiskPenalty}`,
                  desc: isHebrew ? 'trustScore מתחת ל-40' : 'trustScore below 40',
                  color: 'text-red-600',
                },
              ]
                .filter(Boolean)
                .map((row: any, i) => (
                  <div key={i} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                    <div>
                      <span className="text-gray-700">{row.label}</span>
                      <span className="text-gray-400 text-xs ml-2">{row.desc}</span>
                    </div>
                    <span className={`font-bold tabular-nums ${row.color}`}>{row.value}</span>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Factor explanations */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isHebrew ? 'מה משפיע על הדירוג שלך?' : 'What affects your ranking?'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <FactorCard
              icon={Shield}
              label={isHebrew ? data.factors.trust.label + ' (אמינות)' : data.factors.trust.label}
              value={data.trustScore !== null ? `${data.trustScore}/100` : undefined}
              impact={data.breakdown.trustComponent}
              description={data.factors.trust.description}
              highlight={
                (data.trustScore ?? 100) <= 40 ? 'warn'
                  : (data.trustScore ?? 0) >= 70 ? 'good'
                  : 'neutral'
              }
            />
            <FactorCard
              icon={Star}
              label={isHebrew ? 'דירוג לקוחות' : data.factors.rating.label}
              value={data.ratingCount > 0 ? `${data.ratingAvg} ⭐ (${data.ratingCount})` : undefined}
              impact={data.breakdown.ratingComponent}
              description={data.factors.rating.description}
              highlight={
                data.ratingCount >= 5 && parseFloat(data.ratingAvg) >= 4.5 ? 'good'
                  : parseFloat(data.ratingAvg) < 3 && data.ratingCount > 3 ? 'warn'
                  : 'neutral'
              }
            />
            <FactorCard
              icon={Calendar}
              label={isHebrew ? 'זמינות' : data.factors.availability.label}
              impact={data.factors.availability.impact}
              description={data.factors.availability.description}
              highlight="neutral"
            />
            <FactorCard
              icon={data.openDisputeCount > 0 ? MessageSquareWarning : CheckCircle2}
              label={isHebrew ? 'מחלוקות פתוחות' : data.factors.disputes.label}
              value={data.openDisputeCount > 0 ? data.openDisputeCount : undefined}
              impact={data.openDisputeCount > 0 ? data.factors.disputes.impact : isHebrew ? 'ללא השפעה' : 'None'}
              description={data.factors.disputes.description}
              highlight={data.openDisputeCount > 0 ? 'warn' : 'good'}
            />
          </CardContent>
        </Card>

        {/* Tier ladder */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              {isHebrew ? 'סולם הדרגות' : 'Tier Ladder'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {([
                { tier: 'prestige', min: 80, max: 100 },
                { tier: 'gold',     min: 60, max: 79  },
                { tier: 'silver',   min: 40, max: 59  },
                { tier: 'bronze',   min: 0,  max: 39  },
              ] as const).map(({ tier, min, max }) => {
                const cfg = TIER_CONFIG[tier];
                const TIcon = cfg.icon;
                const isCurrent = data.tier === tier;
                return (
                  <div
                    key={tier}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${isCurrent ? 'ring-2 ring-offset-1 ring-gray-400 bg-white' : ''}`}
                  >
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${cfg.color}`}>
                      <TIcon className="w-3 h-3" />
                      {isHebrew ? cfg.labelHe : cfg.label}
                    </span>
                    <span className="text-xs text-gray-500 flex-1">{min}–{max} {isHebrew ? 'נקודות' : 'pts'}</span>
                    {isCurrent && (
                      <span className="text-xs font-semibold text-gray-700">
                        ← {isHebrew ? 'אתה כאן' : 'You are here'}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent operator actions (provider-visible) */}
        {data.recentActions.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base text-gray-700">
                {isHebrew ? 'פעולות אחרונות על החשבון שלך' : 'Recent actions on your account'}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2">
                {data.recentActions.map((entry, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                    <span className="font-medium text-gray-700 capitalize">{entry.action}</span>
                    <span className="text-gray-400 text-xs">
                      {new Date(entry.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-IL', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
