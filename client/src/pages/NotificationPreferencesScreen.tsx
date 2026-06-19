/**
 * NotificationPreferencesScreen — channel & topic toggles (Phase 1).
 *
 * - Essential (security / payment, booking) is shown but cannot be fully
 *   disabled.
 * - Care notifications (care push, pet birthday, passport expiry) are toggleable.
 * - Marketing (email / sms / push) routes through the same consent-evidence path
 *   as the Consent Center.
 * GET/PATCH /api/consent-center/notification-preferences.
 *
 * Routed at /notification-preferences. Luxury gold-on-dark, RTL-safe, bilingual.
 */
import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Bell, Save, Lock } from 'lucide-react';

interface Prefs {
  essential: { securityAndPayment: boolean; bookingTransactional: boolean };
  care: { push: boolean; petBirthday: boolean; passportExpiry: boolean };
  marketing: { email: boolean; sms: boolean; push: boolean };
}

export default function NotificationPreferencesScreen() {
  const { language } = useLanguage();
  const he = language === 'he';
  const tr = (en: string, hv: string) => (he ? hv : en);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<Prefs>({ queryKey: ['/api/consent-center/notification-preferences'] });

  const [care, setCare] = useState({ push: true, petBirthday: true, passportExpiry: true });
  const [marketing, setMarketing] = useState({ email: false, sms: false, push: false });
  useEffect(() => {
    if (data) {
      setCare({ push: data.care.push, petBirthday: data.care.petBirthday, passportExpiry: data.care.passportExpiry });
      setMarketing({ email: data.marketing.email, sms: data.marketing.sms, push: data.marketing.push });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('/api/consent-center/notification-preferences', 'PATCH', { care, marketing, locale: language });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/consent-center/notification-preferences'] });
      queryClient.invalidateQueries({ queryKey: ['/api/consent-center'] });
      toast({ title: tr('Saved', 'נשמר'), description: tr('Notification preferences updated.', 'העדפות ההתראות עודכנו.') });
    },
    onError: () => toast({ title: tr('Could not save', 'שמירה נכשלה'), variant: 'destructive' }),
  });

  const Toggle = ({ label, hint, value, onChange, disabled }: {
    label: string; hint?: string; value: boolean; onChange?: (v: boolean) => void; disabled?: boolean;
  }) => (
    <div className={`flex items-center justify-between rounded-xl border px-3 py-3 ${disabled ? 'bg-white/[0.02] border-white/5' : 'bg-white/[0.03] border-white/10'}`}>
      <span>
        <span className="flex items-center gap-1.5 text-sm text-white">{disabled && <Lock className="w-3 h-3 text-gray-500" />}{label}</span>
        {hint && <span className="block text-[11px] text-gray-400 mt-0.5">{hint}</span>}
      </span>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(!value)}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${disabled ? 'bg-gray-700 opacity-60 cursor-not-allowed' : value ? 'bg-amber-400' : 'bg-gray-600'}`}
        aria-label={label}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${value ? 'start-[22px]' : 'start-0.5'}`} />
      </button>
    </div>
  );

  return (
    <Layout>
      <div className="min-h-screen luxury-bg-mesh py-8 px-4" dir={he ? 'rtl' : 'ltr'}>
        <div className="max-w-md mx-auto">
          <button onClick={() => navigate('/my-account')} className="flex items-center gap-2 text-gray-400 hover:text-white mb-5 text-sm">
            <ArrowLeft className={`w-4 h-4 ${he ? 'scale-x-[-1]' : ''}`} />
            {tr('Back', 'חזרה')}
          </button>

          <div className="relative rounded-3xl p-[1.5px] bg-gradient-to-br from-amber-300 via-yellow-100 to-amber-500 shadow-2xl">
            <div className="rounded-3xl bg-gradient-to-b from-neutral-900 to-black px-6 py-6 space-y-5">
              <div className="flex items-center gap-2 text-amber-300/80">
                <Bell className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{tr('Notifications', 'התראות')}</span>
              </div>
              <h1 className="text-xl font-semibold text-white">{tr('Notification preferences', 'העדפות התראות')}</h1>

              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
              ) : (
                <>
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/70 font-semibold mb-2">{tr('Essential', 'חיוני')}</p>
                    <div className="space-y-2">
                      <Toggle label={tr('Security & payment', 'אבטחה ותשלום')} hint={tr('Always on — protects your account', 'תמיד פעיל — מגן על החשבון שלך')} value disabled />
                      <Toggle label={tr('Booking updates', 'עדכוני הזמנות')} hint={tr('Confirmations and status', 'אישורים וסטטוס')} value={data?.essential.bookingTransactional ?? true} disabled />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/70 font-semibold mb-2">{tr('Care', 'טיפוח')}</p>
                    <div className="space-y-2">
                      <Toggle label={tr('Care reminders', 'תזכורות טיפוח')} hint={tr('Next-wash and care nudges', 'תזכורות רחצה וטיפוח')} value={care.push} onChange={(v) => setCare((p) => ({ ...p, push: v }))} />
                      <Toggle label={tr('Pet birthday', 'יום הולדת לחיה')} value={care.petBirthday} onChange={(v) => setCare((p) => ({ ...p, petBirthday: v }))} />
                      <Toggle label={tr('Passport expiry', 'תפוגת דרכון')} hint={tr('When a document is about to expire', 'כשמסמך עומד לפוג')} value={care.passportExpiry} onChange={(v) => setCare((p) => ({ ...p, passportExpiry: v }))} />
                    </div>
                  </div>

                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/70 font-semibold mb-2">{tr('Marketing (optional)', 'שיווק (אופציונלי)')}</p>
                    <div className="space-y-2">
                      <Toggle label={tr('Email marketing', 'שיווק באימייל')} value={marketing.email} onChange={(v) => setMarketing((p) => ({ ...p, email: v }))} />
                      <Toggle label={tr('SMS marketing', 'שיווק ב-SMS')} value={marketing.sms} onChange={(v) => setMarketing((p) => ({ ...p, sms: v }))} />
                      <Toggle label={tr('Push marketing', 'שיווק בהתראות')} value={marketing.push} onChange={(v) => setMarketing((p) => ({ ...p, push: v }))} />
                    </div>
                  </div>

                  <button
                    onClick={() => save.mutate()}
                    disabled={save.isPending}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-300 to-amber-500 text-neutral-950 font-semibold py-3 disabled:opacity-60"
                  >
                    {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {tr('Save preferences', 'שמירת העדפות')}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
