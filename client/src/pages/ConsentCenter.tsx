/**
 * ConsentCenter — view accepted consents + withdraw marketing consent (Phase 1).
 *
 * Essential consents (terms / privacy) are shown read-only. Marketing consent is
 * shown per channel (email / sms / push) and can be granted or WITHDRAWN
 * independently; each change is recorded server-side with evidence and clears the
 * canonical send-gate. GET/POST /api/consent-center.
 *
 * Routed at /consent-center. Luxury gold-on-dark, RTL-safe, bilingual.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, ShieldCheck, Mail, MessageSquare, Bell } from 'lucide-react';

interface ConsentEntry { consentType: string; version: string; accepted: boolean; at: string; method?: string; }
interface ConsentCenterData {
  essential: ConsentEntry[];
  marketing: {
    email: { consented: boolean; since: string | null };
    sms: { consented: boolean; since: string | null };
    push: { consented: boolean; since: string | null };
  };
}

const CONSENT_LABELS: Record<string, { en: string; he: string }> = {
  terms: { en: 'Terms of Service', he: 'תנאי שימוש' },
  privacy: { en: 'Privacy Policy', he: 'מדיניות פרטיות' },
  provider_terms: { en: 'Provider Terms', he: 'תנאי נותן שירות' },
  kyc: { en: 'Identity Verification', he: 'אימות זהות' },
  staff_policy: { en: 'Staff Policy', he: 'מדיניות צוות' },
};

export default function ConsentCenter() {
  const { language } = useLanguage();
  const he = language === 'he';
  const tr = (en: string, hv: string) => (he ? hv : en);
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<ConsentCenterData>({ queryKey: ['/api/consent-center'] });

  const change = useMutation({
    mutationFn: async ({ channel, granted }: { channel: string; granted: boolean }) => {
      const res = await apiRequest('/api/consent-center/marketing', 'POST', { channel, granted, locale: language });
      if (!res.ok) throw new Error('failed');
      return res.json();
    },
    onSuccess: (_d, vars) => {
      queryClient.invalidateQueries({ queryKey: ['/api/consent-center'] });
      toast({
        title: vars.granted ? tr('Marketing on', 'שיווק הופעל') : tr('Marketing stopped', 'שיווק הופסק'),
        description: vars.granted
          ? tr('You’ll receive offers on this channel.', 'תקבל/י הצעות בערוץ זה.')
          : tr('We’ll stop marketing on this channel.', 'נפסיק שיווק בערוץ זה.'),
      });
    },
    onError: () => toast({ title: tr('Could not update', 'עדכון נכשל'), variant: 'destructive' }),
  });

  const fmt = (d?: string | null) => {
    if (!d) return '';
    const dt = new Date(d);
    return isNaN(dt.getTime()) ? '' : dt.toLocaleDateString(he ? 'he-IL' : 'en-GB', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const MarketingRow = ({ channel, icon, label, consented, since }: {
    channel: string; icon: React.ReactNode; label: string; consented: boolean; since: string | null;
  }) => (
    <div className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 px-3 py-3">
      <span className="flex items-center gap-2.5">
        <span className="text-amber-300/70">{icon}</span>
        <span>
          <span className="block text-sm text-white">{label}</span>
          <span className="block text-[11px] text-gray-400">
            {consented ? (since ? tr(`On since ${fmt(since)}`, `פעיל מאז ${fmt(since)}`) : tr('On', 'פעיל')) : tr('Off', 'כבוי')}
          </span>
        </span>
      </span>
      <button
        type="button"
        onClick={() => change.mutate({ channel, granted: !consented })}
        disabled={change.isPending}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors disabled:opacity-60 ${consented ? 'bg-amber-400' : 'bg-gray-600'}`}
        aria-label={label}
      >
        <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${consented ? 'start-[22px]' : 'start-0.5'}`} />
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
                <ShieldCheck className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-[0.2em] font-semibold">{tr('Consent center', 'מרכז הסכמות')}</span>
              </div>
              <h1 className="text-xl font-semibold text-white">{tr('Your consents', 'ההסכמות שלך')}</h1>

              {isLoading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-amber-400" /></div>
              ) : (
                <>
                  {/* Essential — read only */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/70 font-semibold mb-2">{tr('Essential (required)', 'חיוני (נדרש)')}</p>
                    <div className="space-y-2">
                      {(data?.essential || []).length === 0 && (
                        <p className="text-xs text-gray-500">{tr('No records yet.', 'אין רשומות עדיין.')}</p>
                      )}
                      {(data?.essential || []).map((c) => (
                        <div key={c.consentType} className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/10 px-3 py-2.5">
                          <span className="text-sm text-white">{he ? (CONSENT_LABELS[c.consentType]?.he || c.consentType) : (CONSENT_LABELS[c.consentType]?.en || c.consentType)}</span>
                          <span className="text-[11px] text-emerald-400">{c.accepted ? tr('Accepted', 'התקבל') : tr('Withdrawn', 'בוטל')} · {fmt(c.at)}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">{tr('Essential consents are required to use PetWash and cannot be withdrawn here.', 'הסכמות חיוניות נדרשות לשימוש ב-PetWash ואינן ניתנות לביטול כאן.')}</p>
                  </div>

                  {/* Marketing — per channel, withdrawable */}
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-amber-300/70 font-semibold mb-2">{tr('Marketing (optional)', 'שיווק (אופציונלי)')}</p>
                    <div className="space-y-2">
                      <MarketingRow channel="email" icon={<Mail className="w-4 h-4" />} label={tr('Email offers', 'הצעות באימייל')} consented={!!data?.marketing.email.consented} since={data?.marketing.email.since || null} />
                      <MarketingRow channel="sms" icon={<MessageSquare className="w-4 h-4" />} label={tr('SMS offers', 'הצעות ב-SMS')} consented={!!data?.marketing.sms.consented} since={data?.marketing.sms.since || null} />
                      <MarketingRow channel="push" icon={<Bell className="w-4 h-4" />} label={tr('Push offers', 'הצעות בהתראות')} consented={!!data?.marketing.push.consented} since={data?.marketing.push.since || null} />
                    </div>
                    <p className="text-[10px] text-gray-500 mt-2">{tr('You can withdraw marketing consent at any time. Withdrawal is recorded.', 'ניתן לבטל הסכמה לשיווק בכל עת. הביטול מתועד.')}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
