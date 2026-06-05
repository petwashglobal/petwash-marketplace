import { Link } from 'wouter';
import { Mail, ShieldCheck, Smartphone, UserRound, Clock3, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';
import { useLanguage } from '@/lib/languageStore';

const SUPPORT_EMAIL = 'Support@PetWash.co.il';

export default function AccountDeletionResource() {
  const { language, setLanguage } = useLanguage();
  const isHebrew = language === 'he';
  const dir = isHebrew ? 'rtl' : 'ltr';

  const copy = isHebrew
    ? {
        eyebrow: 'משאב מחיקת חשבון',
        title: 'מחיקת חשבון PetWash',
        updated: 'עודכן לאחרונה: 5 ביוני 2026',
        intro: 'אפשר לבקש מחיקת חשבון מתוך האפליקציה או מהאתר. אם אין לך גישה לחשבון, אפשר לשלוח בקשה לתמיכה ונאמת את זהותך לפני פעולה.',
        appPath: 'בתוך האפליקציה או האתר',
        appBody: 'התחבר/י, פתח/י את החשבון שלי או הגדרות, ובחר/י מחיקת חשבון. הבקשה נשמרת עם חותמת זמן וניתנת לביטול בתקופת ההשהיה, אם האפשרות עדיין זמינה.',
        supportPath: 'אם אין לך גישה לחשבון',
        supportBody: 'שלח/י אימייל מהכתובת הרשומה בחשבון. כלול/י שם מלא, מספר טלפון משויך, והודעה: I request deletion of my PetWash account.',
        dataTitle: 'מה נמחק',
        dataBody: 'פרופיל, פרטי חיות מחמד, העדפות, הרשאות, מזהי מכשיר ונתונים תפעוליים שאינם נדרשים לשמירה חוקית.',
        retainedTitle: 'מה עשוי להישמר',
        retainedBody: 'חשבוניות, תשלומים, מסמכי מס, רשומות אבטחה ורשומות משפטיות עשויים להישמר לפי חובות חוקיות, מניעת הונאה או פתרון מחלוקות.',
        appleTitle: 'Sign in with Apple',
        appleBody: 'אם התחברת באמצעות Apple, PetWash מנסה לבטל את אסימון Apple בזמן בקשת המחיקה. אם האסימון אינו זמין, ייתכן שתידרש גם הסרה דרך הגדרות Apple ID.',
        timingTitle: 'זמנים',
        timingBody: 'בקשות רגילות מתוזמנות עם תקופת השהיה של 30 יום בממשק החשבון, ומסלולי פרטיות מסוימים עשויים לשמור רשומת ביקורת עד 90 יום לפי דין.',
        primary: 'פתח/י את החשבון שלי',
        email: 'שליחת בקשה באימייל',
        privacy: 'מדיניות פרטיות',
      }
    : {
        eyebrow: 'Account deletion resource',
        title: 'Delete your PetWash account',
        updated: 'Last updated: June 5, 2026',
        intro: 'You can request account deletion from the app or website. If you cannot access your account, contact support and we will verify your identity before acting.',
        appPath: 'In the app or website',
        appBody: 'Sign in, open My Account or Settings, and choose account deletion. The request is recorded with a timestamp and can be cancelled during the cooling-off window when cancellation is still available.',
        supportPath: 'If you cannot access your account',
        supportBody: 'Email us from the address on your account. Include your full name, linked phone number, and the sentence: I request deletion of my PetWash account.',
        dataTitle: 'Data we delete',
        dataBody: 'Profile details, pet profiles, preferences, consents, device identifiers, and operational data that is not required for legal retention.',
        retainedTitle: 'Data we may retain',
        retainedBody: 'Invoices, payments, tax records, security logs, and legal audit records may be retained where required for law, fraud prevention, or dispute resolution.',
        appleTitle: 'Sign in with Apple',
        appleBody: 'If you used Sign in with Apple, PetWash attempts Apple token revocation when deletion is requested. If the token is unavailable, you may also need to remove access from your Apple ID settings.',
        timingTitle: 'Timing',
        timingBody: 'Standard requests use a 30-day cooling-off window in account settings, and some privacy-law audit records may be retained for up to 90 days where required.',
        primary: 'Open My Account',
        email: 'Email deletion request',
        privacy: 'Privacy Policy',
      };

  const details = [
    { icon: Smartphone, title: copy.appPath, body: copy.appBody },
    { icon: Mail, title: copy.supportPath, body: copy.supportBody },
    { icon: Database, title: copy.dataTitle, body: copy.dataBody },
    { icon: ShieldCheck, title: copy.retainedTitle, body: copy.retainedBody },
    { icon: UserRound, title: copy.appleTitle, body: copy.appleBody },
    { icon: Clock3, title: copy.timingTitle, body: copy.timingBody },
  ];

  return (
    <Layout language={language} onLanguageChange={setLanguage}>
      <main className="min-h-screen bg-white text-slate-950" dir={dir}>
        <section className="border-b border-slate-200 bg-slate-50">
          <div className="mx-auto flex max-w-5xl flex-col gap-6 px-5 py-12 sm:px-8 lg:py-16">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-700">{copy.eyebrow}</p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight sm:text-5xl">{copy.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-700">{copy.intro}</p>
              <p className="mt-3 text-sm text-slate-500">{copy.updated}</p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/my-account">
                <Button className="w-full bg-slate-950 text-white hover:bg-slate-800 sm:w-auto">
                  <UserRound className="h-4 w-4" />
                  {copy.primary}
                </Button>
              </Link>
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=PetWash%20account%20deletion%20request`}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 text-sm font-medium text-slate-900 transition-colors hover:bg-white"
              >
                <Mail className="h-4 w-4" />
                {copy.email}
              </a>
              <Link
                href="/privacy-policy"
                className="inline-flex h-10 items-center justify-center rounded-md px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-white"
              >
                {copy.privacy}
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto grid max-w-5xl gap-5 px-5 py-10 sm:px-8 md:grid-cols-2 lg:py-14">
          {details.map(({ icon: Icon, title, body }) => (
            <article key={title} className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-emerald-50 text-emerald-700">
                <Icon className="h-5 w-5" />
              </div>
              <h2 className="text-lg font-semibold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-700">{body}</p>
            </article>
          ))}
        </section>

        <section className="border-t border-slate-200 bg-slate-50">
          <div className="mx-auto max-w-5xl px-5 py-8 text-sm leading-6 text-slate-700 sm:px-8">
            <p>
              {isHebrew
                ? 'לשאלות על מחיקת חשבון או זכויות מידע: '
                : 'For account deletion or data-rights questions: '}
              <a className="font-semibold text-emerald-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>
                {SUPPORT_EMAIL}
              </a>
            </p>
          </div>
        </section>
      </main>
    </Layout>
  );
}
