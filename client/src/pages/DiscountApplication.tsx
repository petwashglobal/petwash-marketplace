/**
 * DiscountApplication — senior (65+) / disability wash-discount application.
 *
 * OPTIONAL, manually-reviewed flow (CEO FINAL CORRECTION 2026-06-25):
 *   member applies → support@petwash.co.il reviews → on approval the discount
 *   activates. Max 10%, K9000 washes ONLY. The ID/passport number is sent
 *   encrypted to the server and is never shown back to the member.
 *
 * Brand: pure white + black + metallic gold (#D4AF37) accents. Bilingual He/En.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { useLanguage } from '@/lib/languageStore';
import { Layout } from '@/components/Layout';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';
import { BadgeCheck, Shield, ChevronLeft, Clock, XCircle, Info } from 'lucide-react';

const gold = '#8A6A1B';
const cardBorder = '1px solid rgba(217, 184, 76, 0.25)';
const cardShadow = '0 2px 16px rgba(0,0,0,0.07)';

type DiscountType = 'senior' | 'disability';

interface ApplicationRow {
  id: number;
  discountType: DiscountType;
  status: string;
  approvedPercent: number | null;
  reviewNote: string | null;
  submittedAt: string | null;
}

const STATUS_LABELS: Record<string, { en: string; he: string; tone: 'pending' | 'good' | 'bad' }> = {
  pending_review:  { en: 'Pending review',   he: 'בבדיקה', tone: 'pending' },
  submitted:       { en: 'Submitted',        he: 'נשלח', tone: 'pending' },
  needs_more_info: { en: 'More info needed',  he: 'נדרש מידע נוסף', tone: 'pending' },
  approved:        { en: 'Approved',          he: 'אושר', tone: 'good' },
  rejected:        { en: 'Not approved',      he: 'לא אושר', tone: 'bad' },
  suspended:       { en: 'Suspended',         he: 'הושעה', tone: 'bad' },
  expired:         { en: 'Expired',           he: 'פג תוקף', tone: 'bad' },
};

export default function DiscountApplication() {
  const { user } = useFirebaseAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const qc = useQueryClient();
  const he = language === 'he';

  const [discountType, setDiscountType] = useState<DiscountType>('senior');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [idType, setIdType] = useState<'national_id' | 'passport'>('national_id');
  const [idNumber, setIdNumber] = useState('');
  const [idCountry, setIdCountry] = useState('Israel');
  const [idIssueDate, setIdIssueDate] = useState('');
  const [disabilityRef, setDisabilityRef] = useState('');
  const [issuingAuthority, setIssuingAuthority] = useState('');
  const [declarationAccepted, setDeclarationAccepted] = useState(false);

  const { data, isLoading } = useQuery<{ ok: boolean; applications: ApplicationRow[] }>({
    queryKey: ['/api/member/wash-discount/application'],
    enabled: !!user,
  });
  const latest = data?.applications?.[0] || null;
  const hasOpen = latest && ['pending_review', 'submitted', 'needs_more_info', 'approved'].includes(latest.status);

  const submit = useMutation({
    mutationFn: () =>
      apiRequest('POST', '/api/member/wash-discount/apply', {
        discountType,
        dateOfBirth,
        idType,
        idNumber,
        idCountry,
        idIssueDate: idIssueDate || undefined,
        disabilityRef: discountType === 'disability' && disabilityRef ? disabilityRef : undefined,
        issuingAuthority: discountType === 'disability' && issuingAuthority ? issuingAuthority : undefined,
        declarationAccepted: true,
      }).then((r) => r.json()),
    onSuccess: (res: any) => {
      if (res?.ok) {
        toast({ title: he ? 'הבקשה נשלחה' : 'Application submitted', description: he ? 'נבדוק את בקשתך ונעדכן אותך' : 'We will review your application and update you' });
        qc.invalidateQueries({ queryKey: ['/api/member/wash-discount/application'] });
      } else {
        const map: Record<string, string> = {
          senior_requires_age_65_plus: he ? 'הנחת אזרח ותיק מיועדת לגיל 65 ומעלה' : 'Senior discount requires age 65+',
          already_approved: he ? 'כבר יש לך הנחה מאושרת' : 'You already have an approved discount',
        };
        toast({ title: he ? 'שגיאה' : 'Error', description: map[res?.error] || (he ? 'לא ניתן לשלוח' : 'Could not submit'), variant: 'destructive' });
      }
    },
    onError: () => toast({ title: he ? 'שגיאה' : 'Error', description: he ? 'לא ניתן לשלוח כעת' : 'Could not submit right now', variant: 'destructive' }),
  });

  const canSubmit =
    !!dateOfBirth && idNumber.trim().length >= 3 && idCountry.trim().length >= 2 && declarationAccepted && !submit.isPending;

  const labelCls = 'block text-[11px] tracking-[0.12em] uppercase font-medium mb-1.5';
  const inputCls = 'w-full rounded-xl px-3.5 py-2.5 text-sm bg-white outline-none focus:ring-2 focus:ring-[#D4AF37]/40';
  const inputStyle = { border: '1px solid rgba(0,0,0,0.12)', color: '#111' } as const;

  return (
    <Layout>
      <div className="min-h-screen bg-white">
        <div className="w-full max-w-md sm:max-w-lg mx-auto px-5 pt-5 pb-12" dir={he ? 'rtl' : 'ltr'}>
          <button onClick={() => setLocation('/dashboard')} className="flex items-center gap-1 text-xs mb-4" style={{ color: gold }}>
            <ChevronLeft className={`w-4 h-4 ${he ? 'rotate-180' : ''}`} />
            {he ? 'חזרה' : 'Back'}
          </button>

          <div className="flex flex-col items-center text-center mb-6">
            <div className="flex items-center justify-center rounded-full mb-3" style={{ width: 52, height: 52, background: 'rgba(212,175,55,0.12)' }}>
              <BadgeCheck className="w-6 h-6" style={{ color: '#D4AF37' }} />
            </div>
            <h1 className="text-2xl font-light" style={{ fontFamily: "'Playfair Display', Georgia, serif", color: '#111' }}>
              {he ? 'הנחת אזרח ותיק / נכות' : 'Senior / Accessibility Discount'}
            </h1>
            <p className="text-xs mt-2 max-w-[20rem]" style={{ color: '#666' }}>
              {he
                ? 'בקשה אופציונלית, נבדקת ידנית. עד 10% הנחה — לשטיפות K9000 בלבד. ההנחה מופעלת רק לאחר אישור.'
                : 'Optional, manually reviewed. Up to 10% off — K9000 washes only. The discount activates only after approval.'}
            </p>
          </div>

          {/* Existing application status */}
          {hasOpen && latest && (() => {
            const s = STATUS_LABELS[latest.status] || { en: latest.status, he: latest.status, tone: 'pending' as const };
            const Icon = s.tone === 'good' ? BadgeCheck : s.tone === 'bad' ? XCircle : Clock;
            const color = s.tone === 'good' ? '#15803d' : s.tone === 'bad' ? '#b91c1c' : gold;
            return (
              <div className="rounded-2xl p-5 mb-6" style={{ border: cardBorder, boxShadow: cardShadow }}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <p className="text-sm font-semibold" style={{ color: '#111' }}>
                    {he ? s.he : s.en}
                    {latest.status === 'approved' && latest.approvedPercent ? ` · ${latest.approvedPercent}%` : ''}
                  </p>
                </div>
                <p className="text-xs" style={{ color: '#666' }}>
                  {latest.discountType === 'senior' ? (he ? 'אזרח ותיק' : 'Senior') : (he ? 'נכות' : 'Disability')}
                  {latest.submittedAt ? ` · ${new Date(latest.submittedAt).toLocaleDateString(he ? 'he-IL' : 'en-IL')}` : ''}
                </p>
                {latest.status === 'needs_more_info' && latest.reviewNote && (
                  <p className="text-xs mt-2 p-2 rounded-lg" style={{ background: 'rgba(212,175,55,0.08)', color: '#7a5d12' }}>
                    {latest.reviewNote}
                  </p>
                )}
                {latest.status === 'approved' && (
                  <p className="text-[11px] mt-3 flex items-start gap-1.5" style={{ color: '#666' }}>
                    <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                    {he ? 'ההנחה תחול אוטומטית בשטיפות K9000 בלבד.' : 'The discount applies automatically — K9000 washes only.'}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Apply form — hidden while an application is open/approved */}
          {!isLoading && !hasOpen && (
            <form
              onSubmit={(e) => { e.preventDefault(); if (canSubmit) submit.mutate(); }}
              className="rounded-2xl p-5 space-y-4"
              style={{ border: cardBorder, boxShadow: cardShadow }}
            >
              {/* Type */}
              <div>
                <label className={labelCls} style={{ color: gold }}>{he ? 'סוג הנחה' : 'Discount type'}</label>
                <div className="grid grid-cols-2 gap-2">
                  {(['senior', 'disability'] as DiscountType[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDiscountType(t)}
                      className="py-2.5 rounded-xl text-sm font-medium transition-colors"
                      style={discountType === t
                        ? { background: '#111', color: '#fff' }
                        : { background: '#fff', color: '#111', border: '1px solid rgba(0,0,0,0.12)' }}
                    >
                      {t === 'senior' ? (he ? 'אזרח ותיק 65+' : 'Senior 65+') : (he ? 'נכות' : 'Disability')}
                    </button>
                  ))}
                </div>
              </div>

              {/* DOB */}
              <div>
                <label className={labelCls} style={{ color: gold }}>{he ? 'תאריך לידה' : 'Date of birth'}</label>
                <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} className={inputCls} style={inputStyle} required />
              </div>

              {/* ID type + number */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls} style={{ color: gold }}>{he ? 'סוג מסמך' : 'ID type'}</label>
                  <select value={idType} onChange={(e) => setIdType(e.target.value as any)} className={inputCls} style={inputStyle}>
                    <option value="national_id">{he ? 'תעודת זהות' : 'National ID'}</option>
                    <option value="passport">{he ? 'דרכון' : 'Passport'}</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} style={{ color: gold }}>{he ? 'מספר' : 'Number'}</label>
                  <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} className={inputCls} style={inputStyle} inputMode="numeric" autoComplete="off" required />
                </div>
              </div>

              {/* Country + issue date */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={labelCls} style={{ color: gold }}>{he ? 'מדינה' : 'Country'}</label>
                  <input value={idCountry} onChange={(e) => setIdCountry(e.target.value)} className={inputCls} style={inputStyle} required />
                </div>
                <div>
                  <label className={labelCls} style={{ color: gold }}>{he ? 'תאריך הנפקה' : 'Issue date'}</label>
                  <input type="date" value={idIssueDate} onChange={(e) => setIdIssueDate(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
              </div>

              {/* Disability-only */}
              {discountType === 'disability' && (
                <>
                  <div>
                    <label className={labelCls} style={{ color: gold }}>{he ? 'מספר תעודת נכות (אם יש)' : 'Disability certificate № (if any)'}</label>
                    <input value={disabilityRef} onChange={(e) => setDisabilityRef(e.target.value)} className={inputCls} style={inputStyle} autoComplete="off" />
                  </div>
                  <div>
                    <label className={labelCls} style={{ color: gold }}>{he ? 'רשות מנפיקה (אם יש)' : 'Issuing authority (if any)'}</label>
                    <input value={issuingAuthority} onChange={(e) => setIssuingAuthority(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </>
              )}

              {/* Privacy note */}
              <div className="flex items-start gap-2 text-[11px] p-2.5 rounded-xl" style={{ background: 'rgba(0,0,0,0.03)', color: '#555' }}>
                <Shield className="w-3.5 h-3.5 shrink-0 mt-px" style={{ color: gold }} />
                {he
                  ? 'מספר המסמך נשמר מוצפן ומשמש לבדיקה בלבד. לא נשלח גלוי באימייל.'
                  : 'Your document number is stored encrypted and used only for review. It is never sent in clear email.'}
              </div>

              {/* Declaration */}
              <label className="flex items-start gap-2.5 cursor-pointer">
                <input type="checkbox" checked={declarationAccepted} onChange={(e) => setDeclarationAccepted(e.target.checked)} className="mt-0.5 w-4 h-4 accent-[#D4AF37]" />
                <span className="text-xs" style={{ color: '#444' }}>
                  {he
                    ? 'אני מצהיר/ה שהפרטים נכונים ומדויקים, ומסכים/ה לבדיקת הבקשה על ידי PetWash.'
                    : 'I declare the information is true and accurate, and consent to PetWash reviewing this application.'}
                </span>
              </label>

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all"
                style={canSubmit
                  ? { background: 'linear-gradient(135deg, #D4AF37, #B8902F)', color: '#fff' }
                  : { background: 'rgba(0,0,0,0.08)', color: '#999', cursor: 'not-allowed' }}
              >
                {submit.isPending ? (he ? 'שולח…' : 'Submitting…') : (he ? 'שליחת בקשה' : 'Submit application')}
              </button>
            </form>
          )}
        </div>
      </div>
    </Layout>
  );
}
