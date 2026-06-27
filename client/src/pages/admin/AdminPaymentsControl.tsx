/**
 * AdminPaymentsControl — "תשלומים" (Payments)
 * Route: /admin/payments
 *
 * Read-only control panel over the unified pw_payments ledger.
 *  - Summary cards: today's totals by processor (SUMIT/uPay = stripe rail, Nayax),
 *    wallet, refunds, and a "paid but not activated" heuristic counter.
 *  - Filter bar: processor, status, vertical, free-text search, date range.
 *  - Paged table of the underlying ledger rows.
 *
 * Hebrew-first, RTL, brand = white bg / black text / gold (#D4AF37) accents.
 * All amounts arrive as INTEGER CENTS — divide by 100 to display ₪.
 */

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  CreditCard, Wallet, RotateCcw, AlertTriangle, Search,
  Loader2, ChevronRight, ChevronLeft, FileCheck2, FileX2, Receipt,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

const GOLD = "#D4AF37";

// ── Types ──────────────────────────────────────────────────────────────────────

interface PaymentRow {
  paymentId:          string;
  transactionType:    string;
  vertical:           string;
  commercialModel:    string;
  customerId:         string | null;
  providerId:         string | null;
  grossCents:         number;
  netRevenueCents:    number;
  vatCents:           number;
  paymentMethod:      string | null;
  paymentProcessor:   string | null;
  walletUsed:         boolean;
  invoiceId:          string | null;
  receiptId:          string | null;
  status:             string;
  nayaxTransactionId: string | null;
  createdAt:          string;
  settledAt:          string | null;
}

interface ListResponse {
  rows: PaymentRow[];
  total: number;
  page: number;
  pageSize: number;
}

interface SummaryResponse {
  byProcessor: { processor: string | null; count: number; grossCents: number }[];
  wallet:   { count: number; grossCents: number };
  refunds:  { count: number; grossCents: number };
  paidNotActivated: number;
  paidNotActivatedIsHeuristic?: boolean;
}

// ── Helpers ─────────────────────────────────────────────────────────────────────

function ils(cents: number | null | undefined) {
  return `₪${((cents ?? 0) / 100).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDatetime(iso: string) {
  try { return new Date(iso).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return iso; }
}
function shortId(v: string | null | undefined) {
  if (!v) return "—";
  return v.length > 14 ? `${v.slice(0, 6)}…${v.slice(-4)}` : v;
}

// Processor display labels. SUMIT/uPay ride the same "stripe" online rail in the
// ledger; Nayax is the K9000 hardware rail; manual is back-office.
const PROCESSOR_LABEL: Record<string, string> = {
  stripe: "SUMIT / uPay",
  nayax:  "Nayax (K9000)",
  manual: "ידני",
};
function processorLabel(p: string | null | undefined) {
  if (!p) return "ללא";
  return PROCESSOR_LABEL[p] ?? p;
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  settled:   { label: "סולק",   cls: "bg-emerald-100 text-emerald-700" },
  consumed:  { label: "נוצל",   cls: "bg-emerald-100 text-emerald-700" },
  captured:  { label: "נגבה",   cls: "bg-amber-100 text-amber-700" },
  authorised:{ label: "אושר",   cls: "bg-amber-100 text-amber-700" },
  credited_to_wallet: { label: "זוכה לארנק", cls: "bg-amber-100 text-amber-700" },
  refunded:  { label: "הוחזר",  cls: "bg-red-100 text-red-700" },
  reversed:  { label: "בוטל",   cls: "bg-red-100 text-red-700" },
  cancelled: { label: "מבוטל",  cls: "bg-red-100 text-red-700" },
  created:   { label: "נוצר",   cls: "bg-gray-100 text-gray-600" },
};
function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status] ?? { label: status, cls: "bg-gray-100 text-gray-600" };
  return <Badge className={`text-[10px] px-2 py-0.5 border-0 ${s.cls}`}>{s.label}</Badge>;
}

// Filter option catalogs (mirror the schema enums; empty = all).
const STATUS_OPTIONS = [
  "", "created", "authorised", "captured", "settled", "consumed",
  "credited_to_wallet", "refunded", "reversed", "cancelled",
];
const VERTICAL_OPTIONS = [
  "", "k9000", "sitter-suite", "walk-my-pet", "pettrek", "pet-wash-hub",
  "paw-finder", "plush-lab", "wallet", "egift",
];
const PROCESSOR_OPTIONS = ["", "nayax", "stripe", "manual"];

// ── Summary card ────────────────────────────────────────────────────────────────

function SummaryCard({
  icon, label, primary, secondary, accent,
}: {
  icon: React.ReactNode; label: string; primary: string;
  secondary?: string; accent?: boolean;
}) {
  return (
    <div
      className="bg-white rounded-2xl border p-4 shadow-sm flex flex-col gap-1"
      style={{ borderColor: accent ? GOLD : "#f3f4f6" }}
    >
      <div className="flex items-center gap-2 text-gray-400">
        {icon}
        <span className="text-[11px] font-semibold">{label}</span>
      </div>
      <div className="text-lg font-bold text-black tabular-nums">{primary}</div>
      {secondary && <div className="text-[11px] text-gray-400">{secondary}</div>}
    </div>
  );
}

// ── Summary section ─────────────────────────────────────────────────────────────

function SummarySection() {
  const { data, isLoading, isError } = useQuery<SummaryResponse>({
    queryKey: ["/api/admin/payments-control/summary"],
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="p-4 flex items-center justify-center text-gray-400 text-sm gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> טוען סיכום...
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="p-4 text-center text-sm text-red-400">שגיאה בטעינת הסיכום</div>
    );
  }

  const find = (p: string) => data.byProcessor.find(r => r.processor === p);
  const sumit = find("stripe");
  const nayax = find("nayax");

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-4">
      <SummaryCard
        icon={<CreditCard className="w-4 h-4" style={{ color: GOLD }} />}
        label="SUMIT / uPay היום"
        primary={ils(sumit?.grossCents)}
        secondary={`${sumit?.count ?? 0} עסקאות`}
        accent
      />
      <SummaryCard
        icon={<CreditCard className="w-4 h-4 text-[#D4AF37]" />}
        label="Nayax (K9000) היום"
        primary={ils(nayax?.grossCents)}
        secondary={`${nayax?.count ?? 0} עסקאות`}
      />
      <SummaryCard
        icon={<Wallet className="w-4 h-4 text-[#D4AF37]" />}
        label="ארנק היום"
        primary={ils(data.wallet?.grossCents)}
        secondary={`${data.wallet?.count ?? 0} עסקאות`}
      />
      <SummaryCard
        icon={<RotateCcw className="w-4 h-4 text-red-500" />}
        label="החזרים / ביטולים היום"
        primary={ils(data.refunds?.grossCents)}
        secondary={`${data.refunds?.count ?? 0} עסקאות`}
      />
      <SummaryCard
        icon={<AlertTriangle className="w-4 h-4 text-amber-500" />}
        label="שולם אך לא הופעל"
        primary={String(data.paidNotActivated ?? 0)}
        secondary={data.paidNotActivatedIsHeuristic ? "הערכה — לבדיקה ידנית" : undefined}
      />
    </div>
  );
}

// ── Table section ───────────────────────────────────────────────────────────────

function PaymentsTable() {
  const [processor, setProcessor] = useState("");
  const [status, setStatus]       = useState("");
  const [vertical, setVertical]   = useState("");
  const [q, setQ]                 = useState("");
  const [qInput, setQInput]       = useState("");
  const [from, setFrom]           = useState("");
  const [to, setTo]               = useState("");
  const [page, setPage]           = useState(1);
  const pageSize = 50;

  // Reset to page 1 whenever a filter changes.
  function setFilter(setter: (v: string) => void) {
    return (v: string) => { setter(v); setPage(1); };
  }

  const params = new URLSearchParams();
  if (processor) params.set("processor", processor);
  if (status)    params.set("status", status);
  if (vertical)  params.set("vertical", vertical);
  if (q)         params.set("q", q);
  if (from)      params.set("from", new Date(from).toISOString());
  if (to)        params.set("to", new Date(to).toISOString());
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));

  const url = `/api/admin/payments-control?${params.toString()}`;

  const { data, isLoading, isError, isFetching } = useQuery<ListResponse>({
    queryKey: [url],
    staleTime: 15_000,
    placeholderData: keepPreviousData,
  });

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const selectCls =
    "h-9 text-xs rounded-xl border border-gray-200 bg-white px-2 text-gray-700 focus:outline-none focus:ring-1";

  return (
    <div className="px-4 pb-8">
      {/* Filter bar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 mb-4">
        <div className="flex flex-wrap gap-2 items-end">
          {/* Search */}
          <form
            className="flex-1 min-w-[180px]"
            onSubmit={(e) => { e.preventDefault(); setQ(qInput.trim()); setPage(1); }}
          >
            <label className="text-[10px] text-gray-400 mb-1 block">חיפוש</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-gray-300 absolute right-2.5 top-1/2 -translate-y-1/2" />
              <Input
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
                placeholder="מזהה תשלום / לקוח / ספק / Nayax / חשבונית"
                className="h-9 text-xs pr-8"
              />
            </div>
          </form>

          <div>
            <label className="text-[10px] text-gray-400 mb-1 block">מעבד</label>
            <select className={selectCls} value={processor} onChange={(e) => setFilter(setProcessor)(e.target.value)}>
              {PROCESSOR_OPTIONS.map(p => (
                <option key={p || "all"} value={p}>{p ? processorLabel(p) : "הכל"}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 mb-1 block">סטטוס</label>
            <select className={selectCls} value={status} onChange={(e) => setFilter(setStatus)(e.target.value)}>
              {STATUS_OPTIONS.map(s => (
                <option key={s || "all"} value={s}>{s ? (STATUS_BADGE[s]?.label ?? s) : "הכל"}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 mb-1 block">אנכי</label>
            <select className={selectCls} value={vertical} onChange={(e) => setFilter(setVertical)(e.target.value)}>
              {VERTICAL_OPTIONS.map(v => (
                <option key={v || "all"} value={v}>{v || "הכל"}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-gray-400 mb-1 block">מתאריך</label>
            <input type="date" className={selectCls} value={from} onChange={(e) => setFilter(setFrom)(e.target.value)} />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 mb-1 block">עד תאריך</label>
            <input type="date" className={selectCls} value={to} onChange={(e) => setFilter(setTo)(e.target.value)} />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-400 border-b border-gray-100 bg-gray-50/50">
                <th className="text-right py-2.5 px-3 font-semibold whitespace-nowrap">מזהה תשלום</th>
                <th className="text-right py-2.5 px-3 font-semibold whitespace-nowrap">סוג</th>
                <th className="text-right py-2.5 px-3 font-semibold whitespace-nowrap">אנכי</th>
                <th className="text-right py-2.5 px-3 font-semibold whitespace-nowrap">לקוח</th>
                <th className="text-right py-2.5 px-3 font-semibold whitespace-nowrap">ספק</th>
                <th className="text-left py-2.5 px-3 font-semibold whitespace-nowrap">סכום ברוטו</th>
                <th className="text-right py-2.5 px-3 font-semibold whitespace-nowrap">אמצעי</th>
                <th className="text-right py-2.5 px-3 font-semibold whitespace-nowrap">מעבד</th>
                <th className="text-center py-2.5 px-3 font-semibold whitespace-nowrap">סטטוס</th>
                <th className="text-center py-2.5 px-3 font-semibold whitespace-nowrap">מסמך?</th>
                <th className="text-right py-2.5 px-3 font-semibold whitespace-nowrap">תאריך</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-gray-400">
                    <Loader2 className="w-5 h-5 animate-spin inline ml-2" /> טוען תשלומים...
                  </td>
                </tr>
              )}
              {isError && !isLoading && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-red-400">
                    שגיאה בטעינת התשלומים
                  </td>
                </tr>
              )}
              {!isLoading && !isError && data && data.rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="py-10 text-center text-gray-300">
                    לא נמצאו תשלומים התואמים לסינון
                  </td>
                </tr>
              )}
              {!isLoading && !isError && data?.rows.map((r) => {
                const hasDoc = !!(r.invoiceId || r.receiptId);
                return (
                  <tr key={r.paymentId} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/40">
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-700 whitespace-nowrap" title={r.paymentId}>
                      {shortId(r.paymentId)}
                    </td>
                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{r.transactionType}</td>
                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{r.vertical}</td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500 whitespace-nowrap" title={r.customerId ?? ""}>
                      {shortId(r.customerId)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-gray-500 whitespace-nowrap" title={r.providerId ?? ""}>
                      {shortId(r.providerId)}
                    </td>
                    <td className="py-2.5 px-3 text-left font-bold text-black tabular-nums whitespace-nowrap">
                      {ils(r.grossCents)}
                      {r.walletUsed && <span className="text-[9px] text-[#D4AF37] mr-1">ארנק</span>}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{r.paymentMethod ?? "—"}</td>
                    <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{processorLabel(r.paymentProcessor)}</td>
                    <td className="py-2.5 px-3 text-center"><StatusBadge status={r.status} /></td>
                    <td className="py-2.5 px-3 text-center">
                      {hasDoc ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600" title={r.invoiceId || r.receiptId || ""}>
                          {r.invoiceId ? <FileCheck2 className="w-3.5 h-3.5" /> : <Receipt className="w-3.5 h-3.5" />}
                        </span>
                      ) : (
                        <FileX2 className="w-3.5 h-3.5 text-gray-300 inline" />
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{fmtDatetime(r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100 text-[11px] text-gray-500">
          <span>
            {total.toLocaleString("he-IL")} תשלומים
            {isFetching && <Loader2 className="w-3 h-3 animate-spin inline mr-1.5" />}
          </span>
          <div className="flex items-center gap-2">
            <button
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              aria-label="הקודם"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <span className="tabular-nums">עמוד {page} מתוך {totalPages}</span>
            <button
              className="p-1.5 rounded-lg border border-gray-200 disabled:opacity-30 hover:bg-gray-50"
              disabled={page >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              aria-label="הבא"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────────

export default function AdminPaymentsControl() {
  return (
    <div dir="rtl" className="min-h-screen bg-white">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="px-4 pt-5 pb-1">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5" style={{ color: GOLD }} />
            <h1 className="text-xl font-bold text-black">תשלומים</h1>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            בקרת ספר התשלומים המאוחד (pw_payments) — צפייה בלבד.
          </p>
        </div>

        <SummarySection />
        <PaymentsTable />
      </div>
    </div>
  );
}
