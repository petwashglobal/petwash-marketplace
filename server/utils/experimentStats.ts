/**
 * experimentStats.ts
 *
 * Two-proportion z-test for A/B experiment evaluation.
 *
 * Given counts from a control variant and a challenger variant, returns:
 *   - confidencePct  : one-sided confidence that challenger beats control (0–100)
 *   - upliftPct      : relative lift of challenger over control (can be negative)
 *   - zScore         : raw z statistic
 *   - sufficient     : whether both variants cleared the minimum sample gate
 *
 * Minimum sample gate:
 *   Each variant must have >= MIN_SAMPLE_SIZE notification_sent events AND
 *   the experiment must have been running >= MIN_RUNTIME_DAYS days.
 *
 * Auto-pause logic:
 *   - Variant has 0 completions for >= ZERO_CONV_THRESHOLD sends → clear loser
 *   - Confidence >= 95% + gate passed → statistical winner
 */

export const MIN_SAMPLE_SIZE   = 100;   // notification_sent per variant
export const MIN_RUNTIME_DAYS  = 7;
export const WINNER_CONFIDENCE = 95;    // %
export const ZERO_CONV_THRESHOLD = 50;  // sends with 0 completions → auto-pause

export interface VariantCounts {
  variant:   string;
  sent:      number;
  completed: number;
  firstSentAt: Date | null;
}

export interface ComparisonResult {
  variant:        string;
  conversionRate: number;   // 0–1
  confidencePct:  number;   // 0–100, one-sided vs ctrl
  upliftPct:      number;   // relative lift vs ctrl
  zScore:         number;
  sufficient:     boolean;  // cleared sample gate
  clearLoser:     boolean;  // zero completions >= ZERO_CONV_THRESHOLD sends
  winner:         boolean;  // confidence >= WINNER_CONFIDENCE + sufficient
}

export interface EvaluationResult {
  experimentKey:   string;
  ctrl:            VariantCounts;
  challengers:     ComparisonResult[];
  winnerVariant:   string | null;   // null = no winner yet
  pauseVariants:   string[];        // variants to pause (losers + clear losers)
  hasEnoughData:   boolean;
}

// ── Normal CDF approximation (Abramowitz & Stegun 26.2.17) ──────────────────
// Accurate to ~1.5e-7 for all z.
function normCdf(z: number): number {
  if (z < -8) return 0;
  if (z >  8) return 1;
  const p  = 0.2316419;
  const b  = [0.319381530, -0.356563782, 1.781477937, -1.821255978, 1.330274429];
  const t  = 1 / (1 + p * Math.abs(z));
  const tn = t * (b[0] + t * (b[1] + t * (b[2] + t * (b[3] + t * b[4]))));
  // Standard normal PDF at z
  const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  const cdf = 1 - phi * tn;
  return z >= 0 ? cdf : 1 - cdf;
}

// ── Two-proportion z-test ─────────────────────────────────────────────────────
function zTest(n1: number, s1: number, n2: number, s2: number): { z: number; confidence: number } {
  if (n1 === 0 || n2 === 0) return { z: 0, confidence: 50 };
  const p1     = s1 / n1;
  const p2     = s2 / n2;
  const pPool  = (s1 + s2) / (n1 + n2);
  const se     = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return { z: 0, confidence: 50 };
  const z      = (p2 - p1) / se;
  // One-sided: probability challenger is better than control
  const confidence = normCdf(z) * 100;
  return { z, confidence };
}

// ── Main evaluator ────────────────────────────────────────────────────────────
export function evaluateExperiment(
  experimentKey: string,
  variants: VariantCounts[],
): EvaluationResult {
  const ctrl = variants.find(v => v.variant === 'ctrl');
  if (!ctrl) {
    return {
      experimentKey,
      ctrl: { variant: 'ctrl', sent: 0, completed: 0, firstSentAt: null },
      challengers: [],
      winnerVariant: null,
      pauseVariants: [],
      hasEnoughData: false,
    };
  }

  const now          = Date.now();
  const ctrlAgeDays  = ctrl.firstSentAt
    ? (now - ctrl.firstSentAt.getTime()) / 86_400_000
    : 0;

  const ctrlSufficient = ctrl.sent >= MIN_SAMPLE_SIZE && ctrlAgeDays >= MIN_RUNTIME_DAYS;

  const challengers: ComparisonResult[] = variants
    .filter(v => v.variant !== 'ctrl')
    .map(v => {
      const ageDays  = v.firstSentAt
        ? (now - v.firstSentAt.getTime()) / 86_400_000
        : 0;
      const sufficient = v.sent >= MIN_SAMPLE_SIZE && ageDays >= MIN_RUNTIME_DAYS && ctrlSufficient;

      const { z, confidence } = zTest(ctrl.sent, ctrl.completed, v.sent, v.completed);

      const ctrlRate = ctrl.sent > 0 ? ctrl.completed / ctrl.sent : 0;
      const varRate  = v.sent > 0    ? v.completed  / v.sent      : 0;
      const uplift   = ctrlRate > 0  ? ((varRate - ctrlRate) / ctrlRate) * 100 : 0;

      const clearLoser = v.sent >= ZERO_CONV_THRESHOLD && v.completed === 0;
      const winner     = sufficient && confidence >= WINNER_CONFIDENCE;

      return {
        variant:        v.variant,
        conversionRate: varRate,
        confidencePct:  Math.round(confidence * 100) / 100,
        upliftPct:      Math.round(uplift * 100) / 100,
        zScore:         Math.round(z * 10000) / 10000,
        sufficient,
        clearLoser,
        winner,
      };
    });

  // Winner = highest-confidence challenger that passed the gate
  const winners = challengers.filter(c => c.winner);
  let winnerVariant: string | null = null;
  if (winners.length > 0) {
    // Pick by highest confidence, tiebreak by highest uplift
    winners.sort((a, b) =>
      b.confidencePct !== a.confidencePct
        ? b.confidencePct - a.confidencePct
        : b.upliftPct - a.upliftPct,
    );
    winnerVariant = winners[0].variant;
  }

  // Variants to pause: clear losers + statistical losers (sufficient + confidence < 5%)
  const pauseVariants = challengers
    .filter(c => c.clearLoser || (c.sufficient && c.confidencePct < 5))
    .map(c => c.variant);

  const hasEnoughData = ctrlSufficient && challengers.every(c => c.sufficient);

  return { experimentKey, ctrl, challengers, winnerVariant, pauseVariants, hasEnoughData };
}
