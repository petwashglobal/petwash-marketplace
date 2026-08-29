/**
 * ChoosePath — the intent picker shown AFTER the base account is complete
 * (CEO 2026-08-01, revised 2026-08-26 role-model: Prestige is NOT a role).
 * Authentication first → missing base fields → THEN this:
 *
 *   What do you want to do?
 *     [ Pet Parent ]           → home (customer workspace; nothing more required)
 *     [ Become a Provider ]    → provider onboarding (KYC + approval)
 *
 * This is a light, ONE-TIME choice — never a blocking gate. "Pet Parent" is
 * the default; a member needs nothing beyond the base profile. Provider path
 * routes to the canonical /provider-onboarding (national ID, address, docs,
 * bank, agreement, approval) — that KYC is NEVER asked of a plain Pet Parent.
 *
 * The old "Both" tile was removed — becoming a provider ALREADY leaves the
 * Pet Parent workspace intact (additive multi-role model). "Both" mislead
 * as if two identities were being created. Same for the "· Prestige" suffix
 * on the pet-owner tile — Prestige is a badge that surfaces inside the Pet
 * Parent home, not an identity choice here.
 */
import { useLocation } from 'wouter';
import { PawPrint, Briefcase } from 'lucide-react';
import type { Language } from '@/lib/i18n';

interface ChoosePathProps {
  language: Language;
}

export default function ChoosePath({ language }: ChoosePathProps) {
  const [, navigate] = useLocation();
  const he = language === 'he';

  const options = [
    {
      key: 'pet_parent',
      icon: PawPrint,
      title: he ? 'המשך כהורה של חיה' : 'Continue as Pet Parent',
      desc: he
        ? 'הזמנת שירותים, ארנק, שוברי מתנה ותגמולים. הכול מוכן — אין צורך בעוד פרטים.'
        : 'Book services, wallet, gift cards and rewards. You’re all set — nothing more needed.',
      cta: he ? 'למסך הבית' : 'Go to home',
      onClick: () => navigate('/home'),
      primary: true,
      actionId: 'SWITCH_TO_PET_PARENT',
    },
    {
      key: 'provider',
      icon: Briefcase,
      title: he ? 'הפוך/הפכי לספק/ית' : 'Become a Provider',
      desc: he
        ? 'פט-סיטר, הולכת כלבים או אקדמיה. נבקש מסמכי זיהוי, כתובת ופרטי תשלום — ולאחר אישור תוכל/י לקבל לקוחות. צד הלקוח שלך נשאר כמו שהוא.'
        : 'Pet sitter, dog walker or academy. We’ll ask for ID, address and payout details — after approval you can take clients. Your Pet Parent side stays intact.',
      cta: he ? 'התחל/י רישום ספק/ית' : 'Start provider signup',
      // CEO §1 route through the resume gate, not directly to onboarding.
      onClick: () => navigate('/become-provider'),
      primary: false,
      actionId: 'START_PROVIDER_APPLICATION',
    },
    // "Both" tile removed (CEO 2026-08-26 role-model): becoming a Provider
    // is already additive — the Pet Parent side is preserved automatically.
    // A separate "Both" tile framed it as a THIRD identity, which is the
    // exact anti-pattern the role-model directive banned.
  ];

  return (
    <div dir={he ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: '#0b0b0d', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <h1 style={{ fontSize: 'clamp(26px,4vw,36px)', fontWeight: 700, textAlign: 'center', margin: '0 0 6px' }}>
          {he ? 'מה תרצה/י לעשות?' : 'What do you want to do?'}
        </h1>
        <p style={{ textAlign: 'center', opacity: 0.7, margin: '0 0 28px', fontSize: 15 }}>
          {he ? 'החשבון שלך מוכן. אפשר לשנות זאת בכל עת.' : 'Your account is ready. You can change this anytime.'}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {options.map((o) => {
            const Icon = o.icon;
            return (
              <button key={o.key} type="button" onClick={o.onClick}
                data-testid={`choosepath-${o.key}`}
                data-action-id={o.actionId}
                style={{
                  display: 'flex', gap: 16, alignItems: 'flex-start', textAlign: he ? 'right' : 'left',
                  background: o.primary ? 'linear-gradient(135deg,#D4AF37,#b8912b)' : 'rgba(255,255,255,0.04)',
                  color: o.primary ? '#0b0b0d' : '#fff',
                  border: `1px solid ${o.primary ? 'transparent' : 'rgba(255,255,255,0.12)'}`,
                  borderRadius: 18, padding: '18px 20px', cursor: 'pointer', width: '100%',
                  flexDirection: he ? 'row-reverse' : 'row',
                }}>
                <span style={{ flex: '0 0 auto', width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: o.primary ? 'rgba(0,0,0,0.12)' : 'rgba(212,175,55,0.14)' }}>
                  <Icon size={24} color={o.primary ? '#0b0b0d' : '#D4AF37'} />
                </span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{o.title}</span>
                  <span style={{ display: 'block', fontSize: 13.5, opacity: o.primary ? 0.8 : 0.7, lineHeight: 1.45 }}>{o.desc}</span>
                  <span style={{ display: 'inline-block', marginTop: 10, fontSize: 13.5, fontWeight: 700, textDecoration: 'underline' }}>{o.cta} →</span>
                </span>
              </button>
            );
          })}
        </div>

        <button type="button" onClick={() => navigate('/home')}
          style={{ display: 'block', margin: '22px auto 0', background: 'none', border: 'none', color: 'inherit', opacity: 0.6, fontSize: 13.5, cursor: 'pointer', textDecoration: 'underline' }}>
          {he ? 'אחליט/ה מאוחר יותר' : 'I’ll decide later'}
        </button>
      </div>
    </div>
  );
}
