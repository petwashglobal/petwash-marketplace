// =============================================================================
// AdminDeadlines.tsx — Governance: Deadlines & Insurance (READ-ONLY)
// =============================================================================
// Surfaces the Legal-Deadline Reminder Engine (§13) + Insurance/Utilities
// dashboard (§19 + §17-utilities). Bilingual (en/he), RTL-aware, white/black
// with gold (#D4AF37) accents.
//
// HONESTY: this page renders ONLY factual status returned by the API. It never
// states "fully insured" / "fully covered" — coverage areas without a backing
// table are shown explicitly as "not tracked yet".
// =============================================================================

import { useQuery } from '@tanstack/react-query';
import { useLanguage } from '@/lib/languageStore';
import { ShieldCheck, AlertTriangle, Clock, FileText, Loader2 } from 'lucide-react';

const GOLD = '#D4AF37';

type Severity = 'critical' | 'high' | 'medium' | 'low' | 'info';

interface Deadline {
  type: string;
  label: string;
  entity: string;
  dueDate: string;
  daysUntil: number;
  severity: Severity;
}

interface DeadlinesResponse {
  generatedAt: string;
  horizonDays: number;
  total: number;
  deadlines: Deadline[];
  sources: Array<{ source: string; ok: boolean; count: number; reason?: string }>;
  notTracked: string[];
}

interface Policy {
  insurer: string | null;
  type: string;
  coveredEntity: string;
  startDate: string | null;
  endDate: string | null;
  renewalDaysUntil: number | null;
  status: 'active' | 'expiring' | 'expired' | 'unknown';
  documentPresent: boolean;
  source: string;
}

interface InsuranceResponse {
  generatedAt: string;
  disclaimer: string;
  summary: {
    total: number; active: number; expiring: number; expired: number;
    unknown: number; missingDocument: number;
  };
  policies: Policy[];
  coverageAreas: Array<{ area: string; tracked: boolean; backedBy: string | null; note: string }>;
  sources: Array<{ source: string; ok: boolean; count: number; reason?: string }>;
}

const SEVERITY_STYLE: Record<Severity, { bg: string; border: string; text: string }> = {
  critical: { bg: '#FEF2F2', border: '#DC2626', text: '#991B1B' },
  high:     { bg: '#FFF7ED', border: '#EA580C', text: '#9A3412' },
  medium:   { bg: '#FEFCE8', border: '#CA8A04', text: '#854D0E' },
  low:      { bg: '#F0FDF4', border: '#16A34A', text: '#166534' },
  info:     { bg: '#F8FAFC', border: '#94A3B8', text: '#475569' },
};

const STATUS_STYLE: Record<Policy['status'], { label: string; labelHe: string; color: string }> = {
  active:   { label: 'Active',   labelHe: 'בתוקף',   color: '#16A34A' },
  expiring: { label: 'Expiring', labelHe: 'עומד לפוג', color: '#CA8A04' },
  expired:  { label: 'Expired',  labelHe: 'פג תוקף',  color: '#DC2626' },
  unknown:  { label: 'Unknown',  labelHe: 'לא ידוע',  color: '#64748B' },
};

function severityLabel(s: Severity, he: boolean): string {
  const map: Record<Severity, [string, string]> = {
    critical: ['Critical', 'קריטי'],
    high: ['High', 'גבוה'],
    medium: ['Medium', 'בינוני'],
    low: ['Low', 'נמוך'],
    info: ['Info', 'מידע'],
  };
  return map[s][he ? 1 : 0];
}

export default function AdminDeadlines() {
  const { language, dir } = useLanguage();
  const he = language === 'he';

  const deadlinesQ = useQuery<DeadlinesResponse>({ queryKey: ['/api/admin/deadlines'] });
  const insuranceQ = useQuery<InsuranceResponse>({ queryKey: ['/api/admin/insurance-status'] });

  return (
    <div dir={dir} style={{ background: '#FFFFFF', minHeight: '100dvh', color: '#000000' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px', paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}>

        {/* Header */}
        <header style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShieldCheck size={28} style={{ color: GOLD }} />
            <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
              {he ? 'תזכורות וביטוחים' : 'Deadlines & Insurance'}
            </h1>
          </div>
          <p style={{ color: '#525252', marginTop: 8, fontSize: 14 }}>
            {he
              ? 'מועדי חידוש, תפוגה ותשלום קרבים + סטטוס ביטוח עובדתי. קריאה בלבד.'
              : 'Upcoming renewal, expiry and payment deadlines + factual insurance status. Read-only.'}
          </p>
        </header>

        {/* ===================== DEADLINE FEED ===================== */}
        <section style={{ marginBottom: 40 }}>
          <SectionTitle
            icon={<Clock size={18} style={{ color: GOLD }} />}
            title={he ? 'מועדים קרבים' : 'Upcoming deadlines'}
            subtitle={
              deadlinesQ.data
                ? (he
                    ? `${deadlinesQ.data.total} פריטים בחלון של ${deadlinesQ.data.horizonDays} ימים`
                    : `${deadlinesQ.data.total} items within ${deadlinesQ.data.horizonDays} days`)
                : undefined
            }
          />

          {deadlinesQ.isLoading && <LoadingRow he={he} />}
          {deadlinesQ.isError && <ErrorRow he={he} />}

          {deadlinesQ.data && deadlinesQ.data.deadlines.length === 0 && (
            <EmptyRow text={he ? 'אין מועדים קרבים בחלון הזמן.' : 'No upcoming deadlines in the window.'} />
          )}

          <div style={{ display: 'grid', gap: 10 }}>
            {deadlinesQ.data?.deadlines.map((d, i) => {
              const st = SEVERITY_STYLE[d.severity];
              const overdue = d.daysUntil < 0;
              return (
                <div
                  key={`${d.type}-${i}`}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    gap: 16, padding: '14px 16px', borderRadius: 12,
                    background: st.bg, border: `1px solid ${st.border}`,
                    borderInlineStart: `4px solid ${st.border}`,
                  }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 15, color: '#0A0A0A' }}>{d.label}</div>
                    <div style={{ fontSize: 13, color: '#525252', marginTop: 2 }}>{d.entity}</div>
                  </div>
                  <div style={{ textAlign: dir === 'rtl' ? 'left' : 'right', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-block', fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                        color: st.text, background: '#FFFFFF', border: `1px solid ${st.border}`,
                        borderRadius: 999, padding: '2px 8px',
                      }}
                    >
                      {severityLabel(d.severity, he)}
                    </span>
                    <div style={{ fontSize: 13, marginTop: 4, color: '#0A0A0A' }}>{d.dueDate}</div>
                    <div style={{ fontSize: 12, color: overdue ? '#DC2626' : '#525252', fontWeight: overdue ? 700 : 400 }}>
                      {overdue
                        ? (he ? `באיחור של ${Math.abs(d.daysUntil)} ימים` : `${Math.abs(d.daysUntil)}d overdue`)
                        : (he ? `בעוד ${d.daysUntil} ימים` : `in ${d.daysUntil}d`)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Honest "not tracked" list */}
          {deadlinesQ.data?.notTracked?.length ? (
            <NotTrackedBox
              title={he ? 'לא במעקב עדיין' : 'Not tracked yet'}
              items={deadlinesQ.data.notTracked}
            />
          ) : null}

          {deadlinesQ.data?.sources?.some(s => !s.ok) && (
            <SourceErrors sources={deadlinesQ.data.sources} he={he} />
          )}
        </section>

        {/* ===================== INSURANCE STATUS ===================== */}
        <section>
          <SectionTitle
            icon={<ShieldCheck size={18} style={{ color: GOLD }} />}
            title={he ? 'סטטוס ביטוח' : 'Insurance status'}
          />

          {insuranceQ.isLoading && <LoadingRow he={he} />}
          {insuranceQ.isError && <ErrorRow he={he} />}

          {insuranceQ.data && (
            <>
              {/* Disclaimer — never claim fully insured */}
              <div
                style={{
                  background: '#FFFBEB', border: `1px solid ${GOLD}`, borderRadius: 12,
                  padding: '12px 14px', marginBottom: 18, display: 'flex', gap: 10,
                }}
              >
                <AlertTriangle size={18} style={{ color: GOLD, flexShrink: 0, marginTop: 1 }} />
                <p style={{ margin: 0, fontSize: 13, color: '#713F12', lineHeight: 1.5 }}>
                  {he
                    ? 'הלוח מציג אך ורק רשומות ביטוח הקיימות במערכת. היעדר רשומה אינו מעיד על חוסר ביטוח, וקיום רשומה אינו מאשר כיסוי מספק. אין באמור משום הצהרה בדבר קיום כיסוי ביטוחי מלא של החברה.'
                    : insuranceQ.data.disclaimer}
                </p>
              </div>

              {/* Summary chips */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 18 }}>
                <SummaryChip label={he ? 'סה״כ פוליסות' : 'Policies'} value={insuranceQ.data.summary.total} color="#0A0A0A" />
                <SummaryChip label={he ? 'בתוקף' : 'Active'} value={insuranceQ.data.summary.active} color="#16A34A" />
                <SummaryChip label={he ? 'עומד לפוג' : 'Expiring'} value={insuranceQ.data.summary.expiring} color="#CA8A04" />
                <SummaryChip label={he ? 'פג תוקף' : 'Expired'} value={insuranceQ.data.summary.expired} color="#DC2626" />
                <SummaryChip label={he ? 'חסר מסמך' : 'Missing doc'} value={insuranceQ.data.summary.missingDocument} color="#9333EA" />
              </div>

              {/* Policy table */}
              {insuranceQ.data.policies.length === 0 ? (
                <EmptyRow text={he ? 'אין רשומות ביטוח במערכת.' : 'No insurance records in the system.'} />
              ) : (
                <div style={{ overflowX: 'auto', border: '1px solid #E5E5E5', borderRadius: 12, marginBottom: 22 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: '#FAFAFA', textAlign: dir === 'rtl' ? 'right' : 'left' }}>
                        <Th>{he ? 'מבטח' : 'Insurer'}</Th>
                        <Th>{he ? 'סוג' : 'Type'}</Th>
                        <Th>{he ? 'ישות מכוסה' : 'Covered entity'}</Th>
                        <Th>{he ? 'תוקף עד' : 'End'}</Th>
                        <Th>{he ? 'סטטוס' : 'Status'}</Th>
                        <Th>{he ? 'מסמך' : 'Doc'}</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {insuranceQ.data.policies.map((p, i) => {
                        const ss = STATUS_STYLE[p.status];
                        return (
                          <tr key={i} style={{ borderTop: '1px solid #F0F0F0' }}>
                            <Td>{p.insurer || (he ? '—' : '—')}</Td>
                            <Td>{p.type}</Td>
                            <Td>{p.coveredEntity}</Td>
                            <Td>{p.endDate || '—'}</Td>
                            <Td>
                              <span style={{ color: ss.color, fontWeight: 600 }}>
                                {he ? ss.labelHe : ss.label}
                              </span>
                              {p.renewalDaysUntil !== null && (
                                <span style={{ color: '#737373', marginInlineStart: 6 }}>
                                  ({p.renewalDaysUntil < 0
                                    ? (he ? `${Math.abs(p.renewalDaysUntil)} ימים באיחור` : `${Math.abs(p.renewalDaysUntil)}d ago`)
                                    : (he ? `בעוד ${p.renewalDaysUntil}` : `${p.renewalDaysUntil}d`)})
                                </span>
                              )}
                            </Td>
                            <Td>
                              {p.documentPresent
                                ? <span style={{ color: '#16A34A' }}>✓</span>
                                : <span style={{ color: '#DC2626' }}>{he ? 'חסר' : 'missing'}</span>}
                            </Td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Coverage areas — honest tracked / not-tracked */}
              <h3 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 10px' }}>
                {he ? 'תחומי כיסוי' : 'Coverage areas'}
              </h3>
              <div style={{ display: 'grid', gap: 10 }}>
                {insuranceQ.data.coverageAreas.map((c, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 12,
                      background: c.tracked ? '#F0FDF4' : '#FAFAFA',
                      border: `1px solid ${c.tracked ? '#16A34A' : '#D4D4D4'}`,
                    }}
                  >
                    <div style={{ flexShrink: 0, marginTop: 1 }}>
                      {c.tracked
                        ? <ShieldCheck size={18} style={{ color: '#16A34A' }} />
                        : <AlertTriangle size={18} style={{ color: '#A3A3A3' }} />}
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>
                        {c.area}{' '}
                        <span style={{ fontSize: 11, fontWeight: 700, color: c.tracked ? '#16A34A' : '#737373' }}>
                          {c.tracked
                            ? (he ? '• במעקב' : '• tracked')
                            : (he ? '• לא במעקב' : '• not tracked')}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: '#525252', marginTop: 3, lineHeight: 1.5 }}>{c.note}</div>
                    </div>
                  </div>
                ))}
              </div>

              {insuranceQ.data.sources?.some(s => !s.ok) && (
                <SourceErrors sources={insuranceQ.data.sources} he={he} />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// ---- small presentational helpers ------------------------------------------

function SectionTitle({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 14, borderBottom: `2px solid ${GOLD}`, paddingBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {icon}
        <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{title}</h2>
      </div>
      {subtitle && <div style={{ fontSize: 13, color: '#737373', marginTop: 4 }}>{subtitle}</div>}
    </div>
  );
}

function SummaryChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ border: '1px solid #E5E5E5', borderRadius: 12, padding: '10px 14px', minWidth: 96 }}>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: '#737373' }}>{label}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: '10px 12px', fontWeight: 600, color: '#404040', fontSize: 12, whiteSpace: 'nowrap' }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '10px 12px', color: '#171717', verticalAlign: 'top' }}>{children}</td>;
}

function LoadingRow({ he }: { he: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#737373', padding: '16px 0' }}>
      <Loader2 size={16} className="animate-spin" />
      <span style={{ fontSize: 14 }}>{he ? 'טוען…' : 'Loading…'}</span>
    </div>
  );
}
function ErrorRow({ he }: { he: boolean }) {
  return (
    <div style={{ background: '#FEF2F2', border: '1px solid #DC2626', borderRadius: 12, padding: '12px 14px', color: '#991B1B', fontSize: 14 }}>
      {he ? 'טעינת הנתונים נכשלה. נסה לרענן.' : 'Failed to load data. Try refreshing.'}
    </div>
  );
}
function EmptyRow({ text }: { text: string }) {
  return (
    <div style={{ background: '#FAFAFA', border: '1px dashed #D4D4D4', borderRadius: 12, padding: '18px 14px', color: '#737373', fontSize: 14, textAlign: 'center' }}>
      {text}
    </div>
  );
}

function NotTrackedBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{ marginTop: 16, background: '#FAFAFA', border: '1px dashed #D4D4D4', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600, fontSize: 13, color: '#525252' }}>
        <FileText size={15} /> {title}
      </div>
      <ul style={{ margin: '8px 0 0', paddingInlineStart: 22, color: '#737373', fontSize: 13, lineHeight: 1.6 }}>
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

function SourceErrors({ sources, he }: { sources: Array<{ source: string; ok: boolean; reason?: string }>; he: boolean }) {
  const failed = sources.filter(s => !s.ok);
  if (!failed.length) return null;
  return (
    <div style={{ marginTop: 14, background: '#FFF7ED', border: '1px solid #EA580C', borderRadius: 12, padding: '10px 14px', fontSize: 12.5, color: '#9A3412' }}>
      {he ? 'מקורות שלא נטענו: ' : 'Sources that failed to load: '}
      {failed.map(f => `${f.source}${f.reason ? ` (${f.reason})` : ''}`).join('; ')}
    </div>
  );
}
