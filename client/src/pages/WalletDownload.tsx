import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { useLanguage } from "@/lib/languageStore";
import type { ReactNode } from "react";
import {
  Apple,
  CheckCircle2,
  Globe2,
  LogIn,
  Mail,
  ShieldCheck,
  Smartphone,
  Wallet,
} from "lucide-react";
import { SiAndroid } from "react-icons/si";
import { useLocation } from "wouter";

type WalletStep = {
  title: string;
  copy: string;
};

export default function WalletDownload() {
  const { language } = useLanguage();
  const { user, loading } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const he = language === "he";

  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);
  const isAndroid = /Android/i.test(userAgent);

  const steps: WalletStep[] = he
    ? [
        { title: "נרשמים ומאמתים", copy: "שם מלא, מעל גיל 18, אימייל ונייד מאומתים לפני יצירת כרטיס." },
        { title: "מאשרים שימוש ב-Wallet", copy: "המשתמש נותן הסכמה ברורה לכרטיס דיגיטלי, עדכונים ותנאי Pet Wash Ltd." },
        { title: "מורידים מהמקום הנכון", copy: "iPhone מקבל Apple Wallet, Android/Galaxy מקבל Google Wallet, ומכשיר ללא Wallet מקבל כרטיס Web מאובטח." },
      ]
    : [
        { title: "Register and verify", copy: "Full name, over-18 confirmation, verified email and verified mobile before pass issue." },
        { title: "Consent to Wallet", copy: "The member gives clear consent for the digital pass, updates, and Pet Wash Ltd terms." },
        { title: "Download from one place", copy: "iPhone gets Apple Wallet, Android/Galaxy gets Google Wallet, and no-Wallet devices get a secure web card." },
      ];

  const goToPass = () => setLocation("/prestige-pass");
  const goToSignup = () => setLocation("/signup?flow=prestige&returnTo=/prestige-pass");
  const goToSignin = () => setLocation("/signin?returnTo=/prestige-pass");

  return (
    <main className="min-h-screen bg-[#fbfaf7] text-[#111111]" dir={he ? "rtl" : "ltr"}>
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#b0841c]/35 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-[#8a6414] shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              {he ? "PetWash Prestige Wallet" : "PetWash Prestige Wallet"}
            </div>

            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold leading-[1.05] tracking-tight text-black sm:text-5xl lg:text-6xl">
                {he ? "כרטיס PetWash שלך, במקום אחד." : "Your PetWash pass, in one trusted place."}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-[#4b4b4b] sm:text-lg">
                {he
                  ? "זה שער ההורדה הרשמי. אין כרטיסים מזויפים ואין מספרים ידניים: המשתמש נרשם, מאמת נייד ואימייל, נותן הסכמה, ואז מוריד את הכרטיס המתאים למכשיר."
                  : "This is the official download gateway. No fake passes and no manual numbers: the member registers, verifies mobile and email, consents, then downloads the correct pass for their device."}
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              {user ? (
                <Button
                  className="h-[52px] rounded-full bg-black px-7 text-base font-semibold text-white hover:bg-[#242424]"
                  onClick={goToPass}
                  disabled={loading}
                  data-testid="button-open-prestige-pass"
                >
                  <Wallet className="mr-2 h-5 w-5" />
                  {he ? "פתח את הכרטיס שלי" : "Open My Prestige Pass"}
                </Button>
              ) : (
                <Button
                  className="h-[52px] rounded-full bg-black px-7 text-base font-semibold text-white hover:bg-[#242424]"
                  onClick={goToSignup}
                  disabled={loading}
                  data-testid="button-join-prestige-wallet"
                >
                  <Wallet className="mr-2 h-5 w-5" />
                  {he ? "הצטרפות והורדת Wallet" : "Join and Download Wallet"}
                </Button>
              )}

              {!user && (
                <Button
                  variant="outline"
                  className="h-[52px] rounded-full border-[#b0841c]/45 bg-white px-7 text-base font-semibold text-black hover:bg-[#fff8e7]"
                  onClick={goToSignin}
                  disabled={loading}
                  data-testid="button-signin-prestige-wallet"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  {he ? "כבר חבר? התחברות" : "Already a member? Sign in"}
                </Button>
              )}
            </div>

            {(isIOS || isAndroid) && (
              <div className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-[#2a2a2a] shadow-sm ring-1 ring-black/5">
                {isIOS ? <Apple className="h-5 w-5" /> : <SiAndroid className="h-5 w-5 text-[#3ddc84]" />}
                {isIOS
                  ? he ? "זוהה iPhone: אחרי התחברות, הכפתור יוריד Apple Wallet." : "iPhone detected: after sign-in, the button downloads Apple Wallet."
                  : he ? "זוהה Android: אחרי התחברות, הכפתור יפתח Google Wallet." : "Android detected: after sign-in, the button opens Google Wallet."}
              </div>
            )}
          </div>

          <Card className="overflow-hidden rounded-[28px] border border-[#b0841c]/25 bg-white shadow-[0_24px_70px_rgba(20,20,20,0.12)]">
            <CardContent className="p-0">
              <div className="border-b border-[#f0e3bf] bg-gradient-to-br from-white via-[#fffdf8] to-[#f8f4ea] p-6 sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#b0841c]">
                      {he ? "הורדה חכמה" : "Smart download"}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-black">
                      {he ? "מה קורה כשמשתמש לוחץ?" : "What happens when a user taps?"}
                    </h2>
                  </div>
                  <Smartphone className="h-10 w-10 text-[#b0841c]" />
                </div>

                <div className="space-y-4">
                  {steps.map((step, index) => (
                    <div key={step.title} className="flex gap-4 rounded-2xl bg-white/80 p-4 shadow-sm ring-1 ring-black/5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#b0841c] text-sm font-bold text-white">
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="text-base font-semibold text-black">{step.title}</h3>
                        <p className="mt-1 text-sm leading-6 text-[#5c5c5c]">{step.copy}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-0 divide-y divide-[#f0e3bf] sm:grid-cols-3 sm:divide-x sm:divide-y-0">
                <WalletTarget
                  icon={<Apple className="h-7 w-7" />}
                  title="Apple Wallet"
                  copy={he ? "iPhone ו-iPad. הקובץ נפתח ישירות בארנק Apple." : "iPhone and iPad. The pass opens directly in Apple Wallet."}
                />
                <WalletTarget
                  icon={<SiAndroid className="h-7 w-7 text-[#3ddc84]" />}
                  title="Google Wallet"
                  copy={he ? "Android, Samsung Galaxy ומכשירי Google Play." : "Android, Samsung Galaxy, and Google Play devices."}
                />
                <WalletTarget
                  icon={<Globe2 className="h-7 w-7" />}
                  title={he ? "כרטיס Web" : "Secure Web Card"}
                  copy={he ? "גיבוי למכשירים ללא Apple/Google Wallet, כולל QR מאובטח." : "Fallback for devices without Apple/Google Wallet, with secure QR."}
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 grid gap-4 rounded-[24px] border border-black/10 bg-white p-5 text-sm text-[#4b4b4b] shadow-sm md:grid-cols-3">
          <TrustNote icon={<CheckCircle2 className="h-5 w-5 text-[#b0841c]" />} text={he ? "הורדת Wallet מתבצעת רק אחרי אימות והרשאה." : "Wallet download happens only after verification and consent."} />
          <TrustNote icon={<ShieldCheck className="h-5 w-5 text-[#b0841c]" />} text={he ? "אם ספק Apple/Google לא מוגדר, המערכת נכשלת נקי ולא מזייפת כרטיס." : "If Apple/Google provider is not configured, the system fails cleanly and never fakes a pass."} />
          <TrustNote icon={<Mail className="h-5 w-5 text-[#b0841c]" />} text={he ? "אפשר לשלוח לינק מאובטח גם באימייל אחרי התחברות." : "A secure pass link can also be sent by email after sign-in."} />
        </div>
      </section>
    </main>
  );
}

function WalletTarget({ icon, title, copy }: { icon: ReactNode; title: string; copy: string }) {
  return (
    <div className="p-6">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff7e3] text-black ring-1 ring-[#b0841c]/25">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-black">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-[#616161]">{copy}</p>
    </div>
  );
}

function TrustNote({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <p className="leading-6">{text}</p>
    </div>
  );
}
