/**
 * AdminStockReports.tsx
 *
 * READ-ONLY admin surface for two backend modules:
 *   • Smart Stock Prediction (§10)  → GET /api/admin/stock-prediction
 *   • Automatic Reports (§24)       → GET /api/admin/reports-summary
 *
 * Both endpoints are PURE SELECT. This page only DISPLAYS what they return and
 * sends / posts NOTHING. The "reorder" flag is a LABEL for a human operator —
 * no order is placed from here.
 *
 * Honest: a value the backend reports as `null` (e.g. an item with no usage
 * history) is shown as "—" / "not derivable" — never a fabricated number. Any
 * usage rate computed from a per-wash heuristic (bulk consumables) is badged
 * "estimate", visually distinct from real movement/sales-derived rates.
 *
 * Brand: pure white background, black text, bright gold (#D4AF37) accents.
 * Bilingual (he/en) via useLanguage; RTL when language is Hebrew.
 */
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/lib/languageStore";
import { Link } from "wouter";
import {
  Package, BarChart3, ArrowLeft, Info, AlertTriangle, TrendingDown,
  Droplets, Box, ShoppingCart, Wrench, Activity, Receipt,
} from "lucide-react";

const GOLD = "#D4AF37";

// ── Backend response types (mirror server/routes/admin-stock-reports.ts) ─────
type UsageBasis = "real_movement" | "real_sales" | "heuristic_per_wash" | "none";
interface PredictionRow {
  system: "spare_parts" | "kiosk_inventory" | "inventory_items";
  id: string;
  name: string;
  category: string | null;
  location: string | null;
  currentStock: number;
  threshold: number;
  unit: string | null;
  avgUsagePerDay: number | null;
  usageBasis: UsageBasis;
  predictedDaysUntilEmpty: number | null;
  reorder: boolean;
  leadTimeDays: number | null;
  note?: string;
}
interface StockPredictionResponse {
  wired: boolean;
  generatedAt: string;
  lookbackDays: number;
  itemCount: number;
  reorderCount: number;
  items: PredictionRow[];
  heuristic: {
    applied: string;
    perWashUsage: Record<string, number>;
    explanation: string;
  };
  errors: string[];
  note?: string;
}

interface Rollup {
  since: string;
  washSessions: number | null;
  stationRevenueIls: number | null;
  kiosk: { count: number; revenueIls: number } | null;
  faultsOpened: number | null;
  faultsResolved: number | null;
  refunds: { count: number; amountIls: number } | null;
  errors: string[];
}
interface ReportsSummaryResponse {
  wired: boolean;
  generatedAt: string;
  daily: Rollup | null;
  weekly: Rollup | null;
  lowStockNow: { spareParts: number; kioskInventory: number; inventoryItems: number } | null;
  errors: string[];
  note?: string;
}

function num(n: number | null | undefined): string {
  if (n == null) return "—";
  return n.toLocaleString("en-US");
}
function ils(n: number | null | undefined): string {
  if (n == null) return "—";
  return `₪${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const SYSTEM_ICON: Record<PredictionRow["system"], any> = {
  spare_parts: Wrench,
  kiosk_inventory: ShoppingCart,
  inventory_items: Droplets,
};

export default function AdminStockReports() {
  const { language, dir } = useLanguage();
  const he = language === "he";
  const tx = (en: string, hb: string) => (he ? hb : en);

  const stockQ = useQuery<StockPredictionResponse>({ queryKey: ["/api/admin/stock-prediction"] });
  const reportQ = useQuery<ReportsSummaryResponse>({ queryKey: ["/api/admin/reports-summary"] });

  const stock = stockQ.data;
  const report = reportQ.data;

  // Urgency colour: red = reorder/empty soon, amber = within 14 days, gold = ok.
  const urgencyBorder = (r: PredictionRow): string => {
    if (r.reorder) return "#DC2626";
    if (r.predictedDaysUntilEmpty != null && r.predictedDaysUntilEmpty <= 14) return "#D97706";
    return GOLD;
  };

  const basisBadge = (b: UsageBasis): { label: string; color: string } | null => {
    switch (b) {
      case "real_movement":
        return { label: tx("real usage", "צריכה אמיתית"), color: "#047857" };
      case "real_sales":
        return { label: tx("real sales", "מכירות אמיתיות"), color: "#047857" };
      case "heuristic_per_wash":
        return { label: tx("estimate", "הערכה"), color: "#D97706" };
      default:
        return null;
    }
  };

  return (
    <div dir={dir} className="min-h-[100dvh] bg-white text-black">
      <div
        className="mx-auto max-w-6xl px-4 py-8"
        style={{ paddingTop: "max(2rem, env(safe-area-inset-top))" }}
      >
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
              <Package className="h-6 w-6" style={{ color: GOLD }} />
              <h1 className="text-2xl font-bold tracking-tight">
                {tx("Stock & Reports", "מלאי ודוחות")}
              </h1>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {tx(
                "Smart stock prediction + automatic report digest — read-only",
                "חיזוי מלאי חכם + תקציר דוחות אוטומטי — לקריאה בלבד",
              )}
            </p>
          </div>
          <div className="w-16" />
        </div>

        {/* Read-only banner */}
        <div
          className="mb-8 flex items-start gap-3 rounded-2xl border bg-white p-4"
          style={{ borderColor: GOLD }}
        >
          <Info className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: GOLD }} />
          <p className="text-sm leading-relaxed text-gray-700">
            {tx(
              'This screen is read-only. It predicts which items will run low and digests yesterday/this-week activity, but does not place orders or change any stock. Items badged "estimate" use a per-wash heuristic for bulk consumables that have no movement history.',
              'מסך זה לקריאה בלבד. הוא חוזה אילו פריטים יאזלו ומסכם פעילות אתמול/השבוע, אך אינו מבצע הזמנות ואינו משנה מלאי. פריטים המסומנים "הערכה" משתמשים בהיוריסטיקה לכל שטיפה עבור חומרים מתכלים ללא היסטוריית תנועות.',
            )}
          </p>
        </div>

        {/* ── §24 AUTOMATIC REPORTS DIGEST ──────────────────────────────── */}
        <section className="mb-12">
          <div className="mb-1 flex items-center gap-2">
            <BarChart3 className="h-5 w-5" style={{ color: GOLD }} />
            <h2 className="text-lg font-bold">{tx("Report Digest", "תקציר דוחות")}</h2>
          </div>
          <p className="mb-5 text-sm text-gray-500">
            {tx("Daily (24h) and weekly (7d) rollups", "ריכוז יומי (24 שע') ושבועי (7 ימים)")}
          </p>

          {reportQ.isLoading && (
            <div className="rounded-2xl border p-10 text-center text-gray-400" style={{ borderColor: "#ECECEC" }}>
              {tx("Loading digest…", "טוען תקציר…")}
            </div>
          )}
          {reportQ.isError && (
            <div className="rounded-2xl border p-6 text-center text-red-600" style={{ borderColor: GOLD }}>
              {tx("Could not load the report digest.", "לא ניתן לטעון את תקציר הדוחות.")}
            </div>
          )}

          {report && (
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              {([
                { key: "daily", title: tx("Last 24 hours", "24 השעות האחרונות"), data: report.daily },
                { key: "weekly", title: tx("Last 7 days", "7 הימים האחרונים"), data: report.weekly },
              ] as const).map(({ key, title, data }) => (
                <div key={key} className="rounded-2xl border bg-white p-5" style={{ borderColor: GOLD }}>
                  <div className="mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5" style={{ color: GOLD }} />
                    <h3 className="text-base font-bold">{title}</h3>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <Metric icon={Droplets} label={tx("Wash sessions", "שטיפות")} value={num(data?.washSessions)} />
                    <Metric icon={BarChart3} label={tx("Station revenue", "הכנסות עמדה")} value={ils(data?.stationRevenueIls)} />
                    <Metric icon={ShoppingCart} label={tx("Kiosk sales", "מכירות קיוסק")} value={data?.kiosk ? `${num(data.kiosk.count)} · ${ils(data.kiosk.revenueIls)}` : "—"} />
                    <Metric icon={AlertTriangle} label={tx("Faults opened", "תקלות שנפתחו")} value={num(data?.faultsOpened)} />
                    <Metric icon={Wrench} label={tx("Faults resolved", "תקלות שנפתרו")} value={num(data?.faultsResolved)} />
                    <Metric icon={Receipt} label={tx("Refunds", "החזרים")} value={data?.refunds ? `${num(data.refunds.count)} · ${ils(data.refunds.amountIls)}` : "—"} />
                  </dl>
                </div>
              ))}
            </div>
          )}

          {/* Low stock now (point-in-time across all systems) */}
          {report?.lowStockNow && (
            <div className="mt-5 rounded-2xl border bg-white p-5" style={{ borderColor: GOLD }}>
              <div className="mb-3 flex items-center gap-2">
                <TrendingDown className="h-5 w-5" style={{ color: "#DC2626" }} />
                <h3 className="text-base font-bold">{tx("Low stock right now", "מלאי נמוך כעת")}</h3>
              </div>
              <dl className="grid grid-cols-3 gap-4 text-sm">
                <Metric icon={Wrench} label={tx("Spare parts", "חלקי חילוף")} value={num(report.lowStockNow.spareParts)} />
                <Metric icon={ShoppingCart} label={tx("Kiosk", "קיוסק")} value={num(report.lowStockNow.kioskInventory)} />
                <Metric icon={Droplets} label={tx("Consumables", "מתכלים")} value={num(report.lowStockNow.inventoryItems)} />
              </dl>
            </div>
          )}
        </section>

        {/* ── §10 SMART STOCK PREDICTION ────────────────────────────────── */}
        <section className="mb-12">
          <div className="mb-1 flex items-center gap-2">
            <Box className="h-5 w-5" style={{ color: GOLD }} />
            <h2 className="text-lg font-bold">{tx("Stock Prediction", "חיזוי מלאי")}</h2>
          </div>
          <p className="mb-5 text-sm text-gray-500">
            {stock
              ? tx(
                  `${stock.itemCount} tracked items · ${stock.reorderCount} need reorder · ${stock.lookbackDays}-day window`,
                  `${stock.itemCount} פריטים במעקב · ${stock.reorderCount} לחידוש · חלון ${stock.lookbackDays} ימים`,
                )
              : tx("Predicted days until empty per item", "ימים משוערים עד התרוקנות לכל פריט")}
          </p>

          {stockQ.isLoading && (
            <div className="rounded-2xl border p-10 text-center text-gray-400" style={{ borderColor: "#ECECEC" }}>
              {tx("Loading stock prediction…", "טוען חיזוי מלאי…")}
            </div>
          )}
          {stockQ.isError && (
            <div className="rounded-2xl border p-6 text-center text-red-600" style={{ borderColor: GOLD }}>
              {tx("Could not load stock prediction.", "לא ניתן לטעון את חיזוי המלאי.")}
            </div>
          )}

          {stock && stock.items.length === 0 && (
            <div className="rounded-2xl border p-10 text-center text-gray-500" style={{ borderColor: "#ECECEC" }}>
              {tx("No tracked stock found.", "לא נמצא מלאי במעקב.")}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stock?.items.map((r) => {
              const SysIcon = SYSTEM_ICON[r.system] ?? Box;
              const badge = basisBadge(r.usageBasis);
              return (
                <div
                  key={r.id}
                  className="flex flex-col rounded-2xl border bg-white p-4"
                  style={{ borderColor: urgencyBorder(r) }}
                >
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SysIcon className="h-5 w-5 flex-shrink-0" style={{ color: GOLD }} />
                      <div className="font-semibold leading-tight">{r.name}</div>
                    </div>
                    {r.reorder && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: "#DC2626" }}>
                        {tx("REORDER", "לחדש")}
                      </span>
                    )}
                  </div>

                  <div className="mb-3 text-xs text-gray-400">
                    {r.category || "—"}
                    {r.location ? ` · ${r.location}` : ""}
                  </div>

                  <dl className="mb-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
                    <div>
                      <dt className="text-xs text-gray-500">{tx("In stock", "במלאי")}</dt>
                      <dd className="font-semibold">{num(r.currentStock)} {r.unit ?? ""}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">{tx("Min", "מינ'")}</dt>
                      <dd className="font-semibold">{num(r.threshold)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">{tx("Usage/day", "צריכה/יום")}</dt>
                      <dd className="flex items-center gap-1 font-semibold">
                        {num(r.avgUsagePerDay)}
                        {badge && (
                          <span className="rounded px-1 py-0.5 text-[10px] font-bold text-white" style={{ backgroundColor: badge.color }}>
                            {badge.label}
                          </span>
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-gray-500">{tx("Days left", "ימים שנותרו")}</dt>
                      <dd className="font-semibold" style={{ color: urgencyBorder(r) }}>
                        {r.predictedDaysUntilEmpty != null ? num(r.predictedDaysUntilEmpty) : "—"}
                      </dd>
                    </div>
                  </dl>

                  {r.note && (
                    <p className="mt-auto pt-2 text-[11px] leading-snug text-gray-400">{r.note}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Heuristic disclosure */}
          {stock?.heuristic && (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border bg-white p-4" style={{ borderColor: "#D97706" }}>
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: "#D97706" }} />
              <div className="text-xs leading-relaxed text-gray-600">
                <span className="font-semibold">{tx("How estimates work: ", "כיצד עובדות ההערכות: ")}</span>
                {he
                  ? "צריכת חלקי חילוף ומכירות קיוסק נגזרות מנתונים אמיתיים. לחומרים מתכלים אין היסטוריית תנועות, ולכן הצריכה היא הערכה לכל שטיפה המבוססת על שטיפות אמיתיות שהושלמו. פריטים ללא בסיס לחישוב מוצגים כ-—."
                  : stock.heuristic.explanation}
              </div>
            </div>
          )}
        </section>

        {/* Footer timestamp */}
        {(stock || report) && (
          <p className="text-center text-xs text-gray-400">
            {tx("Generated", "נוצר")}:{" "}
            {new Date(stock?.generatedAt || report?.generatedAt || Date.now()).toLocaleString(
              he ? "he-IL" : "en-US",
            )}
          </p>
        )}
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </div>
  );
}
