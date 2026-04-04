/**
 * QueueHealthCard — Phase 6.11
 *
 * Displays a comprehensive queue + experiment health panel for admin use.
 * Fetches from GET /api/admin/loyalty/queue-health.
 *
 * Surfaces:
 *  - Per-trigger: pending depth, stuck rows, paused rows, today's sends, armed status, daily cap
 *  - Orphan sends warning (sends with no experiment decision record)
 *  - 7-day vs prior-7-day conversion trend arrow
 *  - "Proof run" button that triggers test scenarios and shows pass/fail
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertTriangle, CheckCircle, Clock, ShieldCheck, ShieldOff,
  TrendingUp, TrendingDown, Minus, Zap, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface QueueStat {
  trigger:    string;
  pending:    number;
  stuck:      number;
  paused:     number;
  today_sent: number;
}

interface Rule {
  ruleKey:      string;
  armed:        boolean;
  dailySendCap: number | null;
}

interface TrendPeriod {
  sent:      number;
  completed: number;
}

interface HealthData {
  queueStats:  QueueStat[];
  rules:       Rule[];
  orphanSends: number;
  trend: { current: TrendPeriod; prior: TrendPeriod };
}

interface ProofResult {
  scenario: string;
  seeded:   string;
  expected: string;
  actual:   object;
  pass:     boolean;
}

const SCENARIOS = [
  { id: 'low_sample',      label: 'Low Sample Gate'    },
  { id: 'losing_variant',  label: 'Losing Variant Pause' },
  { id: 'winner_ready',    label: 'Winner Detection'   },
  { id: 'frequency_cap',   label: 'Frequency Cap'      },
  { id: 'admin_pause',     label: 'Admin Pause/Unpause' },
] as const;

const TRIGGER_LABEL: Record<string, string> = {
  '14d': '14 ימים',
  '30d': '30 ימים',
  '60d': '60 ימים',
};

export function QueueHealthCard() {
  const { toast }     = useToast();
  const queryClient   = useQueryClient();
  const [proofResult, setProofResult] = useState<ProofResult | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);

  const QK = ['/api/admin/loyalty/queue-health'] as const;

  const { data, isLoading } = useQuery<HealthData>({
    queryKey: QK,
    staleTime: 30_000,
  });

  const proofMut = useMutation({
    mutationFn: (scenario: string) =>
      apiRequest('POST', '/api/admin/loyalty/proof-run', { scenario }).then(r => r.json()),
    onSuccess: (result: ProofResult) => {
      setProofResult(result);
      toast({
        title: result.pass ? '✅ תרחיש עבר בהצלחה' : '❌ תרחיש נכשל',
        description: `${result.scenario}: ${result.pass ? 'הלוגיקה פועלת כמצופה' : 'בדוק את הפלט'}`,
        variant: result.pass ? 'default' : 'destructive',
      });
    },
    onError: () => toast({ title: 'שגיאה', description: 'הרצת ההוכחה נכשלה.', variant: 'destructive' }),
  });

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-2 text-xs text-gray-400">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> טוען מצב תור…
      </div>
    );
  }
  if (!data) return null;

  const { queueStats, rules, orphanSends, trend } = data;
  const ruleMap = new Map(rules.map(r => [r.ruleKey, r]));

  // Conversion trend arrow
  const cRate  = (p: TrendPeriod) => p.sent > 0 ? p.completed / p.sent : null;
  const curr   = cRate(trend.current);
  const prior  = cRate(trend.prior);
  const trendUp = curr !== null && prior !== null && curr > prior;
  const trendDn = curr !== null && prior !== null && curr < prior;
  const trendFmt = (p: TrendPeriod) =>
    p.sent > 0 ? `${((p.completed / p.sent) * 100).toFixed(1)}%` : '—';

  // Overall health signal
  const hasStuck   = queueStats.some(s => s.stuck > 0);
  const hasPaused  = queueStats.some(s => s.paused > 0);
  const hasOrphans = orphanSends > 0;
  const allDisarmed = rules.filter(r => r.ruleKey.startsWith('winback_')).every(r => !r.armed);

  const overallOk = !hasStuck && !hasOrphans;

  const triggers = ['14d', '30d', '60d'];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
        <div className="flex items-center gap-2">
          {overallOk
            ? <CheckCircle className="w-4 h-4 text-emerald-500" />
            : <AlertTriangle className="w-4 h-4 text-amber-500" />}
          <span className="text-xs font-bold text-gray-700">מצב תור וניסויים</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px]">
          {trendUp && <TrendingUp  className="w-3.5 h-3.5 text-emerald-500" />}
          {trendDn && <TrendingDown className="w-3.5 h-3.5 text-red-400"    />}
          {!trendUp && !trendDn && <Minus className="w-3.5 h-3.5 text-gray-300" />}
          <span className="text-gray-500">
            7 ימים: {trendFmt(trend.current)} | קודם: {trendFmt(trend.prior)}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Warnings */}
        {(hasStuck || hasOrphans || allDisarmed) && (
          <div className="space-y-2">
            {hasStuck && (
              <div className="flex items-start gap-2 text-xs bg-red-50 text-red-700 rounded-xl px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>יש שורות תקועות (ממתינות &gt;48ש׳) בתור — בדוק את מתזמן העבודה.</span>
              </div>
            )}
            {hasOrphans && (
              <div className="flex items-start gap-2 text-xs bg-amber-50 text-amber-700 rounded-xl px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{orphanSends} שליחות פעילות ללא רשומת ניסוי — הפעל "הערכה" בלשונית הניסויים.</span>
              </div>
            )}
            {allDisarmed && (
              <div className="flex items-start gap-2 text-xs bg-blue-50 text-blue-700 rounded-xl px-3 py-2">
                <ShieldOff className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>כל טריגרי ה-winback מושבתים (armed=false). הפעל לפחות אחד בלשונית הכללים.</span>
              </div>
            )}
          </div>
        )}

        {/* Per-trigger grid */}
        <div className="grid grid-cols-3 gap-2">
          {triggers.map(trig => {
            const stat     = queueStats.find(s => s.trigger === trig);
            const ruleKey  = `winback_${trig}`;
            const rule     = ruleMap.get(ruleKey);
            const isArmed  = !!rule?.armed;
            const pending  = stat?.pending    ?? 0;
            const stuck    = stat?.stuck      ?? 0;
            const paused   = stat?.paused     ?? 0;
            const sent     = stat?.today_sent ?? 0;
            const cap      = rule?.dailySendCap;

            return (
              <div
                key={trig}
                className={`rounded-xl border p-3 text-[10px] space-y-1.5 ${
                  stuck > 0 ? 'border-red-200 bg-red-50/20' :
                  !isArmed  ? 'border-gray-100 bg-white/50' :
                              'border-gray-100 bg-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-700 text-[11px]">{TRIGGER_LABEL[trig] ?? trig}</span>
                  {isArmed
                    ? <ShieldCheck className="w-3 h-3 text-emerald-500" title="מחומש" />
                    : <ShieldOff   className="w-3 h-3 text-gray-300"    title="לא מחומש" />}
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-gray-500">
                  <span>ממתין</span>  <span className="text-right font-mono text-gray-700">{pending}</span>
                  <span>תקוע</span>   <span className={`text-right font-mono ${stuck > 0 ? 'text-red-600 font-bold' : 'text-gray-400'}`}>{stuck}</span>
                  <span>מושהה</span>  <span className={`text-right font-mono ${paused > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{paused}</span>
                  <span>היום</span>   <span className="text-right font-mono text-gray-700">
                    {sent}{cap != null ? `/${cap}` : ''}
                  </span>
                </div>

                {cap != null && cap > 0 && (
                  <div className="h-1 rounded-full bg-white overflow-hidden">
                    <div
                      className={`h-full rounded-full ${sent >= cap ? 'bg-red-400' : 'bg-emerald-400'}`}
                      style={{ width: `${Math.min((sent / cap) * 100, 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Proof run panel */}
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-2">הרצת הוכחה</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {SCENARIOS.map(s => (
              <button
                key={s.id}
                onClick={() => {
                  setActiveScenario(s.id);
                  proofMut.mutate(s.id);
                }}
                disabled={proofMut.isPending}
                className={`text-[10px] px-2.5 py-1 rounded-full border transition-colors font-medium ${
                  activeScenario === s.id
                    ? 'border-purple-300 bg-purple-50 text-purple-700'
                    : 'border-gray-200 text-gray-500 hover:border-purple-200 hover:text-purple-600'
                }`}
              >
                {proofMut.isPending && activeScenario === s.id
                  ? <Loader2 className="inline w-2.5 h-2.5 animate-spin mr-1" />
                  : null}
                {s.label}
              </button>
            ))}
          </div>

          {proofResult && (
            <div className={`rounded-xl border p-3 text-[11px] space-y-2 ${
              proofResult.pass ? 'border-emerald-200 bg-emerald-50/40' : 'border-red-200 bg-red-50/30'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {proofResult.pass
                  ? <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                  : <AlertTriangle className="w-3.5 h-3.5 text-red-500"   />}
                {proofResult.pass ? 'PASS' : 'FAIL'} — {proofResult.scenario}
              </div>
              <div className="text-gray-500 space-y-0.5">
                <p><span className="font-semibold text-gray-700">נזרע: </span>{proofResult.seeded}</p>
                <p><span className="font-semibold text-gray-700">צפוי: </span>{proofResult.expected}</p>
              </div>
              <details className="cursor-pointer">
                <summary className="text-[10px] text-gray-400 hover:text-gray-600">פלט מלא</summary>
                <pre className="mt-1 text-[9px] text-gray-500 overflow-x-auto whitespace-pre-wrap">
                  {JSON.stringify(proofResult.actual, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default QueueHealthCard;
