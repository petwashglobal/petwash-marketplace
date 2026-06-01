import { type ChangeEvent, type FormEvent, useMemo, useState } from 'react';
import { Link } from 'wouter';
import {
  ArrowRight,
  BadgeCheck,
  BriefcaseBusiness,
  CheckCircle2,
  Clock,
  Crown,
  Mail,
  Phone,
  ShieldCheck,
  UserRound,
  Wallet,
} from 'lucide-react';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';

type Audience = 'member' | 'gift' | 'k9000' | 'provider';

const audienceOptions: Array<{ value: Audience; en: string; he: string }> = [
  { value: 'member', en: 'Prestige membership', he: 'חברות Prestige' },
  { value: 'gift', en: 'Digital gifts / eGift', he: 'מתנות דיגיטליות / eGift' },
  { value: 'k9000', en: 'K9000 station access', he: 'גישה לעמדות K9000' },
  { value: 'provider', en: 'Provider application', he: 'בקשת ספק שירות' },
];

const controlPoints = [
  {
    icon: UserRound,
    en: 'Adults 18+ only. This form records interest; it does not approve membership.',
    he: 'למבוגרים 18+ בלבד. הטופס רושם עניין; הוא לא מאשר חברות.',
  },
  {
    icon: BadgeCheck,
    en: 'Approved members verify mobile and email before any Wallet pass is activated.',
    he: 'חברים מאושרים מאמתים מובייל ואימייל לפני הפעלת כרטיס Wallet.',
  },
  {
    icon: ShieldCheck,
    en: 'Public pages show only approved legal and protection wording, never private company costs.',
    he: 'עמודים ציבוריים מציגים רק נוסח משפטי/הגנה מאושר, בלי עלויות פנימיות של החברה.',
  },
  {
    icon: BriefcaseBusiness,
    en: 'Providers continue to full onboarding with photo, rates, documents and compliance review.',
    he: 'ספקי שירות ממשיכים לאונבורדינג מלא עם תמונה, תעריפים, מסמכים ובדיקת ציות.',
  },
];

export default function PrestigeInterestWaitlist() {
  const { language: appLang } = useLanguage();
  const isHebrew = appLang === 'he' || appLang === 'ar';
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [leadId, setLeadId] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    city: '',
    country: 'Israel',
    petName: '',
    audience: 'member' as Audience,
    notes: '',
    over18: false,
    verifyLater: false,
    publicOnly: false,
  });

  const selectedAudience = useMemo(
    () => audienceOptions.find((option) => option.value === form.audience) ?? audienceOptions[0],
    [form.audience],
  );

  const setText =
    (key: keyof typeof form) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = event.target.value;
      setForm((current) => ({ ...current, [key]: value }));
    };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.over18 || !form.verifyLater || !form.publicOnly) {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'נדרש אישור' : 'Confirmation required',
        description: isHebrew
          ? 'יש לאשר גיל 18+, אימות עתידי ושמירה על מידע פרטי.'
          : 'Please confirm 18+, future verification and private-information handling.',
      });
      return;
    }

    setLoading(true);
    try {
      const description = [
        'PetWash Prestige 18+ interest application.',
        `Audience: ${selectedAudience.en}`,
        `Pet name: ${form.petName || 'not provided'}`,
        `Notes: ${form.notes || 'none'}`,
        'Applicant confirmed: over 18, understands verification/approval is required, and no Wallet pass is issued by this form.',
      ].join('\n');

      const response = await apiRequest('POST', '/api/global-forms/sales-lead', {
        contactName: form.fullName,
        company: form.audience === 'provider' ? 'Provider applicant' : '',
        email: form.email,
        phone: form.phone,
        city: form.city,
        country: form.country,
        inquiryType: 'Prestige 18+ interest',
        serviceInterest: selectedAudience.en,
        numberOfPets: form.petName ? '1+' : '',
        estimatedVolume: '',
        referralSource: 'Prestige interest page',
        description,
      });
      const result = await response.json().catch(() => ({}));
      setLeadId(result.leadId || 'PRESTIGE-INTEREST');
      toast({
        title: isHebrew ? 'הבקשה נקלטה' : 'Interest received',
        description: isHebrew
          ? 'השלב הבא הוא אימות מובייל ואימייל לפני אישור חברות.'
          : 'Next step is mobile and email verification before membership approval.',
      });
    } catch (error) {
      toast({
        variant: 'destructive',
        title: isHebrew ? 'לא ניתן לשלוח כרגע' : 'Unable to submit right now',
        description: isHebrew
          ? 'הטופס לא יוצר אישור מזויף. נסה שוב או צור חשבון מאומת.'
          : 'This form will not create fake approval. Try again or create a verified account.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout language={appLang} onLanguageChange={() => {}}>
      <main className="min-h-screen bg-[#f8f7f3] text-[#111111]" dir={isHebrew ? 'rtl' : 'ltr'}>
        <section className="relative overflow-hidden border-b border-[#d8d1c0] bg-[radial-gradient(circle_at_20%_10%,rgba(184,154,77,0.16),transparent_34%),linear-gradient(135deg,#ffffff_0%,#f8f7f3_44%,#ece7dc_100%)]">
          <div className="mx-auto grid min-h-[72vh] max-w-7xl grid-cols-1 gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[0.92fr_1.08fr] lg:py-14">
            <div className="flex flex-col justify-between gap-8">
              <div>
                <div className="mb-8 inline-flex items-center gap-3 rounded-full border border-[#b89a4d]/35 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#7a642e] shadow-sm">
                  <Crown className="h-4 w-4" />
                  PetWash Prestige
                </div>
                <h1 className="max-w-2xl text-[clamp(2.25rem,6vw,5.6rem)] font-semibold leading-[0.9] tracking-[-0.04em] text-[#101010]">
                  {isHebrew ? 'בקשת עניין לחברות Prestige' : 'Prestige Interest Application'}
                </h1>
                <p className="mt-6 max-w-xl text-base leading-8 text-[#5f5a50] sm:text-lg">
                  {isHebrew
                    ? 'מסלול נקי למבוגרים 18+ בלבד: משאירים פרטים, מאמתים מובייל ואימייל, ורק אחרי אישור מופעלים חשבון, כרטיס Wallet והטבות.'
                    : 'A clean adult-only 18+ path: leave interest, verify mobile and email, then activate account, Wallet pass and benefits only after approval.'}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                {controlPoints.map((point) => {
                  const Icon = point.icon;
                  return (
                    <div key={point.en} className="rounded-2xl border border-[#ded6c6] bg-white/78 p-4 shadow-sm">
                      <Icon className="mb-3 h-5 w-5 text-[#8a7138]" />
                      <p className="text-sm leading-6 text-[#514d46]">{isHebrew ? point.he : point.en}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[28px] border border-[#c7b98c] bg-[#10100f] p-4 shadow-2xl shadow-[#1d1604]/20 sm:p-6">
              {leadId ? (
                <div className="flex min-h-[560px] flex-col justify-center rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,#111,#1b1914)] p-7 text-white">
                  <CheckCircle2 className="mb-5 h-14 w-14 text-[#b89a4d]" />
                  <h2 className="text-3xl font-semibold tracking-[-0.03em]">
                    {isHebrew ? 'הבקשה נשמרה לבדיקת צוות' : 'Saved for team review'}
                  </h2>
                  <p className="mt-4 text-sm leading-7 text-white/70">
                    {isHebrew
                      ? 'זה לא אישור חברות ולא הנפקת Wallet. השלב הבא הוא אימות פרטים ואישור לפי מדיניות Pet Wash Ltd.'
                      : 'This is not membership approval and not Wallet issuance. Next comes verification and approval under Pet Wash Ltd policy.'}
                  </p>
                  <p className="mt-5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-mono text-xs text-white/70">
                    {leadId}
                  </p>
                  <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                    <Link href="/signup?intent=prestige">
                      <Button className="h-12 rounded-xl bg-[#b89a4d] px-6 font-semibold text-black hover:bg-[#c7ae62]">
                        {isHebrew ? 'יצירת חשבון מאומת' : 'Create verified account'}
                      </Button>
                    </Link>
                    {form.audience === 'provider' && (
                      <Link href="/become-provider">
                        <Button className="h-12 rounded-xl border border-white/20 bg-white/10 px-6 font-semibold text-white hover:bg-white/20">
                          {isHebrew ? 'המשך לספקים' : 'Continue provider path'}
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                <form onSubmit={submit} className="rounded-[22px] border border-white/10 bg-[linear-gradient(145deg,#111,#1b1914)] p-5 text-white sm:p-7">
                  <div className="mb-6 flex items-start justify-between gap-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#b89a4d]">
                        {isHebrew ? 'רשימת עניין 18+' : '18+ interest list'}
                      </p>
                      <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
                        {isHebrew ? 'פרטים לאישור ראשוני' : 'Details for first review'}
                      </h2>
                    </div>
                    <Clock className="mt-1 h-5 w-5 text-white/45" />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2 sm:col-span-2">
                      <Label className="text-white">{isHebrew ? 'שם מלא' : 'Full name'}</Label>
                      <Input required value={form.fullName} onChange={setText('fullName')} className="h-12 rounded-xl border-white/12 bg-white text-black" />
                    </label>
                    <label className="space-y-2">
                      <Label className="flex items-center gap-2 text-white"><Mail className="h-4 w-4 text-[#b89a4d]" />{isHebrew ? 'אימייל' : 'Email'}</Label>
                      <Input required type="email" value={form.email} onChange={setText('email')} className="h-12 rounded-xl border-white/12 bg-white text-black" />
                    </label>
                    <label className="space-y-2">
                      <Label className="flex items-center gap-2 text-white"><Phone className="h-4 w-4 text-[#b89a4d]" />{isHebrew ? 'מובייל' : 'Mobile'}</Label>
                      <Input required inputMode="tel" value={form.phone} onChange={setText('phone')} placeholder="+972 50 000 0000" className="h-12 rounded-xl border-white/12 bg-white text-black" />
                    </label>
                    <label className="space-y-2">
                      <Label className="text-white">{isHebrew ? 'עיר' : 'City'}</Label>
                      <Input required value={form.city} onChange={setText('city')} placeholder={isHebrew ? 'תל אביב' : 'Tel Aviv'} className="h-12 rounded-xl border-white/12 bg-white text-black" />
                    </label>
                    <label className="space-y-2">
                      <Label className="text-white">{isHebrew ? 'מדינה' : 'Country'}</Label>
                      <Input required value={form.country} onChange={setText('country')} className="h-12 rounded-xl border-white/12 bg-white text-black" />
                    </label>
                    <label className="space-y-2">
                      <Label className="text-white">{isHebrew ? 'שם חיית מחמד (אופציונלי)' : 'Pet name (optional)'}</Label>
                      <Input value={form.petName} onChange={setText('petName')} className="h-12 rounded-xl border-white/12 bg-white text-black" />
                    </label>
                    <label className="space-y-2">
                      <Label className="text-white">{isHebrew ? 'מה מעניין אותך?' : 'What interests you?'}</Label>
                      <select
                        value={form.audience}
                        onChange={setText('audience')}
                        className="h-12 w-full rounded-xl border border-white/12 bg-white px-3 text-sm text-black"
                      >
                        {audienceOptions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {isHebrew ? option.he : option.en}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-2 sm:col-span-2">
                      <Label className="text-white">{isHebrew ? 'הערה קצרה' : 'Short note'}</Label>
                      <Textarea value={form.notes} onChange={setText('notes')} rows={4} className="rounded-xl border-white/12 bg-white text-black" />
                    </label>
                  </div>

                  <div className="mt-6 space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
                    {[
                      ['over18', isHebrew ? 'אני מאשר/ת שאני מעל גיל 18.' : 'I confirm I am over 18 years old.'],
                      ['verifyLater', isHebrew ? 'אני מבין/ה שחברות ו-Wallet דורשים אימות ואישור.' : 'I understand membership and Wallet require verification and approval.'],
                      ['publicOnly', isHebrew ? 'אני מבין/ה שלא יפורסם מידע פרטי, עלויות ביטוח או מסמכי חברה.' : 'I understand private details, insurance costs and company documents are not public.'],
                    ].map(([key, text]) => (
                      <label key={key} className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-white/78">
                        <Checkbox
                          checked={Boolean(form[key as 'over18' | 'verifyLater' | 'publicOnly'])}
                          onCheckedChange={(checked) => setForm((current) => ({ ...current, [key]: checked === true }))}
                          className="mt-1 border-white/30 data-[state=checked]:bg-[#b89a4d] data-[state=checked]:text-black"
                        />
                        <span>{text}</span>
                      </label>
                    ))}
                  </div>

                  <Button type="submit" disabled={loading} className="mt-6 h-14 w-full rounded-xl bg-[#b89a4d] text-base font-semibold text-black hover:bg-[#c7ae62]">
                    {loading ? (isHebrew ? 'שולח...' : 'Submitting...') : (isHebrew ? 'שליחת בקשת עניין' : 'Submit interest')}
                    {!loading && <ArrowRight className={`ms-2 h-4 w-4 ${isHebrew ? 'rotate-180' : ''}`} />}
                  </Button>

                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/45">
                    <span className="inline-flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-[#b89a4d]" />{isHebrew ? 'אימות לפני אישור' : 'Verify before approval'}</span>
                    <span className="inline-flex items-center gap-2"><Wallet className="h-3.5 w-3.5 text-[#b89a4d]" />{isHebrew ? 'אין Wallet מזויף' : 'No fake Wallet pass'}</span>
                  </div>
                </form>
              )}
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-4 px-5 py-8 sm:px-8 lg:grid-cols-3">
          <div className="rounded-2xl border border-[#ddd4c1] bg-white p-5">
            <h3 className="text-lg font-semibold">{isHebrew ? 'חברי Prestige' : 'Prestige members'}</h3>
            <p className="mt-2 text-sm leading-6 text-[#635d54]">
              {isHebrew
                ? 'משתמשים מאושרים ממשיכים לאימות מובייל/אימייל ואז למסך החברות, ההטבות וה-Wallet.'
                : 'Approved users continue to mobile/email verification, then membership, benefits and Wallet screens.'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#ddd4c1] bg-white p-5">
            <h3 className="text-lg font-semibold">{isHebrew ? 'ספקי שירות' : 'Providers'}</h3>
            <p className="mt-2 text-sm leading-6 text-[#635d54]">
              {isHebrew
                ? 'ספקים לא מאושרים אוטומטית. יש מסלול נפרד לתמונה, תעריפים, כתובת, מסמכים, בנק, ביטוח ובדיקת ציות.'
                : 'Providers are not auto-approved. They use a separate path for photo, rates, address, documents, bank, insurance and compliance review.'}
            </p>
          </div>
          <div className="rounded-2xl border border-[#ddd4c1] bg-white p-5">
            <h3 className="text-lg font-semibold">{isHebrew ? 'מידע ציבורי בלבד' : 'Public-safe wording only'}</h3>
            <p className="mt-2 text-sm leading-6 text-[#635d54]">
              {isHebrew
                ? 'נוסח ביטוח/הגנה יוצג רק לאחר אישור. אין באתר פרמיות, עלויות, פוליסות פנימיות או מידע סודי של Pet Wash Ltd.'
                : 'Insurance/protection wording appears only after approval. The site does not expose premiums, costs, internal policies or Pet Wash Ltd confidential information.'}
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}
