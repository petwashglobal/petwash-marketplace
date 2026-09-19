/**
 * The 60-second provider application (2026-09-18).
 *
 * Production: 0 providers, 0 applications ever. Every join link led into the
 * three-step wizard — signup, ID, selfie — before anyone knew the applicant's
 * name. This screen asks six things and ends. Verification happens afterwards,
 * once a human has spoken to them.
 */
import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';
import { useLanguage } from '@/lib/languageStore';
import { useSEO, pageSEO } from '@/lib/seo';
import { executeTurnstileInvisible } from '@/components/TurnstileWidget';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CheckCircle2, Loader2 } from 'lucide-react';

const SERVICES = [
  { id: 'dog_walking', he: 'הולכת כלבים', en: 'Dog walking' },
  { id: 'pet_sitting', he: 'פט־סיטר / אירוח', en: 'Pet sitting' },
  { id: 'grooming',    he: 'טיפוח', en: 'Grooming' },
  { id: 'training',    he: 'אילוף', en: 'Training' },
  { id: 'transport',   he: 'הסעות', en: 'Transport' },
] as const;

export default function QuickApply() {
  useSEO(pageSEO.quickApply);
  const { language } = useLanguage();
  const isHe = language === 'he' || language === 'ar';
  const [form, setForm] = useState({ fullName: '', phone: '', email: '', city: '', about: '' });
  const [services, setServices] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<null | { alreadyApplied?: boolean }>(null);

  const submit = useMutation({
    mutationFn: async () => {
      // The server runs the bot check whenever TURNSTILE_SECRET_KEY is set —
      // which it is in production. Without a token every real application was
      // answered "Could not verify you are human" (caught live 2026-09-18,
      // before the page was announced to anyone). Invisible: the applicant
      // sees nothing unless Cloudflare decides to challenge.
      let turnstileToken = '';
      try {
        const r = await executeTurnstileInvisible('provider_quick_apply');
        turnstileToken = r.ok ? r.token : '';
      } catch {
        turnstileToken = '';
      }
      const r = await apiRequest('POST', '/api/provider-apply/apply', { ...form, services, turnstileToken });
      return r.json();
    },
    onSuccess: (body: any) => {
      if (body?.ok) { setDone({ alreadyApplied: body.alreadyApplied }); return; }
      setError(body?.error || (isHe ? 'משהו השתבש. נסו שוב.' : 'Something went wrong. Please try again.'));
    },
    onError: () => setError(isHe ? 'משהו השתבש. נסו שוב.' : 'Something went wrong. Please try again.'),
  });

  const t = {
    title: isHe ? 'להצטרף כנותן שירות' : 'Join as a provider',
    sub: isHe
      ? 'דקה אחת. משאירים פרטים — ואנחנו מתקשרים. אימות מסמכים רק אחרי שנדבר.'
      : 'One minute. Leave your details and we call you. Documents only after we talk.',
    name: isHe ? 'שם מלא' : 'Full name',
    phone: isHe ? 'טלפון' : 'Phone',
    email: isHe ? 'אימייל' : 'Email',
    city: isHe ? 'עיר' : 'City',
    services: isHe ? 'מה תרצו לתת?' : 'What do you offer?',
    about: isHe ? 'משהו עלייך (לא חובה)' : 'A little about you (optional)',
    send: isHe ? 'שליחה' : 'Send',
    sending: isHe ? 'שולח…' : 'Sending…',
    thanks: isHe ? 'תודה! נחזור אליכם בקרוב.' : 'Thank you! We will be in touch soon.',
    nextStep: isHe
      ? 'רוצים להתחיל לקבל הזמנות מהר יותר? השלימו עכשיו את הטופס המלא — זה מה שהופך אתכם לזמינים להזמנה.'
      : 'Want bookings sooner? Finish the full application now — that is what makes you bookable.',
    continueNow: isHe ? 'להשלמת הטופס המלא' : 'Complete the full application',
    already: isHe ? 'כבר קיבלנו את הפרטים שלכם — נחזור אליכם.' : 'We already have your details — we will be in touch.',
    full: isHe ? 'רוצים למלא את הטופס המלא עכשיו?' : 'Prefer the full application now?',
    pick: isHe ? 'בחרו לפחות שירות אחד' : 'Pick at least one service',
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" dir={isHe ? 'rtl' : 'ltr'}>
        <div className="text-center max-w-md">
          <CheckCircle2 className="w-14 h-14 mx-auto text-green-500 mb-4" />
          <h1 className="text-2xl font-semibold mb-2">{done.alreadyApplied ? t.already : t.thanks}</h1>
          {/* The 6 fields above make a CRM lead, not a bookable provider — only the
              full application does that. This screen used to offer nothing but
              "Home", so the warmest moment in the whole funnel (they just chose to
              apply) sent them away. Lead with the next step. */}
          <p className="text-sm text-gray-600 mb-5">{t.nextStep}</p>
          <Link
            href="/become-provider"
            className="inline-block w-full rounded-xl bg-black text-white py-3 font-medium mb-3"
            data-testid="link-quick-apply-continue"
          >
            {t.continueNow}
          </Link>
          <div>
            <Link href="/" className="underline text-sm text-gray-600">{isHe ? 'לדף הבית' : 'Home'}</Link>
          </div>
        </div>
      </div>
    );
  }

  const toggle = (id: string) =>
    setServices((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const ready = form.fullName.trim().length > 1 && form.phone.trim().length > 6
    && /\S+@\S+\.\S+/.test(form.email) && form.city.trim() && services.length > 0;

  return (
    <div className="min-h-screen bg-white px-5 py-10" dir={isHe ? 'rtl' : 'ltr'}>
      <div className="max-w-md mx-auto">
        <h1 className="text-3xl font-semibold mb-2">{t.title}</h1>
        <p className="text-gray-600 mb-6">{t.sub}</p>

        <label className="block mb-3">
          <span className="block text-sm mb-1">{t.name}</span>
          <Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} data-testid="input-name" />
        </label>
        <label className="block mb-3">
          <span className="block text-sm mb-1">{t.phone}</span>
          <Input value={form.phone} inputMode="tel" onChange={(e) => setForm({ ...form, phone: e.target.value })} data-testid="input-phone" />
        </label>
        <label className="block mb-3">
          <span className="block text-sm mb-1">{t.email}</span>
          <Input value={form.email} inputMode="email" onChange={(e) => setForm({ ...form, email: e.target.value })} data-testid="input-email" />
        </label>
        <label className="block mb-4">
          <span className="block text-sm mb-1">{t.city}</span>
          <Input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} data-testid="input-city" />
        </label>

        <div className="mb-4">
          <span className="block text-sm mb-2">{t.services}</span>
          <div className="flex flex-wrap gap-2">
            {SERVICES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggle(s.id)}
                data-testid={`chip-${s.id}`}
                className={`px-3 py-2 rounded-full border text-sm ${services.includes(s.id) ? 'bg-black text-white border-black' : 'bg-white text-gray-800 border-gray-300'}`}
              >
                {isHe ? s.he : s.en}
              </button>
            ))}
          </div>
        </div>

        <label className="block mb-5">
          <span className="block text-sm mb-1">{t.about}</span>
          <textarea
            className="w-full border rounded-md p-2 text-base"
            rows={3}
            value={form.about}
            onChange={(e) => setForm({ ...form, about: e.target.value })}
            data-testid="input-about"
          />
        </label>

        {error && <p className="text-sm text-red-600 mb-3" data-testid="text-apply-error">{error}</p>}

        <Button
          className="w-full h-12"
          disabled={!ready || submit.isPending}
          onClick={() => { setError(null); submit.mutate(); }}
          data-testid="button-submit-application"
        >
          {submit.isPending ? (<><Loader2 className="w-4 h-4 mr-2 animate-spin" />{t.sending}</>) : t.send}
        </Button>
        {!ready && services.length === 0 && <p className="text-xs text-gray-500 mt-2">{t.pick}</p>}

        <p className="text-sm text-gray-600 mt-6">
          {t.full}{' '}
          <Link href="/become-provider" className="underline">{isHe ? 'לטופס המלא' : 'Full application'}</Link>
        </p>
      </div>
    </div>
  );
}
