/**
 * Admin Provider Full Verification — אימות מלא של נותן שירות.
 *
 * Manual identity-verification cockpit. A PetWash admin matches a provider's
 * TYPED identity vs the OFFICIAL document vs the SELFIE vs the SIGNED contract,
 * records per-field verdicts, manages the official-document received/destroy
 * lifecycle, and clicks the final identity decision.
 *
 * READS   GET  /api/admin/provider-verification/:applicationId/checklist
 * PATCHES POST /api/admin/provider-verification/:applicationId/patch
 * DECIDES POST /api/admin/provider-verification/:applicationId/decision
 * DOC     POST /api/admin/provider-verification/:applicationId/document
 *         POST /api/admin/provider-verification/document/:docId/{received|destroyed|deleted|legal-hold}
 *
 * Identity approval = WAITLIST only. Booking & payout are SEPARATE approvals.
 * Hebrew-first, RTL, brand = white / black / metallic gold #D4AF37.
 */
import { useState } from 'react';
import { useParams } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  RefreshCw, Loader2, ShieldCheck, AlertTriangle, CheckCircle2, XCircle,
  HelpCircle, FileText, ScanLine, UserCheck, FileSignature, Trash2, Lock,
  PackageCheck, Flame, Ban,
} from 'lucide-react';

const GOLD = '#D4AF37';

type Verdict = 'pending' | 'match' | 'mismatch' | 'unclear';
type ReviewStatus = 'pending_review' | 'approved' | 'needs_more_info' | 'rejected';
type Decision = 'approved' | 'needs_more_info' | 'rejected';
type DocumentType = 'israeli_id' | 'passport' | 'driving_licence' | 'other';
type SubmissionMethod = 'upload' | 'post' | 'delivered' | 'third_party';

interface ChecklistItems {
  emailVerified: boolean;
  mobileVerified: boolean;
  age18Confirmed: boolean;
  idDetailsTyped: boolean;
  selfieReceived: boolean;
  selfieAutoMatched: boolean;
  officialDocumentReceived: boolean;
  contractSigned: boolean;
  nameMatch: Verdict;
  dobMatch: Verdict;
  documentNumberMatch: Verdict;
  selfiePhotoMatch: Verdict;
  contractNameMatch: Verdict;
}

interface DocumentInfo {
  status: string;
  submissionMethod: string;
  physicalReceived: boolean;
}

interface ChecklistResponse {
  applicationId: number | string;
  fullyVerified: boolean;
  reviewStatus: ReviewStatus;
  items: ChecklistItems;
  document: DocumentInfo | null;
  notes: string[];
  documentId?: number | string | null;
}

const VERDICT_HE: Record<Verdict, string> = {
  pending: 'ממתין',
  match: 'תואם',
  mismatch: 'לא תואם',
  unclear: 'לא ברור',
};

const STATUS_BANNER: Record<ReviewStatus, { label: string; bg: string; color: string; border: string }> = {
  pending_review: { label: 'ממתין לבדיקת PetWash', bg: 'rgba(245,158,11,0.12)', color: '#92600a', border: '#f59e0b' },
  needs_more_info: { label: 'נדרש מידע נוסף', bg: 'rgba(245,158,11,0.12)', color: '#92600a', border: '#f59e0b' },
  approved: { label: 'זהות אומתה', bg: 'rgba(16,185,129,0.12)', color: '#047857', border: '#10b981' },
  rejected: { label: 'נדחה', bg: 'rgba(239,68,68,0.12)', color: '#b91c1c', border: '#ef4444' },
};

const DOC_TYPE_HE: Record<DocumentType, string> = {
  israeli_id: 'תעודת זהות',
  passport: 'דרכון',
  driving_licence: 'רישיון נהיגה',
  other: 'אחר',
};

const METHOD_HE: Record<SubmissionMethod, string> = {
  upload: 'העלאה דיגיטלית',
  post: 'דואר',
  delivered: 'נמסר ידנית',
  third_party: 'צד שלישי',
};

const AUTO_ITEMS: { key: keyof ChecklistItems; label: string }[] = [
  { key: 'emailVerified', label: 'אימייל מאומת' },
  { key: 'mobileVerified', label: 'נייד מאומת' },
  { key: 'age18Confirmed', label: 'גיל 18+' },
  { key: 'idDetailsTyped', label: 'פרטי זהות הוקלדו' },
  { key: 'selfieReceived', label: 'סלפי התקבל' },
  { key: 'selfieAutoMatched', label: 'התאמת סלפי אוטומטית' },
  { key: 'officialDocumentReceived', label: 'מסמך רשמי התקבל' },
  { key: 'contractSigned', label: 'חוזה/הצהרה חתום' },
];

// Manual checks: each toggle is paired with a related verdict dropdown.
const MANUAL_CHECKS: {
  toggle: 'typedDetailsChecked' | 'selfieChecked' | 'officialDocumentChecked' | 'contractChecked';
  toggleLabel: string;
  icon: React.ReactNode;
  verdicts: { key: 'nameMatch' | 'dobMatch' | 'documentNumberMatch' | 'selfiePhotoMatch' | 'contractNameMatch'; label: string }[];
}[] = [
  {
    toggle: 'typedDetailsChecked',
    toggleLabel: 'בדקתי את הפרטים שהוקלדו מול המסמך הרשמי',
    icon: <FileText className="h-4 w-4" />,
    verdicts: [
      { key: 'nameMatch', label: 'התאמת שם' },
      { key: 'dobMatch', label: 'התאמת תאריך לידה' },
      { key: 'documentNumberMatch', label: 'התאמת מספר מסמך' },
    ],
  },
  {
    toggle: 'selfieChecked',
    toggleLabel: 'בדקתי את הסלפי מול תמונת המסמך',
    icon: <ScanLine className="h-4 w-4" />,
    verdicts: [
      { key: 'selfiePhotoMatch', label: 'התאמת תמונת סלפי' },
    ],
  },
  {
    toggle: 'officialDocumentChecked',
    toggleLabel: 'בדקתי את המסמך הרשמי',
    icon: <UserCheck className="h-4 w-4" />,
    verdicts: [],
  },
  {
    toggle: 'contractChecked',
    toggleLabel: 'בדקתי את החוזה/ההצהרה החתומים',
    icon: <FileSignature className="h-4 w-4" />,
    verdicts: [
      { key: 'contractNameMatch', label: 'התאמת שם בחוזה' },
    ],
  },
];

function AutoIcon({ value }: { value: boolean }) {
  return value
    ? <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: '#10b981' }} />
    : <XCircle className="h-5 w-5 shrink-0" style={{ color: '#dc2626' }} />;
}

function VerdictPill({ value }: { value: Verdict }) {
  const tone =
    value === 'match' ? { bg: 'rgba(16,185,129,0.12)', color: '#047857', border: '#10b981', icon: <CheckCircle2 className="h-3.5 w-3.5" /> }
      : value === 'mismatch' ? { bg: 'rgba(239,68,68,0.12)', color: '#b91c1c', border: '#ef4444', icon: <XCircle className="h-3.5 w-3.5" /> }
        : value === 'unclear' ? { bg: 'rgba(245,158,11,0.12)', color: '#92600a', border: '#f59e0b', icon: <HelpCircle className="h-3.5 w-3.5" /> }
          : { bg: '#f3f4f6', color: '#374151', border: '#d1d5db', icon: <HelpCircle className="h-3.5 w-3.5" /> };
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.border}` }}
    >
      {tone.icon}{VERDICT_HE[value]}
    </span>
  );
}

export default function AdminProviderVerification() {
  const params = useParams();
  const applicationId = params.id as string;
  const { toast } = useToast();

  const [notesDraft, setNotesDraft] = useState('');
  const [notesDirty, setNotesDirty] = useState(false);

  // Decision dialog state.
  const [pendingDecision, setPendingDecision] = useState<Decision | null>(null);
  const [decisionNotes, setDecisionNotes] = useState('');

  // Manual-check toggles are write-only /patch commands (the API has no
  // read-back field for them), so we mirror them in local session state.
  const [toggledChecks, setToggledChecks] = useState<Record<string, boolean>>({});

  // New-document form state.
  const [docType, setDocType] = useState<DocumentType>('israeli_id');
  const [docMethod, setDocMethod] = useState<SubmissionMethod>('upload');
  const [docPhysical, setDocPhysical] = useState(false);

  // Legal-hold dialog state.
  const [legalHoldOpen, setLegalHoldOpen] = useState(false);
  const [legalHoldReason, setLegalHoldReason] = useState('');

  const { data, isLoading, isError, refetch, isFetching } = useQuery<ChecklistResponse>({
    queryKey: ['/api/admin/provider-verification', applicationId, 'checklist'],
    queryFn: async () => {
      const res = await apiRequest('GET', `/api/admin/provider-verification/${encodeURIComponent(applicationId)}/checklist`);
      if (!res.ok) throw new Error('failed');
      const body = await res.json();
      if (typeof body?.notes !== 'undefined') setNotesDraft((body.notes || []).join('\n'));
      return body;
    },
  });

  const docId = (data as any)?.documentId ?? null;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['/api/admin/provider-verification', applicationId, 'checklist'] });
  }

  const patchMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest('POST', `/api/admin/provider-verification/${encodeURIComponent(applicationId)}/patch`, body);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || e?.error || 'הפעולה נכשלה');
      }
      return res.json();
    },
    onSuccess: () => { invalidate(); },
    onError: (e: any) => toast({ title: 'שגיאה', description: e?.message || 'הפעולה נכשלה', variant: 'destructive' }),
  });

  const decisionMutation = useMutation({
    mutationFn: async ({ decision, notes }: { decision: Decision; notes: string }) => {
      const res = await apiRequest('POST', `/api/admin/provider-verification/${encodeURIComponent(applicationId)}/decision`, { decision, notes });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || e?.error || 'הפעולה נכשלה');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'עודכן', description: 'החלטת הזהות נשמרה.' });
      invalidate();
      setPendingDecision(null);
      setDecisionNotes('');
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e?.message || 'הפעולה נכשלה', variant: 'destructive' }),
  });

  const createDocMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/admin/provider-verification/${encodeURIComponent(applicationId)}/document`, {
        documentType: docType,
        submissionMethod: docMethod,
        physicalReceived: docPhysical,
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || e?.error || 'הפעולה נכשלה');
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'נרשם', description: 'המסמך הרשמי נרשם במערכת.' });
      invalidate();
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e?.message || 'הפעולה נכשלה', variant: 'destructive' }),
  });

  const lifecycleMutation = useMutation({
    mutationFn: async ({ action, reason }: { action: 'received' | 'destroyed' | 'deleted' | 'legal-hold'; reason?: string }) => {
      if (docId == null) throw new Error('אין מזהה מסמך.');
      const body: Record<string, unknown> = { applicationId };
      if (action === 'legal-hold') body.reason = reason;
      const res = await apiRequest('POST', `/api/admin/provider-verification/document/${encodeURIComponent(String(docId))}/${action}`, body);
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e?.message || e?.error || 'הפעולה נכשלה');
      }
      return res.json().catch(() => ({}));
    },
    onSuccess: () => {
      toast({ title: 'עודכן', description: 'מחזור החיים של המסמך עודכן.' });
      invalidate();
      setLegalHoldOpen(false);
      setLegalHoldReason('');
    },
    onError: (e: any) => toast({ title: 'שגיאה', description: e?.message || 'הפעולה נכשלה', variant: 'destructive' }),
  });

  const items = data?.items;
  const busy = patchMutation.isPending || decisionMutation.isPending || createDocMutation.isPending || lifecycleMutation.isPending;

  function setVerdict(key: string, value: Verdict) {
    patchMutation.mutate({ [key]: value });
  }
  function setToggle(key: string, value: boolean) {
    setToggledChecks((prev) => ({ ...prev, [key]: value }));
    patchMutation.mutate({ [key]: value });
  }
  function saveNotes() {
    patchMutation.mutate({ notes: notesDraft });
    setNotesDirty(false);
  }

  const banner = data ? STATUS_BANNER[data.reviewStatus] : null;

  return (
    <div dir="rtl" className="min-h-screen bg-white text-black">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: 'rgba(212,175,55,0.12)', border: `1px solid ${GOLD}` }}>
              <ShieldCheck className="h-5 w-5" style={{ color: GOLD }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">אימות מלא — נותן שירות</h1>
              <p className="text-sm text-gray-600">מזהה בקשה: <span className="font-mono font-semibold text-black">{applicationId}</span></p>
            </div>
          </div>
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            רענן
          </Button>
        </div>

        {/* States */}
        {isLoading ? (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : isError || !data || !items ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-red-100 bg-red-50 py-16 text-center">
            <AlertTriangle className="h-8 w-8 text-red-400" />
            <p className="text-sm text-red-600">טעינת נתוני האימות נכשלה.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>נסה שוב</Button>
          </div>
        ) : (
          <>
            {/* Status banner */}
            {banner && (
              <div
                className="mb-5 flex items-center justify-between gap-3 rounded-lg px-4 py-3"
                style={{ background: banner.bg, border: `1px solid ${banner.border}` }}
              >
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5" style={{ color: banner.color }} />
                  <span className="text-base font-bold" style={{ color: banner.color }}>{banner.label}</span>
                </div>
                {data.fullyVerified && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-0.5 text-xs font-semibold" style={{ color: banner.color }}>
                    <CheckCircle2 className="h-3.5 w-3.5" /> אומת במלואו
                  </span>
                )}
              </div>
            )}

            {/* Checklist card — read-only auto items */}
            <section className="mb-5 rounded-lg border border-gray-200 p-4">
              <h2 className="mb-1 text-lg font-bold">רשימת בדיקה אוטומטית</h2>
              <p className="mb-4 text-sm text-gray-600">נתונים שהמערכת אספה — לקריאה בלבד.</p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {AUTO_ITEMS.map(({ key, label }) => {
                  const v = items[key] as boolean;
                  return (
                    <div key={key} className="flex items-center justify-between gap-3 rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2.5">
                      <span className="text-sm font-medium text-black">{label}</span>
                      <AutoIcon value={v} />
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Manual checks card — editable */}
            <section className="mb-5 rounded-lg border border-gray-200 p-4">
              <h2 className="mb-1 text-lg font-bold">בדיקות ידניות של PetWash</h2>
              <p className="mb-4 text-sm text-gray-600">סמן כל בדיקה שביצעת, וקבע פסיקת התאמה לכל שדה.</p>

              <div className="space-y-4">
                {MANUAL_CHECKS.map((block) => (
                  <div key={block.toggle} className="rounded-md border border-gray-100 p-3">
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={Boolean(toggledChecks[block.toggle])}
                        onChange={(e) => setToggle(block.toggle, e.target.checked)}
                        disabled={busy}
                        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-black"
                        style={{ accentColor: GOLD }}
                      />
                      <span className="flex items-center gap-2 text-sm font-semibold text-black">
                        <span style={{ color: GOLD }}>{block.icon}</span>
                        {block.toggleLabel}
                      </span>
                    </label>

                    {block.verdicts.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 pr-8">
                        {block.verdicts.map((vd) => (
                          <div key={vd.key}>
                            <div className="mb-1 flex items-center justify-between gap-2">
                              <label className="text-xs font-medium text-gray-700">{vd.label}</label>
                              <VerdictPill value={items[vd.key] as Verdict} />
                            </div>
                            <select
                              value={items[vd.key] as Verdict}
                              onChange={(e) => setVerdict(vd.key, e.target.value as Verdict)}
                              disabled={busy}
                              className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-black disabled:opacity-50"
                            >
                              {(['pending', 'match', 'mismatch', 'unclear'] as Verdict[]).map((opt) => (
                                <option key={opt} value={opt}>{VERDICT_HE[opt]}</option>
                              ))}
                            </select>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div className="mt-4">
                <label className="mb-1 block text-sm font-semibold text-black">הערות אימות</label>
                <Textarea
                  value={notesDraft}
                  onChange={(e) => { setNotesDraft(e.target.value); setNotesDirty(true); }}
                  placeholder="תיעוד ממצאים, אי-התאמות, נימוקים…"
                  rows={3}
                />
                <div className="mt-2 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={saveNotes}
                    disabled={busy || !notesDirty}
                    className="gap-2"
                  >
                    {patchMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    שמור הערות
                  </Button>
                </div>
              </div>
            </section>

            {/* Official document card */}
            <section className="mb-5 rounded-lg border border-gray-200 p-4">
              <h2 className="mb-1 text-lg font-bold">מסמך זהות רשמי</h2>
              <p className="mb-4 text-sm text-gray-600">ניהול מחזור החיים של המסמך הרשמי: קבלה ושמירה / השמדה.</p>

              {data.document ? (
                <div>
                  <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <div className="rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2">
                      <div className="text-xs text-gray-500">סטטוס</div>
                      <div className="text-sm font-semibold text-black">{data.document.status || '—'}</div>
                    </div>
                    <div className="rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2">
                      <div className="text-xs text-gray-500">אופן הגשה</div>
                      <div className="text-sm font-semibold text-black">
                        {METHOD_HE[data.document.submissionMethod as SubmissionMethod] || data.document.submissionMethod || '—'}
                      </div>
                    </div>
                    <div className="rounded-md border border-gray-100 bg-gray-50/60 px-3 py-2">
                      <div className="text-xs text-gray-500">עותק פיזי התקבל</div>
                      <div className="text-sm font-semibold text-black">{data.document.physicalReceived ? 'כן' : 'לא'}</div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <LifecycleBtn
                      label="סמן כהתקבל"
                      icon={<PackageCheck className="h-3.5 w-3.5" />}
                      disabled={busy || docId == null}
                      onClick={() => lifecycleMutation.mutate({ action: 'received' })}
                    />
                    <LifecycleBtn
                      label="סמן הושמד"
                      icon={<Flame className="h-3.5 w-3.5" />}
                      danger
                      disabled={busy || docId == null}
                      onClick={() => lifecycleMutation.mutate({ action: 'destroyed' })}
                    />
                    <LifecycleBtn
                      label="סמן נמחק"
                      icon={<Trash2 className="h-3.5 w-3.5" />}
                      danger
                      disabled={busy || docId == null}
                      onClick={() => lifecycleMutation.mutate({ action: 'deleted' })}
                    />
                    <LifecycleBtn
                      label="השהיה משפטית"
                      icon={<Lock className="h-3.5 w-3.5" />}
                      disabled={busy || docId == null}
                      onClick={() => { setLegalHoldReason(''); setLegalHoldOpen(true); }}
                    />
                  </div>
                  {docId == null && (
                    <p className="mt-2 text-xs text-amber-700">לא הוחזר מזהה מסמך — פעולות מחזור החיים מושבתות.</p>
                  )}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-gray-300 p-4">
                  <p className="mb-3 text-sm font-medium text-black">לא נרשם מסמך רשמי. רשום אחד:</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">סוג מסמך</label>
                      <select
                        value={docType}
                        onChange={(e) => setDocType(e.target.value as DocumentType)}
                        disabled={busy}
                        className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-black"
                      >
                        {(Object.keys(DOC_TYPE_HE) as DocumentType[]).map((t) => (
                          <option key={t} value={t}>{DOC_TYPE_HE[t]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-700">אופן הגשה</label>
                      <select
                        value={docMethod}
                        onChange={(e) => setDocMethod(e.target.value as SubmissionMethod)}
                        disabled={busy}
                        className="h-9 w-full rounded-md border border-gray-300 bg-white px-2 text-sm text-black"
                      >
                        {(Object.keys(METHOD_HE) as SubmissionMethod[]).map((m) => (
                          <option key={m} value={m}>{METHOD_HE[m]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex items-end">
                      <label className="flex cursor-pointer items-center gap-2 pb-1.5 text-sm font-medium text-black">
                        <input
                          type="checkbox"
                          checked={docPhysical}
                          onChange={(e) => setDocPhysical(e.target.checked)}
                          disabled={busy}
                          className="h-5 w-5 cursor-pointer"
                          style={{ accentColor: GOLD }}
                        />
                        עותק פיזי התקבל
                      </label>
                    </div>
                  </div>
                  <div className="mt-3 flex justify-end">
                    <Button
                      onClick={() => createDocMutation.mutate()}
                      disabled={busy}
                      className="gap-2"
                      style={{ background: GOLD, color: '#000' }}
                    >
                      {createDocMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                      רשום מסמך
                    </Button>
                  </div>
                </div>
              )}
            </section>

            {/* Decision footer */}
            <section className="mb-5 rounded-lg border-2 p-4" style={{ borderColor: GOLD }}>
              <h2 className="mb-1 text-lg font-bold">החלטת זהות סופית</h2>
              <p className="mb-4 text-sm text-gray-600">קבע את ההחלטה לאחר השלמת כל הבדיקות.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  className="flex-1 gap-2"
                  style={{ background: '#10b981', color: '#fff' }}
                  disabled={busy}
                  onClick={() => { setDecisionNotes(''); setPendingDecision('approved'); }}
                >
                  <CheckCircle2 className="h-4 w-4" /> אשר אימות זהות מלא
                </Button>
                <Button
                  className="flex-1 gap-2"
                  style={{ background: '#f59e0b', color: '#fff' }}
                  disabled={busy}
                  onClick={() => { setDecisionNotes(''); setPendingDecision('needs_more_info'); }}
                >
                  <HelpCircle className="h-4 w-4" /> בקש מידע נוסף
                </Button>
                <Button
                  className="flex-1 gap-2"
                  style={{ background: '#dc2626', color: '#fff' }}
                  disabled={busy}
                  onClick={() => { setDecisionNotes(''); setPendingDecision('rejected'); }}
                >
                  <Ban className="h-4 w-4" /> דחה זהות
                </Button>
              </div>

              {data.reviewStatus === 'approved' && (
                <div className="mt-4 flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  אישור זהות = WAITLIST בלבד. הזמנות ותשלום הם אישורים נפרדים.
                </div>
              )}
            </section>

            {/* Notes hints */}
            {data.notes && data.notes.length > 0 && (
              <div className="mb-8 space-y-1">
                {data.notes.map((n, i) => (
                  <p key={i} className="text-xs text-gray-600">• {n}</p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Decision confirm dialog */}
      <Dialog open={!!pendingDecision} onOpenChange={(o) => { if (!o) { setPendingDecision(null); setDecisionNotes(''); } }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">
              {pendingDecision === 'approved' ? 'אישור אימות זהות מלא'
                : pendingDecision === 'needs_more_info' ? 'בקשת מידע נוסף'
                  : 'דחיית זהות'}
            </DialogTitle>
            <DialogDescription className="text-right">
              {pendingDecision === 'approved'
                ? 'אישור זהות מעניק רשימת המתנה בלבד. הזמנות ותשלום מאושרים בנפרד.'
                : pendingDecision === 'rejected'
                  ? 'דחיית זהות דורשת נימוק.'
                  : 'ניתן לצרף הערה לנותן השירות.'}
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1 block text-sm font-medium text-black">
              הערה{pendingDecision === 'rejected' ? ' (חובה)' : ' (רשות)'}
            </label>
            <Textarea
              value={decisionNotes}
              onChange={(e) => setDecisionNotes(e.target.value)}
              placeholder={pendingDecision === 'rejected' ? 'נמק מדוע הזהות נדחתה…' : 'הערה…'}
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setPendingDecision(null); setDecisionNotes(''); }}>ביטול</Button>
            <Button
              onClick={() => pendingDecision && decisionMutation.mutate({ decision: pendingDecision, notes: decisionNotes })}
              disabled={decisionMutation.isPending || (pendingDecision === 'rejected' && decisionNotes.trim().length < 3)}
              style={pendingDecision === 'rejected'
                ? { background: '#dc2626', color: '#fff' }
                : pendingDecision === 'approved'
                  ? { background: '#10b981', color: '#fff' }
                  : { background: GOLD, color: '#000' }}
            >
              {decisionMutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
              אישור
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Legal-hold dialog */}
      <Dialog open={legalHoldOpen} onOpenChange={(o) => { if (!o) { setLegalHoldOpen(false); setLegalHoldReason(''); } }}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-right">השהיה משפטית של מסמך</DialogTitle>
            <DialogDescription className="text-right">
              השהיה משפטית מונעת מחיקה/השמדה של המסמך. נדרש נימוק.
            </DialogDescription>
          </DialogHeader>
          <div>
            <label className="mb-1 block text-sm font-medium text-black">סיבה (חובה)</label>
            <Textarea
              value={legalHoldReason}
              onChange={(e) => setLegalHoldReason(e.target.value)}
              placeholder="לדוגמה: חקירה משפטית פתוחה / דרישת רשות"
              rows={3}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => { setLegalHoldOpen(false); setLegalHoldReason(''); }}>ביטול</Button>
            <Button
              onClick={() => lifecycleMutation.mutate({ action: 'legal-hold', reason: legalHoldReason })}
              disabled={lifecycleMutation.isPending || legalHoldReason.trim().length < 3}
              style={{ background: GOLD, color: '#000' }}
            >
              {lifecycleMutation.isPending ? <Loader2 className="ml-2 h-4 w-4 animate-spin" /> : null}
              החל השהיה
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LifecycleBtn({
  label, icon, onClick, disabled, danger,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const style = danger
    ? { background: '#fff', color: '#b91c1c', borderColor: '#fca5a5' }
    : { background: '#fff', color: '#111', borderColor: '#e5e7eb' };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition hover:opacity-85 disabled:opacity-40"
      style={style}
    >
      {icon}{label}
    </button>
  );
}
