/**
 * FINANCE & SETTLEMENTS — Unified Control Panel tab
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 2026-08-17 client↔server contract sweep (Lane E, D12)
 *
 * Every data source this tab was built on is missing on the server:
 *
 *   GET /api/finance/settlements               → no handler
 *   GET /api/finance/settlements/:id/export    → no handler (opened in a new tab)
 *   GET /api/finance/commissions               → no handler
 *   GET /api/finance/summary                   → EXISTS but returns
 *                                                { kpis, network, ownership,
 *                                                  stationCount } — not the
 *                                                { summary: { totalRevenue,
 *                                                  totalCommissions, totalVAT,
 *                                                  pendingSettlements } } this
 *                                                view read.
 *
 * `server/routes/finance.ts` exposes only /profitability/stations,
 * /profitability/network, /capital-signals, /ownership-comparison,
 * /friction-analytics and /summary.
 *
 * The consequence was worse than an empty screen: the four headline cards
 * rendered "₪0.00" revenue / commissions / VAT and "0" pending settlements from
 * `?? '0.00'` fallbacks — fabricated money figures on an executive surface,
 * indistinguishable from a genuinely quiet month.
 *
 * Per the platform rule ("No fake data in production… dashboards must read live
 * state or render wired: false with a reason"), this tab now states plainly that
 * it is not connected and points at the finance surfaces that ARE wired, rather
 * than inventing a settlement ledger. Building a real partner-settlement /
 * commission API is a product decision for the CEO + finance owner — it must not
 * be improvised by a UI patch, and it must not create a second write authority
 * over money that the payout/escrow services already own.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/** Finance surfaces that are genuinely wired today. */
const WIRED_ALTERNATIVES: { label: string; path: string; detail: string }[] = [
  {
    label: "Finance Profitability",
    path: "/finance/profitability",
    detail: "Per-station and network economics — GET /api/finance/profitability/*",
  },
  {
    label: "Money Flow",
    path: "/admin/money-flow",
    detail: "Live money movement — GET /api/finance/money-flow-summary",
  },
  {
    label: "Wallet & Payout Control",
    path: "/admin/wallet-finance",
    detail: "Payout batches, escrow, reconciliation exceptions",
  },
];

export default function FinanceSettlementsView() {
  return (
    <div className="space-y-6">
      <Card data-testid="card-finance-settlements-not-wired">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[#B8932F]" />
            Settlements &amp; Commissions — not connected
          </CardTitle>
          <CardDescription>
            This tab has no backing API. Nothing is being hidden from you: there is no
            partner-settlement or contractor-commission endpoint on the server yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            <p className="font-medium text-foreground mb-2">Missing endpoints</p>
            <ul className="space-y-1 font-mono text-xs">
              <li>GET /api/finance/settlements</li>
              <li>GET /api/finance/settlements/:id/export</li>
              <li>GET /api/finance/commissions</li>
            </ul>
            <p className="mt-3">
              Until these exist, any number shown here would be invented. The previous
              version of this screen displayed ₪0.00 totals that were not read from any
              ledger.
            </p>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">Wired finance surfaces</p>
            <div className="space-y-2">
              {WIRED_ALTERNATIVES.map((alt) => (
                <a
                  key={alt.path}
                  href={alt.path}
                  className="flex items-start gap-2 rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                  data-testid={`link-wired-${alt.path.replace(/\//g, "-")}`}
                >
                  <ExternalLink className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
                  <span>
                    <span className="block text-sm font-medium">{alt.label}</span>
                    <span className="block text-xs text-muted-foreground">{alt.detail}</span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
