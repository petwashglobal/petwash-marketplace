/**
 * AdminTransactionExplorer — CEO 2026-08-27 §16.
 *
 * Route: /admin/fiscal-transactions/:source/:sourceId. Staff-only.
 * Consumes GET /api/fiscal/admin/by-source/:source/:sourceId
 * (server/routes/fiscal-passport.ts admin route, 403 for non-staff).
 *
 * Renders ONE transaction along the eight axes CEO §16 named:
 *   COMMERCIAL · PAYMENT · FUNDING · FISCAL · FULFILMENT · PROVIDER
 *   REFUND · RECONCILIATION  (with warnings inline)
 *
 * Until this file existed, the /admin/by-source endpoint was reachable
 * only via curl — the fiscal-passport server work was invisible to
 * staff in the app. Now it's mounted at a real route with a real UI.
 */
import { useParams, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { PetWashLogo } from '@/components/brand/PetWashLogo';
import {
  ArrowLeft, Loader2, ShieldCheck, RefreshCw, ChevronRight,
  CreditCard, FileText, Package, User, RotateCcw, ShoppingBag,
  AlertTriangle,
} from 'lucide-react';

const GREEN = '#063B22';
const GOLD = '#D6B56D';
const MARBLE = '#FAFAF7';
const BORDER = '#ECE6D8';
const INK = '#121212';
const MUTED = '#6B6E6A';

interface AdminFiscalPassport {
  correlationId: string;
  transactionRef: string;
  orderRef?: string;
  bookingRef?: string;
  eventType: string;
  paymentClass: string;
  platform: string;
  serviceType: string;
  customer: { kind: string; uid?: string; displayName?: string; email?: string };
  supplierOrFulfiller: { kind: string; uid?: string; displayName?: string; publicId?: string };
  items: Array<{ label?: string; code?: string; quantity: number; unitAmountCents: number; totalCents: number }>;
  money: {
    currency: string;
    subtotalCents: number;
    vatAmountCents?: number;
    totalCents: number;
    amountPaidCents: number;
    amountRefundedCents: number;
    amountOutstandingCents: number;
  };
  fundingLegs: Array<{ rail: string; amountCents: number; currency: string; label: string; externalRef?: string }>;
  payment: { state: string; rail?: string; providerTransactionId?: string };
  fiscalDocument: {
    required: boolean;
    documentType?: string;
    state: string;
    sumitDocumentId?: string;
    originalDocumentId?: string;
    creditDocumentId?: string;
  };
  providerMoney?: {
    expectedCents: number;
    pendingCents: number;
    availableCents: number;
    paidCents: number;
    payoutReference?: string;
  };
  commercialState: string;
  fulfilmentState: string;
  payoutState: string;
  reconciliation: {
    paymentMatched: boolean;
    documentMatched: boolean;
    ledgerMatched: boolean;
    payoutMatched?: boolean;
    warnings: string[];
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
      instrument?: 'wallet' | 'egift' | 'loyalty' | 'promo' | 'wash_pack' | 'card' | 'unknown';
      status?: string;
      reason?: string;
    }>;
    totalRefundedCents: number;
    hasOrphanRefundWarning: boolean;
  };
  composedAt: string;
}

function fmtCents(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}

function warningTone(w: string): { bg: string; ink: string; icon: string } {
  const critical = /UNMATCHED|DUPLICATE|AMOUNT_MISMATCH|MISSING_PAYMENT/i.test(w);
  return critical
    ? { bg: '#FEECEC', ink: '#8A0A0A', icon: '⚠️' }
    : { bg: '#FFF6E4', ink: '#8A5A00', icon: '•' };
}

export default function AdminTransactionExplorer() {
  const { source, sourceId } = useParams<{ source: string; sourceId: string }>();
  const [, navigate] = useLocation();
  const { language } = useLanguage();
  const isHe = language === 'he';
  const tr = (en: string, he: string) => (isHe ? he : en);

  const { data, isLoading, isError, refetch, isFetching } = useQuery<{ ok: boolean; passport: AdminFiscalPassport }>({
    queryKey: [`/api/fiscal/admin/by-source/${source}/${sourceId}`],
    queryFn: async () => {
      const r = await apiRequest('GET', `/api/fiscal/admin/by-source/${source}/${sourceId}`);
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: MARBLE }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: GREEN }} />
      </div>
    );
  }
  if (isError || !data?.passport) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: MARBLE }}>
        <ShieldCheck className="w-8 h-8" style={{ color: GREEN }} />
        <h2 className="mt-3 text-lg font-bold" style={{ color: INK }}>
          {tr('Transaction not found or admin-only', 'העסקה לא נמצאה או מוגבלת לניהול')}
        </h2>
        <button
          onClick={() => navigate('/admin')}
          className="mt-4 rounded-full px-5 py-2 text-sm font-semibold"
          style={{ background: GREEN, color: GOLD }}
        >
          {tr('Back to admin', 'חזרה לניהול')}
        </button>
      </div>
    );
  }

  const p = data.passport;
  const warnings = p.reconciliation?.warnings ?? [];

  return (
    <div dir={isHe ? 'rtl' : 'ltr'} className="min-h-screen" style={{ background: MARBLE }}>
      <div className="mx-auto w-full max-w-[560px] px-5 pt-5 pb-16">
        <div dir="ltr" className="flex items-center justify-between mb-4">
          <button
            onClick={() => history.length > 1 ? history.back() : navigate('/admin')}
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
            <span>{tr('Admin · Transaction Passport', 'ניהול · דרכון עסקה')}</span>
            <span dir="ltr">{p.transactionRef}</span>
          </div>
          <div className="mt-3">
            <div className="text-[15px]" style={{ color: 'rgba(255,255,255,0.9)' }}>
              {p.platform.replace(/_/g, ' ')} · {p.serviceType}
            </div>
            <div className="mt-0.5 text-[24px] font-extrabold" style={{ color: GOLD }} dir="ltr">
              {fmtCents(p.money.totalCents)}
            </div>
            <div className="mt-2 text-[12px]" style={{ color: 'rgba(255,255,255,0.75)' }}>
              {tr('Customer', 'לקוח')}: {p.customer.displayName ?? p.customer.uid ?? '—'}
              {p.customer.email && <span dir="ltr"> · {p.customer.email}</span>}
            </div>
          </div>
        </div>

        {/* Reconciliation warnings — surface FIRST for staff (§16 inline). */}
        {warnings.length > 0 && (
          <div className="mt-4 rounded-[22px] p-4" style={{ background: '#FFF6E4', border: `1px solid ${GOLD}` }}>
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4" style={{ color: '#8A5A00' }} />
              <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: '#8A5A00' }}>
                {tr('Reconciliation warnings', 'התראות התאמה')}
              </span>
            </div>
            <ul className="space-y-1">
              {warnings.map((w, i) => {
                const t = warningTone(w);
                return (
                  <li
                    key={i}
                    className="rounded-lg px-2 py-1 text-[13px] font-semibold flex items-center gap-2"
                    style={{ background: t.bg, color: t.ink }}
                  >
                    <span>{t.icon}</span>
                    <span dir="ltr">{w}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* COMMERCIAL */}
        <Axis icon={<ShoppingBag className="w-4 h-4" />} title={tr('Commercial', 'מסחרי')}>
          <Kv k={tr('Event', 'אירוע')} v={p.eventType} />
          <Kv k={tr('Class', 'סיווג')} v={p.paymentClass} />
          <Kv k={tr('State', 'סטטוס')} v={p.commercialState} />
          {p.orderRef && <Kv k={tr('Order ref', 'מס׳ הזמנה')} v={p.orderRef} mono />}
          {p.bookingRef && <Kv k={tr('Booking ref', 'מס׳ הזמנה')} v={p.bookingRef} mono />}
          {p.items.length > 0 && (
            <div className="mt-2">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: MUTED }}>{tr('Items', 'פריטים')}</div>
              <ul className="mt-1 space-y-1">
                {p.items.map((it, i) => (
                  <li key={i} className="flex items-center justify-between text-[13px]">
                    <span style={{ color: INK }}>
                      {it.label || it.code}
                      {it.quantity !== 1 && <span style={{ color: MUTED }}> × {it.quantity}</span>}
                    </span>
                    <span dir="ltr" style={{ color: INK }}>{fmtCents(it.totalCents)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Axis>

        {/* PAYMENT */}
        <Axis icon={<CreditCard className="w-4 h-4" />} title={tr('Payment', 'תשלום')}>
          <Kv k={tr('State', 'סטטוס')} v={p.payment.state} bold />
          {p.payment.rail && <Kv k={tr('Rail', 'ערוץ')} v={p.payment.rail} />}
          {p.payment.providerTransactionId && (
            <Kv k={tr('Provider txn', 'עסקה חיצונית')} v={p.payment.providerTransactionId} mono />
          )}
          <Kv k={tr('Subtotal', 'סכום ביניים')} v={fmtCents(p.money.subtotalCents)} />
          {p.money.vatAmountCents !== undefined && <Kv k={tr('VAT', 'מע״מ')} v={fmtCents(p.money.vatAmountCents)} />}
          <Kv k={tr('Total', 'סה״כ')} v={fmtCents(p.money.totalCents)} bold />
          <Kv k={tr('Paid', 'שולם')} v={fmtCents(p.money.amountPaidCents)} />
          {p.money.amountRefundedCents > 0 && (
            <Kv k={tr('Refunded', 'הוחזר')} v={fmtCents(p.money.amountRefundedCents)} />
          )}
          {p.money.amountOutstandingCents > 0 && (
            <Kv k={tr('Outstanding', 'יתרה')} v={fmtCents(p.money.amountOutstandingCents)} bold />
          )}
        </Axis>

        {/* FUNDING */}
        <Axis icon={<Package className="w-4 h-4" />} title={tr('Funding legs', 'רגלי מימון')}>
          {p.fundingLegs.length === 0 ? (
            <p className="text-[13px]" style={{ color: MUTED }}>{tr('No legs.', 'אין רגלי מימון.')}</p>
          ) : (
            <ul className="space-y-1">
              {p.fundingLegs.map((leg, i) => (
                <li key={i}>
                  <div className="flex items-center justify-between text-[13px] font-semibold">
                    <span style={{ color: INK }}>{leg.label}</span>
                    <span dir="ltr" style={{ color: INK }}>{fmtCents(leg.amountCents)}</span>
                  </div>
                  {leg.externalRef && (
                    <div className="text-[11px] font-mono" style={{ color: MUTED }} dir="ltr">
                      {leg.rail} · {leg.externalRef}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Axis>

        {/* FISCAL */}
        <Axis icon={<FileText className="w-4 h-4" />} title={tr('Fiscal document', 'מסמך פיסקלי')}>
          <Kv k={tr('Required', 'חובה')} v={p.fiscalDocument.required ? tr('Yes', 'כן') : tr('No', 'לא')} />
          <Kv k={tr('Type', 'סוג')} v={p.fiscalDocument.documentType ?? '—'} />
          <Kv k={tr('State', 'סטטוס')} v={p.fiscalDocument.state} bold />
          {p.fiscalDocument.sumitDocumentId && (
            <Kv k={tr('SUMIT doc', 'מסמך SUMIT')} v={p.fiscalDocument.sumitDocumentId} mono />
          )}
          {p.fiscalDocument.originalDocumentId && (
            <Kv k={tr('Original doc', 'מסמך מקורי')} v={p.fiscalDocument.originalDocumentId} mono />
          )}
          {p.fiscalDocument.creditDocumentId && (
            <Kv k={tr('Credit doc', 'זיכוי')} v={p.fiscalDocument.creditDocumentId} mono />
          )}
        </Axis>

        {/* FULFILMENT */}
        <Axis icon={<ChevronRight className="w-4 h-4" />} title={tr('Fulfilment', 'מימוש')}>
          <Kv k={tr('State', 'סטטוס')} v={p.fulfilmentState} bold />
          <Kv k={tr('Payout state', 'סטטוס תשלום לספק')} v={p.payoutState} />
        </Axis>

        {/* PROVIDER — only when the passport carries provider money */}
        {p.providerMoney && (
          <Axis icon={<User className="w-4 h-4" />} title={tr('Provider', 'ספק')}>
            {p.supplierOrFulfiller.displayName && (
              <Kv k={tr('Name', 'שם')} v={p.supplierOrFulfiller.displayName} />
            )}
            {p.supplierOrFulfiller.publicId && (
              <Kv k={tr('Public id', 'מזהה ציבורי')} v={p.supplierOrFulfiller.publicId} mono />
            )}
            <Kv k={tr('Expected', 'צפוי')} v={fmtCents(p.providerMoney.expectedCents)} />
            <Kv k={tr('Pending', 'ממתין')} v={fmtCents(p.providerMoney.pendingCents)} />
            <Kv k={tr('Available', 'זמין')} v={fmtCents(p.providerMoney.availableCents)} />
            <Kv k={tr('Paid', 'שולם')} v={fmtCents(p.providerMoney.paidCents)} bold />
            {p.providerMoney.payoutReference && (
              <Kv k={tr('Payout ref', 'הפניית תשלום')} v={p.providerMoney.payoutReference} mono />
            )}
          </Axis>
        )}

        {/* REFUND */}
        {p.refundLineage && (p.refundLineage.refunds.length > 0 || p.refundLineage.hasOrphanRefundWarning) && (
          <Axis icon={<RotateCcw className="w-4 h-4" />} title={tr('Refunds', 'זיכויים')}>
            <Kv k={tr('Total refunded', 'סה״כ הוחזר')} v={fmtCents(p.refundLineage.totalRefundedCents)} bold />
            <ul className="mt-2 space-y-2">
              {p.refundLineage.refunds.map((r) => (
                <li
                  key={r.refundRef}
                  className="rounded-xl px-3 py-2"
                  style={{ background: MARBLE, border: `1px solid ${BORDER}` }}
                >
                  <div className="flex items-center justify-between text-[13px]">
                    <span style={{ color: INK, fontWeight: 700 }}>
                      {r.instrument ? r.instrument.toUpperCase() : 'REFUND'}
                    </span>
                    <span dir="ltr" style={{ color: INK, fontWeight: 800 }}>{fmtCents(r.amountCents)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[11px]" style={{ color: MUTED }}>
                    <span className="font-mono" dir="ltr">{r.refundRef}</span>
                    <span dir="ltr">{r.status ?? 'succeeded'}</span>
                  </div>
                  <div className="mt-0.5 text-[11px]" style={{ color: MUTED }}>
                    {r.creditDocumentId
                      ? <span className="font-mono" dir="ltr">Doc {r.creditDocumentId}</span>
                      : <span style={{ color: '#8A5A00', fontWeight: 700 }}>{tr('Credit doc pending', 'זיכוי פיסקלי בהמתנה')}</span>}
                    {r.externalRefundRef && (
                      <span className="ms-3 font-mono" dir="ltr">{r.externalRefundRef}</span>
                    )}
                  </div>
                  {r.reason && (
                    <div className="mt-0.5 text-[11px] italic" style={{ color: MUTED }}>{r.reason}</div>
                  )}
                </li>
              ))}
            </ul>
          </Axis>
        )}

        {/* RECONCILIATION detail (below the top warnings summary) */}
        <Axis icon={<ShieldCheck className="w-4 h-4" />} title={tr('Reconciliation', 'התאמה')}>
          <Kv k={tr('Payment matched', 'תשלום תואם')} v={p.reconciliation.paymentMatched ? '✓' : '✗'} />
          <Kv k={tr('Document matched', 'מסמך תואם')} v={p.reconciliation.documentMatched ? '✓' : '✗'} />
          <Kv k={tr('Ledger matched', 'ספר תואם')} v={p.reconciliation.ledgerMatched ? '✓' : '✗'} />
          {p.reconciliation.payoutMatched !== undefined && (
            <Kv k={tr('Payout matched', 'תשלום לספק תואם')} v={p.reconciliation.payoutMatched ? '✓' : '✗'} />
          )}
        </Axis>

        {/* Footer */}
        <div className="mt-4 flex items-center justify-between text-[11px]" style={{ color: MUTED }}>
          <span dir="ltr" className="font-mono">{p.correlationId}</span>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-1 font-semibold"
            style={{ color: GREEN }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            {tr('Refresh', 'רענון')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Axis({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-[22px] bg-white p-5" style={{ border: `1px solid ${BORDER}` }}>
      <div className="flex items-center gap-2 mb-3">
        <span style={{ color: GREEN }}>{icon}</span>
        <span className="text-[11px] uppercase tracking-[0.18em] font-bold" style={{ color: GREEN }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function Kv({ k, v, bold, mono }: { k: string; v: string; bold?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b last:border-0" style={{ borderColor: BORDER }}>
      <span className="text-[12px]" style={{ color: MUTED }}>{k}</span>
      <span
        className={`text-[13px] ${bold ? 'font-extrabold' : 'font-semibold'}`}
        style={{ color: INK, fontFamily: mono ? 'ui-monospace, SFMono-Regular, monospace' : undefined }}
        dir="ltr"
      >
        {v}
      </span>
    </div>
  );
}
