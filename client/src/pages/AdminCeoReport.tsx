/**
 * AdminCeoReport.tsx
 *
 * READ-ONLY admin surface for two backend modules:
 *   • Auto CEO Daily Report   → GET /api/admin/ceo-report
 *   • eGift Intelligence      → GET /api/admin/egift-intelligence
 *
 * Both endpoints are PURE SELECT. This page only displays what they return.
 * It is honest about gaps: a metric the backend reports as `null` (no real
 * backing table) is shown as "not available" — never a fabricated number.
 *
 * Brand: pure white background, black text, bright gold (#D4AF37) accents.
 * Bilingual (he/en) via useLanguage; RTL when language is Hebrew.
 */
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/languageStore";
import { Link } from "wouter";
import {
  Activity, ArrowLeft, TrendingUp, TrendingDown, AlertTriangle,
  Package, CreditCard, UserPlus, Gift, ShieldAlert, Receipt, Clock,
} from "lucide-react";

const GOLD = "#D4AF37";

// ── Backend response types (mirror server/routes.ts) ──────────────────────
interface StationRank { stationId: string; name: string | null; totalIls: number; }
interface CeoReport {
  generatedAt: string;
  day: string;
  metrics: {
    totalSalesYesterdayIls: number | null;
    bestStation: StationRank | null;
    worstStation: StationRank | null;
    openFaults: number | null;
    lowStockCount: number | null;
    failedPaymentsYesterday: number | null;
    paidNotActivated: number | null;
    newMembersYesterday: number | null;
    egiftSoldYesterday: number | null;
    egiftRedeemedYesterday: number | null;
    supportTicketsOpen: number | null;
    billsDue: { total: number; insurance: number } | null;
  };
  narrative: { he: string[]; en: string[] };
  unavailable: string[];
}

interface VoucherListItem {
  id: string;
  codeLast4?: string;
  initialAmount?: string;
  remainingAmount?: string;
  status?: string;
  purchaserEmail?: string | null;
  recipientEmail?: string | null;
  createdAt?: string;
}
interface EgiftIntel {
  generatedAt: string;
  listCap: number;
  counts: {
    sold: number; redeemed: number; unredeemed: number;
    issuedNotClaimed: number; emailNotConfirmed: number;
  } | null;
  avgDaysToRedeem: number | null;
  highValueStale: { count: number; items: VoucherListItem[] } | null;
  issuedNotClaimedList: { count: number; items: VoucherListItem[] } | null;
  creditLedger: { egiftIssued: number; egiftRedeemed: number } | null;
  skipped: string[];
}

function ils(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₪${Math.round(n).toLocaleString("en-US")}`;
}

export default function AdminCeoReport() {
  const { language, dir } = useLanguage();
  const he = language === "he";

  const reportQ = useQuery<CeoReport>({ queryKey: ["/api/admin/ceo-report"] });
  const egiftQ = useQuery<EgiftIntel>({ queryKey: ["/api/admin/egift-intelligence"] });

  const r = reportQ.data;
  const m = r?.metrics;
  const g = egiftQ.data;

  const tx = (en: string, hb: string) => (he ? hb : en);

  // A metric card. Renders "not available" cleanly when value is null.
  const Metric = ({
    icon: Icon, label, value, sub, alert,
  }: {
    icon: any; label: string; value: React.ReactNode; sub?: string; alert?: boolean;
  }) => (
    <div
      className="rounded-2xl border bg-white p-5 flex flex-col gap-2"
      style={{ borderColor: alert ? GOLD : "#ECECEC" }}
    >
      <div className="flex items-center gap-2 text-gray-500">
        <Icon className="h-4 w-4" style={{ color: GOLD }} />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <div className="text-2xl font-semibold text-black">
        {value == null ? (
          <span className="text-base font-normal text-gray-400">
            {tx("not available", "לא זמין")}
          </span>
        ) : value}
      </div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );

  return (
    <div dir={dir} className="min-h-[100dvh] bg-white text-black">
      <div className="mx-auto max-w-6xl px-4 py-8" style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}>
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/admin/dashboard">
            <a className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black">
              <ArrowLeft className="h-4 w-4" />
              {tx("Admin", "ניהול")}
            </a>
          </Link>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2">
              <Activity className="h-6 w-6" style={{ color: GOLD }} />
              <h1 className="text-2xl font-bold tracking-tight">
                {tx("CEO Daily Report", "דוח מנכ״ל יומי")}
              </h1>
            </div>
            {r?.day && (
              <p className="mt-1 text-sm text-gray-500">
                {tx("For", "ליום")} {r.day}
              </p>
            )}
          </div>
          <div className="w-16" />
        </div>

        {/* Loading / error */}
        {reportQ.isLoading && (
          <div className="rounded-2xl border p-10 text-center text-gray-400" style={{ borderColor: "#ECECEC" }}>
            {tx("Loading report…", "טוען דוח…")}
          </div>
        )}
        {reportQ.isError && (
          <div className="rounded-2xl border p-6 text-center text-red-600" style={{ borderColor: GOLD }}>
            {tx("Could not load the CEO report.", "לא ניתן לטעון את דוח המנכ״ל.")}
          </div>
        )}

        {/* Narrative */}
        {r && (
          <div className="mb-8 rounded-2xl border bg-white p-6" style={{ borderColor: GOLD }}>
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500">
              {tx("Summary", "סיכום")}
            </h2>
            <ul className="space-y-1.5 text-[15px] leading-relaxed">
              {(he ? r.narrative.he : r.narrative.en).map((line, i) => (
                <li key={i} className="text-black">{line}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Daily metric cards */}
        {m && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Metric
              icon={TrendingUp}
              label={tx("Sales yesterday", "מכירות אתמול")}
              value={m.totalSalesYesterdayIls == null ? null : ils(m.totalSalesYesterdayIls)}
            />
            <Metric
              icon={TrendingUp}
              label={tx("Best station", "עמדה מובילה")}
              value={m.bestStation == null ? null : (m.bestStation.name ?? m.bestStation.stationId)}
              sub={m.bestStation ? ils(m.bestStation.totalIls) : undefined}
            />
            <Metric
              icon={TrendingDown}
              label={tx("Worst station", "עמדה חלשה")}
              value={m.worstStation == null ? null : (m.worstStation.name ?? m.worstStation.stationId)}
              sub={m.worstStation ? ils(m.worstStation.totalIls) : undefined}
            />
            <Metric
              icon={AlertTriangle}
              label={tx("Open faults", "תקלות פתוחות")}
              value={m.openFaults}
              alert={(m.openFaults ?? 0) > 0}
            />
            <Metric
              icon={Package}
              label={tx("Low stock items", "פריטי מלאי נמוך")}
              value={m.lowStockCount}
              alert={(m.lowStockCount ?? 0) > 0}
            />
            <Metric
              icon={CreditCard}
              label={tx("Failed payments", "תשלומים שנכשלו")}
              value={m.failedPaymentsYesterday}
              alert={(m.failedPaymentsYesterday ?? 0) > 0}
            />
            <Metric
              icon={Clock}
              label={tx("Paid, not activated", "שולם, לא הופעל")}
              value={m.paidNotActivated}
              alert={(m.paidNotActivated ?? 0) > 0}
            />
            <Metric
              icon={UserPlus}
              label={tx("New members", "חברים חדשים")}
              value={m.newMembersYesterday}
            />
            <Metric
              icon={Gift}
              label={tx("eGift sold / redeemed", "גיפט נמכר / מומש")}
              value={
                m.egiftSoldYesterday == null && m.egiftRedeemedYesterday == null
                  ? null
                  : `${m.egiftSoldYesterday ?? "—"} / ${m.egiftRedeemedYesterday ?? "—"}`
              }
            />
            <Metric
              icon={Receipt}
              label={tx("Bills due", "חשבונות לתשלום")}
              value={m.billsDue == null ? null : m.billsDue.total}
              sub={m.billsDue ? `${tx("incl. insurance", "כולל ביטוח")}: ${m.billsDue.insurance}` : undefined}
              alert={(m.billsDue?.total ?? 0) > 0}
            />
            <Metric
              icon={ShieldAlert}
              label={tx("Support tickets open", "פניות תמיכה פתוחות")}
              value={m.supportTicketsOpen}
            />
          </div>
        )}

        {/* Honest gaps */}
        {r && r.unavailable.length > 0 && (
          <div className="mt-6 rounded-2xl border bg-gray-50 p-4 text-sm text-gray-500" style={{ borderColor: "#ECECEC" }}>
            <span className="font-medium text-gray-700">
              {tx("Not connected yet:", "לא מחובר עדיין:")}{" "}
            </span>
            {r.unavailable.join(" · ")}
          </div>
        )}

        {/* ── eGift Intelligence ─────────────────────────────────────────── */}
        <div className="mt-12 mb-6 flex items-center gap-2 border-t pt-8" style={{ borderColor: "#ECECEC" }}>
          <Gift className="h-5 w-5" style={{ color: GOLD }} />
          <h2 className="text-xl font-bold tracking-tight">
            {tx("eGift Intelligence", "מודיעין גיפט")}
          </h2>
        </div>

        {egiftQ.isLoading && (
          <div className="rounded-2xl border p-10 text-center text-gray-400" style={{ borderColor: "#ECECEC" }}>
            {tx("Loading eGift intelligence…", "טוען מודיעין גיפט…")}
          </div>
        )}
        {egiftQ.isError && (
          <div className="rounded-2xl border p-6 text-center text-red-600" style={{ borderColor: GOLD }}>
            {tx("Could not load eGift intelligence.", "לא ניתן לטעון מודיעין גיפט.")}
          </div>
        )}

        {g?.counts && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <Metric icon={Gift} label={tx("Sold", "נמכרו")} value={g.counts.sold} />
            <Metric icon={Gift} label={tx("Redeemed", "מומשו")} value={g.counts.redeemed} />
            <Metric icon={Gift} label={tx("Unredeemed", "לא מומשו")} value={g.counts.unredeemed} />
            <Metric
              icon={Clock}
              label={tx("Avg days to redeem", "ימים ממוצע למימוש")}
              value={g.avgDaysToRedeem == null ? null : g.avgDaysToRedeem}
            />
            <Metric
              icon={ShieldAlert}
              label={tx("Issued, not claimed", "הונפק, לא נתבע")}
              value={g.counts.issuedNotClaimed}
              alert={g.counts.issuedNotClaimed > 0}
            />
            <Metric
              icon={ShieldAlert}
              label={tx("Email not confirmed", "אימייל לא אושר")}
              value={g.counts.emailNotConfirmed}
              alert={g.counts.emailNotConfirmed > 0}
            />
          </div>
        )}

        {/* High-value stale vouchers */}
        {g?.highValueStale && (
          <VoucherTable
            he={he}
            title={tx(
              `High-value (≥₪250) unredeemed >7 days — ${g.highValueStale.count}`,
              `ערך גבוה (₪250+) לא מומש מעל 7 ימים — ${g.highValueStale.count}`,
            )}
            cap={g.listCap}
            items={g.highValueStale.items}
          />
        )}

        {/* Issued-but-not-claimed vouchers */}
        {g?.issuedNotClaimedList && (
          <VoucherTable
            he={he}
            title={tx(
              `Issued, not claimed — ${g.issuedNotClaimedList.count}`,
              `הונפק, לא נתבע — ${g.issuedNotClaimedList.count}`,
            )}
            cap={g.listCap}
            items={g.issuedNotClaimedList.items}
          />
        )}

        {/* Credit ledger cross-check + skipped notes */}
        {g?.creditLedger && (
          <div className="mt-6 rounded-2xl border bg-white p-4 text-sm text-gray-600" style={{ borderColor: "#ECECEC" }}>
            <span className="font-medium text-gray-800">
              {tx("Gift-credit ledger:", "ספר אשראי גיפט:")}{" "}
            </span>
            {tx("issued", "הונפק")} {g.creditLedger.egiftIssued} · {tx("redeemed", "מומש")} {g.creditLedger.egiftRedeemed}
          </div>
        )}
        {g && g.skipped.length > 0 && (
          <div className="mt-3 rounded-2xl border bg-gray-50 p-4 text-xs text-gray-500" style={{ borderColor: "#ECECEC" }}>
            <span className="font-medium text-gray-700">{tx("Skipped checks:", "בדיקות שדולגו:")}{" "}</span>
            {g.skipped.join(" · ")}
          </div>
        )}

        {r?.generatedAt && (
          <p className="mt-10 text-center text-xs text-gray-400">
            {tx("Generated", "נוצר")} {new Date(r.generatedAt).toLocaleString(he ? "he-IL" : "en-US")}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Reusable capped voucher table ─────────────────────────────────────────
function VoucherTable({
  he, title, cap, items,
}: {
  he: boolean; title: string; cap: number; items: VoucherListItem[];
}) {
  const tx = (en: string, hb: string) => (he ? hb : en);
  return (
    <div className="mt-6 rounded-2xl border bg-white p-5" style={{ borderColor: "#ECECEC" }}>
      <h3 className="mb-3 text-sm font-semibold text-black">{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm text-gray-400">{tx("None.", "אין.")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-400">
                <th className="py-2 pr-4">{tx("Code", "קוד")}</th>
                <th className="py-2 pr-4">{tx("Amount", "סכום")}</th>
                <th className="py-2 pr-4">{tx("Status", "סטטוס")}</th>
                <th className="py-2 pr-4">{tx("Purchaser", "רוכש")}</th>
                <th className="py-2 pr-4">{tx("Recipient", "נמען")}</th>
                <th className="py-2 pr-4">{tx("Created", "נוצר")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((v) => (
                <tr key={v.id} className="border-t" style={{ borderColor: "#F3F3F3" }}>
                  <td className="py-2 pr-4 font-mono text-gray-700">····{v.codeLast4 ?? "----"}</td>
                  <td className="py-2 pr-4 text-black">
                    {v.initialAmount ? `₪${Math.round(Number(v.initialAmount)).toLocaleString("en-US")}` : "—"}
                  </td>
                  <td className="py-2 pr-4 text-gray-600">{v.status ?? "—"}</td>
                  <td className="py-2 pr-4 text-gray-600">{v.purchaserEmail ?? "—"}</td>
                  <td className="py-2 pr-4 text-gray-600">{v.recipientEmail ?? "—"}</td>
                  <td className="py-2 pr-4 text-gray-500">
                    {v.createdAt ? new Date(v.createdAt).toLocaleDateString(he ? "he-IL" : "en-US") : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {items.length >= cap && (
            <p className="mt-2 text-xs text-gray-400">
              {tx(`Showing first ${cap}. See count above for the full total.`, `מוצגים ${cap} הראשונים. הספירה למעלה היא הסך הכולל.`)}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
