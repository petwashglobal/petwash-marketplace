/**
 * Phase 9 — Marketplace Intelligence Dashboard
 *
 * Operator view: all providers ranked by rankingScore.
 * Shows tier, trust score, dispute count, revenue contribution.
 * Actions: Boost 7 days, Suppress, Reset.
 *
 * Route: /admin/marketplace-intelligence
 * Auth:  requires x-admin-secret header
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import {
  Crown,
  Award,
  Shield,
  Zap,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  RotateCcw,
  Search,
  Flag,
  FlagOff,
  ClipboardList,
  X,
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

// ─── Tier config (mirrors Marketplace.tsx) ───────────────────────────────────

const TIER_CONFIG = {
  prestige: { label: 'Prestige', icon: Crown, color: 'bg-purple-100 text-purple-700 border-purple-300' },
  gold:     { label: 'Gold',     icon: Award,  color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  silver:   { label: 'Silver',   icon: Shield, color: 'bg-gray-100 text-gray-600 border-gray-300' },
  bronze:   { label: 'Bronze',   icon: Zap,    color: 'bg-orange-100 text-orange-700 border-orange-300' },
  at_risk:  { label: 'At Risk',  icon: AlertTriangle, color: 'bg-red-100 text-red-700 border-red-300' },
  new:      { label: 'New',      icon: TrendingUp,    color: 'bg-blue-100 text-blue-700 border-blue-300' },
} as const;

type ProviderRow = {
  userId: string;
  rankingScore: number | null;
  rankingOverride: number | null;
  rankingBoostUntil: string | null;
  rankingFlaggedAt: string | null;
  trustScore: number | null;
  ratingAvg: string | null;
  ratingCount: number | null;
  tier: keyof typeof TIER_CONFIG;
  disputeCount: number;
  revenueILS: number;
  rankingUpdatedAt: string | null;
};

type AuditEntry = {
  id: number;
  providerUserId: string;
  adminUid: string;
  action: string;
  note: string | null;
  createdAt: string;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function MarketplaceIntelligenceDashboard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [expandedAudit, setExpandedAudit] = useState<string | null>(null);
  const [adminSecret] = useState(
    () => localStorage.getItem('petwash_admin_secret') || ''
  );

  const headers: Record<string, string> = adminSecret
    ? { 'x-admin-secret': adminSecret }
    : {};

  // ── Fetch ranked providers ──────────────────────────────────────────────────

  const { data, isLoading, refetch } = useQuery<{ providers: ProviderRow[]; total: number }>({
    queryKey: ['/api/marketplace/rankings/providers'],
    enabled: !!user,
  });

  // ── Audit log for expanded provider ────────────────────────────────────────

  const { data: auditData, isLoading: auditLoading } = useQuery<{ entries: AuditEntry[]; total: number }>({
    queryKey: ['/api/marketplace/rankings/audit', expandedAudit],
    enabled: !!expandedAudit && !!user,
  });

  // ── Override mutation ───────────────────────────────────────────────────────

  const overrideMutation = useMutation({
    mutationFn: async ({
      userId,
      action,
      note,
    }: {
      userId: string;
      action: 'boost' | 'suppress' | 'reset' | 'flag' | 'unflag';
      note?: string;
    }) => {
      const res = await apiRequest('PATCH', `/api/marketplace/rankings/${userId}`, { action, note });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Override failed');
      return body;
    },
    onSuccess: (_, vars) => {
      toast({
        title: isHebrew ? 'עודכן בהצלחה' : 'Updated',
        description: isHebrew
          ? `פעולה "${vars.action}" הוחלה`
          : `Action "${vars.action}" applied`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/rankings/providers'] });
      if (expandedAudit === vars.userId) {
        queryClient.invalidateQueries({ queryKey: ['/api/marketplace/rankings/audit', vars.userId] });
      }
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'שגיאה' : 'Error',
        description: err.message,
      });
    },
  });

  // ── Recompute mutation ──────────────────────────────────────────────────────

  const recomputeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', '/api/marketplace/rankings/recompute', {});
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Recompute failed');
      return body;
    },
    onSuccess: (data) => {
      toast({
        title: isHebrew ? 'דירוגים עודכנו' : 'Rankings recomputed',
        description: isHebrew
          ? `${data.refreshed} ספקים עודכנו`
          : `${data.refreshed} providers updated`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/marketplace/rankings/providers'] });
    },
    onError: (err: any) => {
      toast({ variant: 'destructive', title: 'Error', description: err.message });
    },
  });

  // ── Filtered list ───────────────────────────────────────────────────────────

  const providers = (data?.providers ?? []).filter((p) =>
    search === '' || p.userId.toLowerCase().includes(search.toLowerCase())
  );

  const atRiskCount = providers.filter((p) => p.tier === 'at_risk').length;

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const scoreColor = (score: number | null) => {
    if (score === null) return 'text-gray-400';
    if (score >= 80) return 'text-purple-700 font-bold';
    if (score >= 60) return 'text-yellow-700 font-bold';
    if (score >= 40) return 'text-gray-700';
    return 'text-red-600 font-bold';
  };

  const formatRevenue = (v: number) =>
    v >= 1000 ? `₪${(v / 1000).toFixed(1)}k` : `₪${v.toFixed(0)}`;

  const boostedUntilLabel = (iso: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    if (d <= new Date()) return null;
    return d.toLocaleDateString(isHebrew ? 'he-IL' : 'en-IL', { day: 'numeric', month: 'short' });
  };

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen bg-gray-50 dark:bg-gray-950 p-4 md:p-8"
      dir={isHebrew ? 'rtl' : 'ltr'}
    >
      {/* Header */}
      <div className="max-w-7xl mx-auto mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-purple-600" />
              {isHebrew ? 'לוח בקרה — דירוג ספקים' : 'Marketplace Intelligence'}
            </h1>
            <p className="text-gray-500 text-sm mt-1">
              {isHebrew
                ? 'שלוט בחלוקת הביקוש — הגבר, דכא, וצפה בסיכונים'
                : 'Control demand distribution — boost, suppress, and monitor risk'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => recomputeMutation.mutate()}
            disabled={recomputeMutation.isPending}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${recomputeMutation.isPending ? 'animate-spin' : ''}`} />
            {isHebrew ? 'חשב מחדש' : 'Recompute All'}
          </Button>
        </div>

        {/* Summary chips */}
        {data && (
          <div className="flex flex-wrap gap-3 mt-4">
            <div className="bg-white dark:bg-gray-900 border rounded-lg px-4 py-2 text-sm">
              <span className="text-gray-500">{isHebrew ? 'סך ספקים' : 'Total'}</span>
              <span className="ml-2 font-bold">{data.total}</span>
            </div>
            {atRiskCount > 0 && (
              <div className="bg-red-50 border-red-200 border rounded-lg px-4 py-2 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-red-700 font-semibold">
                  {atRiskCount} {isHebrew ? 'בסיכון' : 'at risk'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search */}
      <div className="max-w-7xl mx-auto mb-4">
        <div className="relative max-w-sm">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder={isHebrew ? 'חיפוש לפי מזהה ספק...' : 'Search by user ID...'}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="max-w-7xl mx-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        ) : providers.length === 0 ? (
          <Card>
            <CardContent className="pt-12 pb-12 text-center text-gray-500">
              {isHebrew ? 'לא נמצאו ספקים' : 'No providers found'}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {providers.map((provider, idx) => {
              const tierCfg = TIER_CONFIG[provider.tier] ?? TIER_CONFIG.silver;
              const TierIcon = tierCfg.icon;
              const boostLabel = boostedUntilLabel(provider.rankingBoostUntil);
              const isAtRisk = provider.tier === 'at_risk';
              const isSuppressed = provider.rankingOverride !== null && provider.rankingOverride <= 10;
              const isFlagged = !!provider.rankingFlaggedAt;
              const isAuditOpen = expandedAudit === provider.userId;

              return (
                <Card
                  key={provider.userId}
                  className={`transition-colors ${
                    isAtRisk ? 'border-red-200 bg-red-50 dark:bg-red-950/20'
                    : isFlagged ? 'border-orange-200 bg-orange-50 dark:bg-orange-950/20'
                    : ''
                  }`}
                >
                  <CardContent className="py-4 px-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      {/* Rank + ID */}
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="text-2xl font-black text-gray-200 w-8 text-right shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="font-mono text-xs text-gray-500 truncate max-w-[200px]">
                            {provider.userId}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            {/* Tier badge */}
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${tierCfg.color}`}>
                              <TierIcon className="w-3 h-3" />
                              {tierCfg.label}
                            </span>
                            {/* Status indicators */}
                            {isFlagged && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300">
                                <Flag className="w-3 h-3" />
                                {isHebrew ? 'בבדיקה' : 'Under Review'}
                              </span>
                            )}
                            {boostLabel && (
                              <span className="text-xs text-blue-600 font-medium">
                                ↑ {isHebrew ? `מוגבר עד ${boostLabel}` : `Boosted until ${boostLabel}`}
                              </span>
                            )}
                            {isSuppressed && (
                              <span className="text-xs text-gray-500 font-medium">↓ {isHebrew ? 'דכוי' : 'Suppressed'}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Stats */}
                      <div className="flex items-center gap-5 text-sm shrink-0">
                        <div className="text-center">
                          <div className={`text-lg font-bold ${scoreColor(provider.rankingScore)}`}>
                            {provider.rankingScore ?? '—'}
                          </div>
                          <div className="text-xs text-gray-400">{isHebrew ? 'דירוג' : 'Rank'}</div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-semibold ${(provider.trustScore ?? 100) <= 40 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                            {provider.trustScore ?? '—'}
                          </div>
                          <div className="text-xs text-gray-400">{isHebrew ? 'אמון' : 'Trust'}</div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            {provider.ratingAvg ? parseFloat(provider.ratingAvg).toFixed(1) : '—'} ⭐
                          </div>
                          <div className="text-xs text-gray-400">
                            {provider.ratingCount ?? 0} {isHebrew ? 'ביקורות' : 'reviews'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className={`text-sm font-bold ${provider.disputeCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                            {provider.disputeCount}
                          </div>
                          <div className="text-xs text-gray-400">{isHebrew ? 'מחלוקות' : 'disputes'}</div>
                        </div>
                        <div className="text-center hidden md:block">
                          <div className="text-sm font-semibold text-green-700">{formatRevenue(provider.revenueILS)}</div>
                          <div className="text-xs text-gray-400">{isHebrew ? 'הכנסות' : 'revenue'}</div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                        {/* Boost */}
                        <Button
                          size="sm" variant="outline"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50 h-8 px-2.5 text-xs"
                          disabled={overrideMutation.isPending}
                          onClick={() => overrideMutation.mutate({ userId: provider.userId, action: 'boost' })}
                          title={isHebrew ? 'הגבר 7 ימים' : 'Boost 7 days'}
                        >
                          <ChevronUp className="w-3.5 h-3.5 mr-1" />
                          {isHebrew ? 'הגבר' : 'Boost'}
                        </Button>

                        {/* Suppress */}
                        <Button
                          size="sm" variant="outline"
                          className="text-orange-600 border-orange-200 hover:bg-orange-50 h-8 px-2.5 text-xs"
                          disabled={overrideMutation.isPending}
                          onClick={() => overrideMutation.mutate({ userId: provider.userId, action: 'suppress' })}
                          title={isHebrew ? 'דכא' : 'Suppress'}
                        >
                          <ChevronDown className="w-3.5 h-3.5 mr-1" />
                          {isHebrew ? 'דכא' : 'Suppress'}
                        </Button>

                        {/* Flag / Unflag */}
                        <Button
                          size="sm" variant="outline"
                          className={`h-8 px-2.5 text-xs ${isFlagged ? 'text-orange-600 border-orange-300 bg-orange-50 hover:bg-orange-100' : 'text-gray-500 border-gray-200 hover:bg-gray-50'}`}
                          disabled={overrideMutation.isPending}
                          onClick={() => overrideMutation.mutate({ userId: provider.userId, action: isFlagged ? 'unflag' : 'flag' })}
                          title={isFlagged ? (isHebrew ? 'הסר דגל' : 'Unflag') : (isHebrew ? 'סמן לבדיקה' : 'Flag for review')}
                        >
                          {isFlagged ? <FlagOff className="w-3.5 h-3.5" /> : <Flag className="w-3.5 h-3.5" />}
                        </Button>

                        {/* Reset */}
                        {(provider.rankingOverride !== null || provider.rankingBoostUntil || provider.rankingFlaggedAt) && (
                          <Button
                            size="sm" variant="ghost"
                            className="h-8 px-2 text-gray-400 hover:text-gray-700 text-xs"
                            disabled={overrideMutation.isPending}
                            onClick={() => overrideMutation.mutate({ userId: provider.userId, action: 'reset' })}
                            title={isHebrew ? 'אפס הכל' : 'Reset all'}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}

                        {/* Audit log toggle */}
                        <Button
                          size="sm" variant="ghost"
                          className={`h-8 px-2 text-xs ${isAuditOpen ? 'text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
                          onClick={() => setExpandedAudit(isAuditOpen ? null : provider.userId)}
                          title={isHebrew ? 'יומן ביקורת' : 'Audit log'}
                        >
                          <ClipboardList className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* ── Audit log panel ──────────────────────────────── */}
                    {isAuditOpen && (
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                            {isHebrew ? 'יומן פעולות מנהל' : 'Admin Audit Log'}
                          </span>
                          <button
                            onClick={() => setExpandedAudit(null)}
                            className="text-gray-400 hover:text-gray-600"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {auditLoading ? (
                          <div className="space-y-2">
                            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-8 w-full rounded" />)}
                          </div>
                        ) : !auditData?.entries?.length ? (
                          <p className="text-xs text-gray-400 text-center py-3">
                            {isHebrew ? 'אין פעולות רשומות' : 'No audit entries yet'}
                          </p>
                        ) : (
                          <div className="space-y-1.5">
                            {auditData.entries.map((entry) => (
                              <div key={entry.id} className="flex items-start gap-3 text-xs bg-gray-50 rounded-lg px-3 py-2">
                                <span className={`font-semibold capitalize shrink-0 ${
                                  entry.action === 'boost' ? 'text-blue-600'
                                  : entry.action === 'suppress' ? 'text-orange-600'
                                  : entry.action === 'flag' ? 'text-orange-500'
                                  : entry.action === 'unflag' ? 'text-green-600'
                                  : 'text-gray-500'
                                }`}>
                                  {entry.action}
                                </span>
                                <span className="text-gray-500 flex-1 truncate" title={entry.adminUid}>
                                  {isHebrew ? 'מנהל' : 'Admin'}: {entry.adminUid.slice(0, 8)}…
                                </span>
                                {entry.note && (
                                  <span className="text-gray-600 italic">"{entry.note}"</span>
                                )}
                                <span className="text-gray-400 shrink-0">
                                  {new Date(entry.createdAt).toLocaleDateString(isHebrew ? 'he-IL' : 'en-IL', {
                                    day: 'numeric', month: 'short',
                                  })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
