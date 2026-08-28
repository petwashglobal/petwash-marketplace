/**
 * MyTransactions — the customer's fiscal transaction list.
 *
 * Route: /account/transactions. This is the CLIENT SIDE of the fiscal
 * passport work — server routes /api/fiscal/my/transactions and
 * /api/fiscal/transactions/by-source/:source/:id already ship (see
 * server/routes/fiscal-passport.ts + fiscalPassportHttp.integration.test.ts).
 * Until this file existed, those routes were unreachable from the app.
 *
 * READ-ONLY. Uses the same green-marble tokens as the Pet Passport family
 * (memory pet-passport-canonical-spec-2026-07-07):
 *   page bg  #FAFAF7   hero card  #063B22   gold  #D6B56D
 *   ink      #121212   border     #ECE6D8   muted #6B6E6A
 *
 * Two views:
 *   - List of the customer's own transactions across all 7 sources
 *   - Detail view for one transaction (drill-in) — server enforces
 *     participant scope, so a non-owner request 404s (privacy §34).
 */
import { useMemo, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { PetWashLogo } from '@/components/brand/PetWashLogo';
import {
  ArrowLeft, Receipt, ShoppingBag, Droplets, Gift, Wallet, Dog, Footprints,
  GraduationCap, Loader2, ChevronRight, FileText, ShieldCheck, RefreshCw,
  Cog,
} from 'lucide-react';
import { EgiftBalanceCard } from '@/components/egift/EgiftBalanceCard';
import { useWhoami } from '@/auth/useWhoami';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const MARBLE = '#FAFAF7';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

type Source =
  | 'shop_orders' | 'k9000_wash_events'
  | 'egift_guest_orders_purchase' | 'egift_guest_orders_redemption'
  | 'wallet_topup' | 'sitter_bookings' | 'walk_bookings' | 'trainer_bookings';

type PaymentState = 'PAYMENT_REQUIRED' | 'PAYMENT_PENDING' | 'PAID' | 'REFUNDED' | 'NOT_REQUIRED';

interface TxRow {
  transactionRef: string;
  correlationId: string;
  occurredAt: string;
  platform: 'SHOP' | 'K9000' | 'EGIFT' | 'SITTER_SUITE' | 'WALK_MY_PET' | 'ACADEMY' | 'PETTREK' | 'WALLET';
  label: string;
  totalCents: number;
  currency: 'ILS';
  paymentState: PaymentState;
  documentType?: 'InvoiceAndReceipt' | 'Receipt' | 'Invoice' | 'CreditInvoice';
  source: Source | 'trainer_bookings';
  sourceId: string;
}

interface FiscalPassport {
  correlationId: string;
  transactionRef: string;
  orderRef?: string;
  eventType: string;
  paymentClass: string;
  platform: string;
  serviceType?: string;
  money: {
    currency: string;
    subtotalCents: number;
    vatAmountCents?: number;
    totalCents: number;
    amountPaidCents: number;
    amountRefundedCents: number;
    amountOutstandingCents: number;
  };
  payment: { state: PaymentState; rail?: string; providerTransactionId?: string };
  fiscalDocument: {
    required: boolean;
    documentType?: string;
    state: string;
    originalDocumentId?: string;
    creditDocumentId?: string;
  };
  refundLineage?: {
    originalTransactionRef: string;
    refunds: Array<{
      refundRef: string;
      refundIndex: number;
      amountCents: number;
      externalRefundRef?: string;
      creditDocumentId?: string;
      createdAt: string;
    }>;
    totalRefundedCents: number;
    hasOrphanRefundWarning: boolean;
  };
  commercialState: string;
  fulfilmentState: string;
  payoutState: string;
  reconciliation: {
    paymentMatched: boolean;
    documentMatched: boolean;
    ledgerMatched: boolean;
    warnings: string[];
  };
  composedAt: string;
  items?: Array<{ label?: string; code?: string; quantity: number; unitAmountCents: number; totalCents: number }>;
}

function platformIcon(p: TxRow['platform']) {
  switch (p) {
    case 'SHOP': return <ShoppingBag className="w-5 h-5" />;
    case 'K9000': return <Droplets className="w-5 h-5" />;
    case 'EGIFT': return <Gift className="w-5 h-5" />;
    case 'WALLET': return <Wallet className="w-5 h-5" />;
    case 'SITTER_SUITE': return <Dog className="w-5 h-5" />;
    case 'WALK_MY_PET': return <Footprints className="w-5 h-5" />;
    case 'ACADEMY': return <GraduationCap className="w-5 h-5" />;
    default: return <Receipt className="w-5 h-5" />;
  }
}

function fmtCents(cents: number, isHe: boolean): string {
  const val = (cents / 100).toFixed(2);
  return isHe ? `₪${val}` : `₪${val}`;
}

function fmtDate(iso: string, isHe: boolean): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString(isHe ? 'he-IL' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
}

function paymentPill(state: PaymentState, isHe: boolean) {
  const map: Record<PaymentState, { bg: string; ink: string; label: [string, string] }> = {
    PAID:              { bg: '#E7F1EA', ink: GREEN, label: ['Paid', 'שולם'] },
    PAYMENT_PENDING:   { bg: '#FFF6E4', ink: '#8A5A00', label: ['Pending', 'בהמתנה'] },
    PAYMENT_REQUIRED:  { bg: '#FEECEC', ink: '#8A0A0A', label: ['Owed', 'לתשלום'] },
    REFUNDED:          { bg: '#F0E7F5', ink: '#5B2E86', label: ['Refunded', 'הוחזר'] },
    NOT_REQUIRED:      { bg: MARBLE,   ink: MUTED,  label: ['—', '—'] },
  };
  const m = map[state] ?? map.NOT_REQUIRED;
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
      style={{ background: m.bg, color: m.ink, border: `1px solid ${BORDER}` }}
    >
      {isHe ? m.label[1] : m.label[0]}
    </span>
  );
}

// ─── List view ───────────────────────────────────────────────────────

export default function MyTransactions() {
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);

  const { data, isLoading, isError, refetch } = useQuery<{ ok: boolean; transactions: TxRow[] }>({
    queryKey: ['/api/fiscal/my/transactions'],
    queryFn: async () => {
      const r = await apiRequest('GET', '/api/fiscal/my/transactions');
      return r.json();
    },
  });

  const rows = useMemo<TxRow[]>(() => Array.isArray(data?.transactions) ? data!.transactions : [], [data]);

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen" style={{ background: MARBLE }}>
      <div className="mx-auto w-full max-w-[480px] px-5 pt-5 pb-16">

        {/* Header */}
        <div dir="ltr" className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/my-account')}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: GREEN }}
            aria-label={tr('Back', 'חזרה')}
          >
            <ArrowLeft className="w-4 h-4" />
            {tr('Back', 'חזרה')}
          </button>
          <PetWashLogo size={30} />
        </div>

        {/* Hero */}
        <div className="rounded-[22px] p-5 shadow-lg" style={{ background: GREEN }}>
          <div className="flex items-center justify-between">
            <div style={{ textAlign: isHe ? 'right' : 'left' }}>
              <div className="text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: GOLD }}>
                {tr('PetWash™ · My transactions', 'PetWash™ · העסקאות שלי')}
              </div>
              <div className="mt-1 text-[24px] font-extrabold" style={{ color: GOLD }}>
                {tr('Receipts & orders', 'קבלות והזמנות')}
              </div>
              <div className="mt-0.5 text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                {tr('Every payment across PetWash — in one place.', 'כל תשלום ב-PetWash — במקום אחד.')}
              </div>
            </div>
            <ShieldCheck className="w-6 h-6" style={{ color: GOLD }} />
          </div>
        </div>

        {/* List */}
        <div className="mt-5">
          {isLoading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: GREEN }} />
            </div>
          )}

          {isError && !isLoading && (
            <div className="rounded-[22px] bg-white p-6 text-center" style={{ border: `1px solid ${BORDER}` }}>
              <p className="text-[15px] font-semibold" style={{ color: INK }}>
                {tr("Couldn't load your transactions.", 'שגיאה בטעינת העסקאות.')}
              </p>
              <button
                onClick={() => refetch()}
                className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold"
                style={{ background: GREEN, color: GOLD }}
              >
                <RefreshCw className="w-4 h-4" />
                {tr('Try again', 'נסו שוב')}
              </button>
            </div>
          )}

          {!isLoading && !isError && rows.length === 0 && (
            <div className="rounded-[22px] bg-white p-6 text-center" style={{ border: `1px solid ${BORDER}` }}>
              <Receipt className="w-6 h-6 mx-auto" style={{ color: GREEN }} />
              <p className="mt-3 text-[15px] font-semibold" style={{ color: INK }}>
                {tr('No transactions yet', 'אין עסקאות עדיין')}
              </p>
              <p className="mt-1 text-[12px]" style={{ color: MUTED }}>
                {tr('Your first order or wash will appear here.', 'ההזמנה או הרחצה הראשונה שלכם תופיע כאן.')}
              </p>
            </div>
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <ul className="space-y-2">
              {rows.map((r) => (
                <li key={`${r.source}:${r.sourceId}`}>
                  <button
                    onClick={() => navigate(`/account/transactions/${r.source}/${encodeURIComponent(r.sourceId)}`)}
                    className="w-full flex items-center gap-3 rounded-[16px] bg-white px-3 py-3 text-start transition-transform active:scale-[0.995]"
                    style={{ border: `1px solid ${BORDER}` }}
                  >
                    <span
                      className="flex h-10 w-10 items-center justify-center rounded-full shrink-0"
                      style={{ background: '#F1EEE0', color: GREEN }}
                    >
                      {platformIcon(r.platform)}
                    </span>
                    <span className="min-w-0 flex-1" style={{ textAlign: isHe ? 'right' : 'left' }}>
                      <span className="block truncate text-[14px] font-bold" style={{ color: INK }}>
                        {r.label}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2" style={{ color: MUTED }}>
                        <span className="text-[11px]">{fmtDate(r.occurredAt, isHe)}</span>
                        <span className="text-[11px]">·</span>
                        <span className="text-[11px] font-mono" dir="ltr">{r.transactionRef}</span>
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1 shrink-0" style={{ textAlign: 'end' }}>
                      <span className="text-[14px] font-extrabold" style={{ color: INK }} dir="ltr">
                        {fmtCents(r.totalCents, isHe)}
                      </span>
                      {paymentPill(r.paymentState, isHe)}
                    </span>
                    <ChevronRight
                      className="w-4 h-4 shrink-0"
                      style={{ color: MUTED, transform: isHe ? 'scaleX(-1)' : undefined }}
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {!isLoading && !isError && rows.length > 0 && (
            <p className="mt-4 text-center text-[11px]" style={{ color: MUTED }}>
              {tr(
                'Payments are read live from PetWash — nothing is duplicated.',
                'התשלומים נטענים ישירות מ-PetWash — אין כפילות.',
              )}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Detail view ─────────────────────────────────────────────────────

const BOOKING_SOURCES = new Set(['sitter_bookings', 'walk_bookings', 'trainer_bookings', 'booking_requests']);

export function MyTransactionDetail() {
  const { source, sourceId } = useParams<{ source: string; sourceId: string }>();
  const [, navigate] = useLocation();
  const { isSuperAdmin } = useWhoami();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);
  const [refetching, setRefetching] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery<{ ok: boolean; passport: FiscalPassport }>({
    queryKey: [`/api/fiscal/transactions/by-source/${source}/${sourceId}`],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/fiscal/transactions/by-source/${source}/${sourceId}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    retry: false,
  });

  const p = data?.passport;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: MARBLE }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GREEN }} />
      </div>
    );
  }
  if (isError || !p) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: MARBLE }}>
        <Receipt className="w-8 h-8" style={{ color: GREEN }} />
        <h2 className="mt-3 text-lg font-bold" style={{ color: INK }}>
          {tr('Transaction not found', 'העסקה לא נמצאה')}
        </h2>
        <p className="mt-1 text-sm" style={{ color: MUTED }}>
          {tr(
            "This receipt isn't in your account, or it may have been removed.",
            'הקבלה לא במשוייכת לחשבון שלכם או שהוסרה.',
          )}
        </p>
        <button
          onClick={() => navigate('/account/transactions')}
          className="mt-4 rounded-full px-5 py-2 text-sm font-semibold"
          style={{ background: GREEN, color: GOLD }}
        >
          {tr('Back to my transactions', 'חזרה לעסקאות שלי')}
        </button>
      </div>
    );
  }

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen" style={{ background: MARBLE }}>
      <div className="mx-auto w-full max-w-[480px] px-5 pt-5 pb-16">
        <div dir="ltr" className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate('/account/transactions')}
            className="flex items-center gap-1.5 text-sm font-semibold"
            style={{ color: GREEN }}
          >
            <ArrowLeft className="w-4 h-4" />
            {tr('Back', 'חזרה')}
          </button>
          <PetWashLogo size={30} />
        </div>

        {/* Green hero */}
        <div className="rounded-[22px] p-5 shadow-lg" style={{ background: GREEN }}>
          <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.22em] font-semibold" style={{ color: GOLD }}>
            <span>{tr('PetWash™ · Receipt', 'PetWash™ · קבלה')}</span>
            <span dir="ltr">{p.transactionRef}</span>
          </div>
          <div className="mt-3" style={{ textAlign: isHe ? 'right' : 'left' }}>
            <div className="text-[15px]" style={{ color: 'rgba(255,255,255,0.85)' }}>{p.platform.replace('_', ' ')}</div>
            <div className="mt-0.5 text-[24px] font-extrabold" style={{ color: GOLD }} dir="ltr">
              {fmtCents(p.money.totalCents, isHe)}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {paymentPill(p.payment.state, isHe)}
              {p.fiscalDocument?.state && p.fiscalDocument.state !== 'NOT_REQUIRED' && (
                <span
                  className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold"
                  style={{ background: 'rgba(214,181,109,0.18)', color: GOLD, border: `1px solid ${GOLD}` }}
                >
                  {p.fiscalDocument.documentType || 'Document'} · {p.fiscalDocument.state}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Admin explorer link — visible only to super-admins. Opens the
            §16 eight-axis view of the same transaction. */}
        {isSuperAdmin && source && sourceId && (
          <button
            type="button"
            onClick={() => navigate(`/admin/fiscal-transactions/${source}/${encodeURIComponent(String(sourceId))}`)}
            className="mt-4 w-full inline-flex items-center justify-between rounded-[16px] px-4 py-3 text-start"
            style={{ background: GREEN, color: GOLD, border: `1px solid ${GREEN}` }}
          >
            <span className="flex items-center gap-2">
              <Cog className="w-4 h-4" />
              <span className="text-sm font-bold">
                {tr('Open admin explorer', 'פתיחת חוקר ניהול')}
              </span>
            </span>
            <span aria-hidden>›</span>
          </button>
        )}

        {/* Link across to the JobPassport for booking-source transactions.
            Wire-only sweep 2026-08-27: the JobPassport route is real (see
            server/routes/job-passport.ts) but nothing but /provider/jobs
            linked to it. Now the customer's receipt links across too. */}
        {source && BOOKING_SOURCES.has(source) && (
          <button
            type="button"
            onClick={() => navigate(`/jobs/by-booking/${source}/${encodeURIComponent(String(sourceId))}`)}
            className="mt-4 w-full inline-flex items-center justify-between rounded-[16px] bg-white px-4 py-3 text-start"
            style={{ border: `1px solid ${BORDER}` }}
          >
            <span className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" style={{ color: GREEN }} />
              <span className="text-sm font-bold" style={{ color: INK }}>
                {tr('Open Job Passport', 'פתיחת דרכון עבודה')}
              </span>
            </span>
            <ChevronRight className="w-4 h-4" style={{ color: MUTED, transform: isHe ? 'scaleX(-1)' : undefined }} />
          </button>
        )}

        {/* eGift live balance — CEO §31: reserved value MUST be visible.
            Only surfaces on the customer's own eGift purchase row where
            the sourceId is the egift external id. */}
        {source === 'egift_guest_orders_purchase' && sourceId && (
          <div className="mt-4">
            <EgiftBalanceCard egiftId={String(sourceId)} />
          </div>
        )}

        {/* Money */}
        <div className="mt-4 rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
          <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-3" style={{ color: GREEN }}>
            {tr('Payment', 'תשלום')}
          </div>
          <Kv k={tr('Subtotal', 'סכום ביניים')} v={fmtCents(p.money.subtotalCents, isHe)} />
          {p.money.vatAmountCents !== undefined && (
            <Kv k={tr('VAT', 'מע״מ')} v={fmtCents(p.money.vatAmountCents, isHe)} />
          )}
          <Kv k={tr('Total', 'סה״כ')} v={fmtCents(p.money.totalCents, isHe)} bold />
          <Kv k={tr('Paid', 'שולם')} v={fmtCents(p.money.amountPaidCents, isHe)} />
          {p.money.amountRefundedCents > 0 && (
            <Kv k={tr('Refunded', 'הוחזר')} v={fmtCents(p.money.amountRefundedCents, isHe)} />
          )}
          {p.money.amountOutstandingCents > 0 && (
            <Kv k={tr('Outstanding', 'יתרה לתשלום')} v={fmtCents(p.money.amountOutstandingCents, isHe)} bold />
          )}
        </div>

        {/* Items */}
        {Array.isArray(p.items) && p.items.length > 0 && (
          <div className="mt-4 rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-3" style={{ color: GREEN }}>
              {tr('Items', 'פריטים')}
            </div>
            <ul className="space-y-2">
              {p.items.map((it, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span style={{ color: INK }}>
                    {it.label || it.code || tr('Item', 'פריט')}
                    {it.quantity !== 1 && <span style={{ color: MUTED }}> × {it.quantity}</span>}
                  </span>
                  <span dir="ltr" className="font-semibold" style={{ color: INK }}>
                    {fmtCents(it.totalCents, isHe)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Fiscal document detail */}
        {p.fiscalDocument?.state && p.fiscalDocument.state !== 'NOT_REQUIRED' && (
          <div className="mt-4 rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4" style={{ color: GREEN }} />
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
                {tr('Fiscal document', 'מסמך פיסקלי')}
              </span>
            </div>
            <Kv k={tr('Type', 'סוג')} v={p.fiscalDocument.documentType || '—'} />
            <Kv k={tr('State', 'סטטוס')} v={p.fiscalDocument.state} />
            {p.fiscalDocument.originalDocumentId && (
              <Kv k={tr('Original doc', 'מסמך מקורי')} v={p.fiscalDocument.originalDocumentId} mono />
            )}
            {p.fiscalDocument.creditDocumentId && (
              <Kv k={tr('Credit doc', 'זיכוי')} v={p.fiscalDocument.creditDocumentId} mono />
            )}
          </div>
        )}

        {/* Refund lineage — §34-36. Renders each refund event with amount,
            external ref, credit-doc id. Amber tint when the credit fiscal
            document is still missing on any refund. */}
        {p.refundLineage && (p.refundLineage.refunds.length > 0 || p.refundLineage.hasOrphanRefundWarning) && (
          <div className="mt-4 rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
            <div className="flex items-center gap-2 mb-3">
              <RefreshCw className="w-4 h-4" style={{ color: GREEN }} />
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
                {tr('Refunds', 'זיכויים')}
              </span>
            </div>
            <Kv k={tr('Total refunded', 'סה״כ הוחזר')} v={fmtCents(p.refundLineage.totalRefundedCents, isHe)} bold />
            <div className="mt-3 space-y-2">
              {p.refundLineage.refunds.map((r) => (
                <div
                  key={r.refundRef}
                  className="rounded-xl px-3 py-2.5"
                  style={{ background: MARBLE, border: `1px solid ${BORDER}` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-semibold font-mono" style={{ color: INK }} dir="ltr">
                      {r.refundRef}
                    </span>
                    <span className="text-[14px] font-extrabold" style={{ color: INK }} dir="ltr">
                      {fmtCents(r.amountCents, isHe)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px]" style={{ color: MUTED }}>
                    <span dir="ltr">{fmtDate(r.createdAt, isHe)}</span>
                    {r.creditDocumentId
                      ? <span className="font-mono" dir="ltr">Doc {r.creditDocumentId}</span>
                      : <span style={{ color: '#8A5A00', fontWeight: 700 }}>
                          {tr('Credit doc pending', 'זיכוי פיסקלי בהמתנה')}
                        </span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reconciliation warnings — honest surface */}
        {p.reconciliation?.warnings?.length > 0 && (
          <div className="mt-4 rounded-[22px] p-4" style={{ background: '#FFF6E4', border: `1px solid ${GOLD}` }}>
            <div className="text-[11px] uppercase tracking-[0.18em] font-bold mb-2" style={{ color: '#8A5A00' }}>
              {tr('Attention', 'שים לב')}
            </div>
            <ul className="list-disc ps-5 space-y-1 text-[13px]" style={{ color: '#8A5A00' }}>
              {p.reconciliation.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* States row */}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <StateChip label={tr('Commercial', 'מסחרי')} value={p.commercialState} />
          <StateChip label={tr('Fulfilment', 'מימוש')} value={p.fulfilmentState} />
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px]" style={{ color: MUTED }}>
          <span dir="ltr" className="font-mono">{p.correlationId}</span>
          <button
            onClick={async () => { setRefetching(true); await refetch(); setRefetching(false); }}
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: GREEN }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refetching ? 'animate-spin' : ''}`} />
            {tr('Refresh', 'רענון')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Kv({ k, v, bold, mono }: { k: string; v: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: BORDER }}>
      <span className="text-[12px]" style={{ color: MUTED }}>{k}</span>
      <span
        className={`text-[14px] ${bold ? 'font-extrabold' : 'font-semibold'}`}
        style={{ color: INK, fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : undefined }}
        dir="ltr"
      >
        {v}
      </span>
    </div>
  );
}

function StateChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: 'white', border: `1px solid ${BORDER}` }}>
      <div className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>{label}</div>
      <div className="text-[13px] font-bold mt-0.5" style={{ color: GREEN }}>{value}</div>
    </div>
  );
}
