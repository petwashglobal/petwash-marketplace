import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CheckCircle2,
  Lock,
  FileSignature,
  Loader2,
  ShieldCheck,
  Info,
  RefreshCw,
  Clock,
  FileText,
} from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { getAuth } from 'firebase/auth';

/** One required declaration as returned by GET /api/provider-declarations/status. */
interface DeclarationStatusItem {
  key: string;
  version: string;
  titleEn: string;
  titleHe: string;
  category: 'core' | 'service';
  signed: boolean;
  signedAt: string | null;
  signatureStatus: 'completed' | 'pending';
  reviewedByCounsel: boolean;
}

interface StatusResponse {
  required: DeclarationStatusItem[];
  allSigned: boolean;
  missing: string[];
  counselApprovedAll: boolean;
  signingConfigured: boolean;
}

interface DeclarationDetail {
  key: string;
  version: string;
  category: 'core' | 'service';
  titleEn: string;
  titleHe: string;
  bodyEn: string;
  bodyHe: string;
  reviewedByCounsel: boolean;
}

// Source legal-pack PDF backing each declaration (committed at
// client/public/documents/legal/legal-protection-pack-2026/). These are the CEO's
// DRAFT documents for Israeli-counsel review — shown as the source-of-truth document
// behind the on-screen declaration text. Only declarations with a real source PDF
// appear here; the rest have no standalone document.
const LEGAL_PACK_BASE = '/documents/legal/legal-protection-pack-2026';
const SOURCE_PDF: Record<string, string> = {
  provider_service_agreement: `${LEGAL_PACK_BASE}/02_provider_agreement_draft.pdf`,
  insurance_disclosure: `${LEGAL_PACK_BASE}/03_petwash_not_insurance_disclaimer.pdf`,
  home_hosting_protocol: `${LEGAL_PACK_BASE}/04_provider_host_premises_addendum.pdf`,
  owner_home_visit_protocol: `${LEGAL_PACK_BASE}/05_customer_premises_addendum.pdf`,
  privacy_data_handling: `${LEGAL_PACK_BASE}/06_privacy_policy_operational_draft.pdf`,
  tax_business_status: `${LEGAL_PACK_BASE}/09_provider_tax_insurance_declaration.pdf`,
  incident_reporting: `${LEGAL_PACK_BASE}/10_incident_claim_report_form.pdf`,
};

async function bearer(): Promise<string> {
  const user = getAuth().currentUser;
  if (!user) throw new Error('Not signed in');
  return user.getIdToken();
}

async function authedJson(url: string, init?: RequestInit) {
  const token = await bearer();
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err: any = new Error(body.error || `Request failed (${res.status})`);
    err.code = body.code;
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// Bilingual chrome strings. Declaration titles/bodies themselves come bilingual
// from the registry (titleHe/bodyHe), picked by the active language below.
const L = {
  he: {
    title: 'הצהרות ספק',
    subtitle: 'יש לחתום על ההצהרות הבאות לפני הפעלת חשבון הספק.',
    progress: (n: number, total: number) => `${n} מתוך ${total} נחתמו`,
    core: 'הצהרת ליבה',
    service: 'הצהרת שירות',
    signed: 'נחתם',
    readAndSign: 'קריאה וחתימה',
    pendingCounsel: 'בבדיקה משפטית',
    notAvailable: 'חתימה אינה זמינה עדיין',
    allSigned: 'כל ההצהרות נחתמו. תודה!',
    signNow: 'חתום עכשיו',
    close: 'סגירה',
    refresh: 'רענון',
    draftNotice: 'הנוסח המשפטי בבדיקה. לא ניתן לחתום על מסמך עד לאישור.',
    opened: 'חלון החתימה נפתח בכרטיסייה חדשה.',
    help: 'שאלות? ',
    viewSource: 'צפייה במסמך המקור (טיוטה)',
  },
  en: {
    title: 'Provider Declarations',
    subtitle: 'You must sign the declarations below before your provider account can go live.',
    progress: (n: number, total: number) => `${n} of ${total} signed`,
    core: 'Core declaration',
    service: 'Service declaration',
    signed: 'Signed',
    readAndSign: 'Read & sign',
    pendingCounsel: 'Pending legal review',
    notAvailable: 'Signing not available yet',
    allSigned: 'All declarations signed. Thank you!',
    signNow: 'Sign now',
    close: 'Close',
    refresh: 'Refresh',
    draftNotice: 'This wording is under legal review. It cannot be signed until approved.',
    opened: 'The signing window opened in a new tab.',
    help: 'Questions? ',
    viewSource: 'View source document (draft)',
  },
};

export default function ProviderDeclarations() {
  const { toast } = useToast();
  const { language } = useLanguage();
  const isRtl = language === 'he';
  const t = isRtl ? L.he : L.en;
  const pickTitle = (d: { titleEn: string; titleHe: string }) => (isRtl ? d.titleHe : d.titleEn);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [signerName, setSignerName] = useState('');

  const { data, isLoading, error, refetch, isFetching } = useQuery<StatusResponse>({
    queryKey: ['/api/provider-declarations/status'],
    queryFn: () => authedJson('/api/provider-declarations/status'),
    refetchInterval: 30000,
  });

  const { data: detail, isLoading: detailLoading } = useQuery<{ declaration: DeclarationDetail }>({
    queryKey: ['/api/provider-declarations', openKey],
    queryFn: () => authedJson(`/api/provider-declarations/${openKey}`),
    enabled: !!openKey,
  });

  const signMutation = useMutation({
    // FREE in-app attestation path (2026-07-31): records a completed, hash-sealed
    // signature server-side with NO DocuSeal template / API cost. Replaces the
    // /start (DocuSeal) path which needed templates that don't exist yet.
    mutationFn: (vars: { key: string; signerName: string }) =>
      authedJson(`/api/provider-declarations/${vars.key}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accepted: true, signerName: vars.signerName, language }),
      }),
    onSuccess: () => {
      setOpenKey(null);
      setSignerName('');
      toast({ title: language === 'he' ? 'נחתם בהצלחה ✓' : 'Signed ✓' });
      queryClient.invalidateQueries({ queryKey: ['/api/provider-declarations/status'] });
    },
    onError: (err: any) => {
      const msg =
        err?.code === 'PENDING_COUNSEL'
          ? t.draftNotice
          : err?.code === 'DOCUSEAL_NOT_CONFIGURED'
            ? t.notAvailable
            : err?.message || 'Failed';
      toast({ title: msg, variant: 'destructive' });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardContent className="pt-8 pb-8 text-center space-y-4">
            <Info className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">{(error as any)?.message || 'Could not load declarations.'}</p>
            <Button onClick={() => refetch()}>{t.refresh}</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const required = data.required;
  const signedCount = required.filter((d) => d.signed).length;
  const detailDoc = detail?.declaration;
  const detailSignable = !!detailDoc?.reviewedByCounsel && data.signingConfigured;

  return (
    <div dir={isRtl ? 'rtl' : 'ltr'} className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-3">
          <ShieldCheck className="h-7 w-7 text-[#D4AF37] shrink-0 mt-0.5" />
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{t.title}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t.subtitle}</p>
          </div>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-5 pb-5 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-slate-800">{t.progress(signedCount, required.length)}</span>
              <span className="text-muted-foreground" dir="ltr">{signedCount}/{required.length}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full bg-[#D4AF37] transition-[width] duration-300"
                style={{ width: `${required.length ? (signedCount / required.length) * 100 : 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        {/* All-signed banner */}
        {data.allSigned && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="pt-5 pb-5 flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
              <p className="font-semibold text-green-800">{t.allSigned}</p>
            </CardContent>
          </Card>
        )}

        {/* Declaration list */}
        <div className="space-y-3">
          {required.map((d) => {
            const locked = !d.reviewedByCounsel;
            const unavailable = !locked && !data.signingConfigured;
            const actionable = !d.signed && !locked && !unavailable;
            return (
              <Card key={`${d.key}:${d.version}`} className={d.signed ? 'border-green-200' : ''}>
                <CardContent className="py-4 flex items-center gap-3">
                  <div className="shrink-0">
                    {d.signed ? (
                      <CheckCircle2 className="h-5 w-5 text-green-600" />
                    ) : locked ? (
                      <Lock className="h-5 w-5 text-slate-400" />
                    ) : (
                      <FileSignature className="h-5 w-5 text-[#D4AF37]" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">{pickTitle(d)}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge
                        variant="outline"
                        className={`text-xs ${d.category === 'core' ? 'border-slate-300 text-slate-600' : 'border-[#D4AF37] text-[#B8932F]'}`}
                      >
                        {d.category === 'core' ? t.core : t.service}
                      </Badge>
                      {d.signed && d.signedAt && (
                        <span className="text-xs text-green-600">
                          {t.signed} · {new Date(d.signedAt).toLocaleDateString(isRtl ? 'he-IL' : 'en-GB')}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0">
                    {d.signed ? (
                      <span className="text-xs font-medium text-green-700 flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {t.signed}
                      </span>
                    ) : locked ? (
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5" /> {t.pendingCounsel}
                      </span>
                    ) : unavailable ? (
                      <span className="text-xs text-slate-400">{t.notAvailable}</span>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setOpenKey(d.key)} disabled={!actionable}>
                        {t.readAndSign}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Refresh */}
        <div className="flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 me-2 ${isFetching ? 'animate-spin' : ''}`} />
            {t.refresh}
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground pb-4">
          {t.help}
          <a href="mailto:support@petwash.co.il" className="underline hover:text-slate-800">support@petwash.co.il</a>
        </p>
      </div>

      {/* Read + sign dialog */}
      <Dialog open={!!openKey} onOpenChange={(o) => !o && setOpenKey(null)}>
        <DialogContent dir={isRtl ? 'rtl' : 'ltr'} className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detailLoading || !detailDoc ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-start">{pickTitle(detailDoc)}</DialogTitle>
              </DialogHeader>
              <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line text-start">
                {/* Hebrew shows the REAL English legal text when the Hebrew body is
                    still the translation placeholder — never a "pending" stub. */}
                {isRtl && detailDoc.bodyHe && !detailDoc.bodyHe.includes('ממתין') && !detailDoc.bodyHe.includes('טרם הושלם')
                  ? detailDoc.bodyHe
                  : detailDoc.bodyEn}
              </p>
              {SOURCE_PDF[detailDoc.key] && (
                <a
                  href={SOURCE_PDF[detailDoc.key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[#B8932F] hover:underline"
                >
                  <FileText className="h-3.5 w-3.5" />
                  {t.viewSource}
                </a>
              )}
              {!detailDoc.reviewedByCounsel && (
                <div className="text-xs text-[#B8932F] bg-[#FBF6E7] rounded p-3 flex items-start gap-2">
                  <Clock className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{t.draftNotice}</span>
                </div>
              )}
              {detailDoc.reviewedByCounsel && (
                <div className="pt-3">
                  <label className="text-xs font-medium text-slate-600">{isRtl ? 'שם מלא לחתימה' : 'Full legal name to sign'}</label>
                  <input
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    placeholder={isRtl ? 'הקלד/י את שמך המלא' : 'Type your full legal name'}
                    dir={isRtl ? 'rtl' : 'ltr'}
                    className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {isRtl
                      ? 'בהקלדת שמך ולחיצה על "חתום", את/ה מאשר/ת שקראת והסכמת להצהרה זו.'
                      : 'By typing your name and clicking Sign, you confirm you have read and agree to this declaration.'}
                  </p>
                </div>
              )}
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="ghost" onClick={() => setOpenKey(null)}>{t.close}</Button>
                <Button
                  className="bg-[#D4AF37] hover:bg-[#B8932F] text-white"
                  disabled={!detailSignable || signMutation.isPending || signerName.trim().length < 2}
                  onClick={() => signMutation.mutate({ key: detailDoc.key, signerName: signerName.trim() })}
                >
                  {signMutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
                  {t.signNow}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
