import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/languageStore";
import { ArrowLeft, AlertTriangle, ShieldCheck, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useFirebaseAuth } from "@/auth/AuthProvider";
import { apiRequest } from "@/lib/queryClient";

/**
 * Shared layout for PetWash legal pages (Israel 2026 set).
 *
 * Renders a clean, readable prose container (white bg, black text), the brand
 * back-to-home link, RTL handling for Hebrew, the company identity footer, and
 * — on EVERY page — the mandatory draft / not-legal-advice notice required while
 * these documents await review by licensed Israeli counsel.
 *
 * Content is authored bilingually by the caller. Pass `titleHe` / `titleEn` and
 * the body as children. Use the exported helper components (LegalSection,
 * LegalParagraph, LegalList) to keep clause formatting consistent.
 */

export const LEGAL_LAST_UPDATED = "2026-06-19";

export function DraftNotice() {
  const { language } = useLanguage();
  const isHebrew = language === "he";
  return (
    <div
      role="note"
      className="flex items-start gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-300 mb-8"
      data-testid="legal-draft-notice"
    >
      <AlertTriangle className="h-5 w-5 text-amber-700 flex-shrink-0 mt-0.5" />
      <p className="text-sm text-amber-900 leading-relaxed">
        {isHebrew
          ? 'טיוטה — אינה ייעוץ משפטי; טעונה בדיקת עו"ד מורשה בישראל.'
          : "Draft — not legal advice; pending review by licensed Israeli counsel."}
      </p>
    </div>
  );
}

interface LegalPageProps {
  titleHe: string;
  titleEn: string;
  /** Short one-line summary under the title. */
  subtitleHe?: string;
  subtitleEn?: string;
  /** Optional in-page section nav (CEO canon: Terms mockup has a sidebar).
   *  Each id must match a LegalSection's `id`. Desktop: sticky sidebar;
   *  mobile: horizontal chip row. */
  toc?: Array<{ id: string; he: string; en: string }>;
  /** Render the "I Accept" gate at the end (Terms page). Signed-in users
   *  stamp users.accepted_terms_at once; guests are routed to /signup. */
  acceptGate?: boolean;
  children: ReactNode;
}

/** The Terms "I Accept" control — real, recorded server-side, idempotent. */
function AcceptTermsGate() {
  const { language } = useLanguage();
  const he = language === "he";
  const { user } = useFirebaseAuth();
  const [, setLocation] = useLocation();
  const [state, setState] = useState<"loading" | "accepted" | "ready" | "saving" | "error">("loading");
  const [acceptedAt, setAcceptedAt] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user) { setState("ready"); return; }
      try {
        const res = await apiRequest("GET", "/api/legal/terms-acceptance");
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (data?.acceptedAt) { setAcceptedAt(data.acceptedAt); setState("accepted"); }
        else setState("ready");
      } catch { if (!cancelled) setState("ready"); }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const accept = async () => {
    if (!user) { setLocation("/signup?next=" + encodeURIComponent("/legal/terms")); return; }
    setState("saving");
    try {
      const res = await apiRequest("POST", "/api/legal/accept-terms");
      const data = await res.json().catch(() => ({}));
      if (data?.acceptedAt) { setAcceptedAt(data.acceptedAt); setState("accepted"); }
      else setState("error");
    } catch { setState("error"); }
  };

  if (state === "loading") return null;
  if (state === "accepted") {
    const d = acceptedAt ? new Date(acceptedAt).toLocaleDateString(he ? "he-IL" : "en-GB") : "";
    return (
      <div className="mt-10 flex items-center gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4" data-testid="terms-accepted-state">
        <ShieldCheck className="h-5 w-5 text-emerald-700 flex-shrink-0" />
        <p className="text-sm text-emerald-900">
          {he ? `אישרתם את התנאים ב־${d}` : `You accepted these terms on ${d}`}
        </p>
      </div>
    );
  }
  return (
    <div className="mt-10 rounded-2xl border p-5" style={{ borderColor: "#D4AF37", background: "#FFFDF5" }} data-testid="terms-accept-gate">
      <p className="mb-3 text-sm text-gray-700">
        {he
          ? "קראתם? אפשר לאשר כאן — האישור נרשם בחשבונכם."
          : "Done reading? Confirm here — your acceptance is recorded on your account."}
      </p>
      <button
        type="button"
        onClick={accept}
        disabled={state === "saving"}
        data-testid="terms-accept-button"
        className="flex items-center gap-2 rounded-xl px-6 py-3 font-bold disabled:opacity-50"
        style={{ background: "#D4AF37", color: "#063B22" }}
      >
        {state === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
        {user ? (he ? "אני מאשר/ת את התנאים" : "I accept the terms") : (he ? "התחברות ואישור" : "Sign in to accept")}
      </button>
      {state === "error" && (
        <p className="mt-2 text-sm text-red-600">{he ? "שגיאה — נסו שוב" : "Something went wrong — try again"}</p>
      )}
    </div>
  );
}

export function LegalPage({ titleHe, titleEn, subtitleHe, subtitleEn, toc, acceptGate, children }: LegalPageProps) {
  const { language } = useLanguage();
  const isHebrew = language === "he";
  const isRtl = language === "he" || language === "ar";

  return (
    <div className={`min-h-[100dvh] bg-white ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className={`${toc ? "max-w-5xl" : "max-w-3xl"} mx-auto px-4 py-10 md:py-14`}>
        <Link href="/">
          <Button variant="ghost" className="mb-6 flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            {isHebrew ? "חזרה לעמוד הבית" : "Back to home"}
          </Button>
        </Link>

        <h1 className="text-3xl md:text-4xl font-bold text-black mb-2 tracking-tight">
          {isHebrew ? titleHe : titleEn}
        </h1>
        {(subtitleHe || subtitleEn) && (
          <p className="text-gray-600 mb-6 leading-relaxed">
            {isHebrew ? subtitleHe : subtitleEn}
          </p>
        )}

        <DraftNotice />

        {/* Mobile section chips */}
        {toc && (
          <nav className="lg:hidden mb-6 -mx-4 px-4 flex gap-2 overflow-x-auto pb-2" aria-label="Sections" data-testid="legal-toc-mobile">
            {toc.map((t) => (
              <a key={t.id} href={`#${t.id}`} className="whitespace-nowrap rounded-full border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700">
                {isHebrew ? t.he : t.en}
              </a>
            ))}
          </nav>
        )}

        <div className={toc ? "lg:grid lg:grid-cols-[230px_1fr] lg:gap-10" : undefined}>
          {/* Desktop sticky sidebar (canon Terms mockup) */}
          {toc && (
            <nav className="hidden lg:block" aria-label="Sections" data-testid="legal-toc-sidebar">
              <div className="sticky top-24 space-y-1">
                {toc.map((t) => (
                  <a key={t.id} href={`#${t.id}`} className="block rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-[#FFFDF5] hover:text-black border border-transparent hover:border-[#D4AF37]/40">
                    {isHebrew ? t.he : t.en}
                  </a>
                ))}
              </div>
            </nav>
          )}

          <div>
            <div className="space-y-8 text-black">{children}</div>
            {acceptGate && <AcceptTermsGate />}
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6 mt-12 space-y-2">
          <p className="text-xs text-gray-500 leading-relaxed">
            {isHebrew
              ? `PET WASH LTD (ח.פ. 517145033). עודכן לאחרונה: ${LEGAL_LAST_UPDATED}. דין חל: דיני מדינת ישראל; סמכות שיפוט ייחודית — בתי המשפט המוסמכים בתל אביב-יפו. הוראות צרכניות כופות בישראל חלות בכל מקרה.`
              : `PET WASH LTD (company no. 517145033). Last updated: ${LEGAL_LAST_UPDATED}. Governing law: laws of the State of Israel; exclusive jurisdiction — the competent courts of Tel Aviv-Yafo. Mandatory Israeli consumer-protection law applies in any event.`}
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            {isHebrew
              ? 'טיוטה — אינה ייעוץ משפטי; טעונה בדיקת עו"ד מורשה בישראל.'
              : "Draft — not legal advice; pending review by licensed Israeli counsel."}
          </p>
        </div>
      </div>
    </div>
  );
}

/** A titled clause group. */
export function LegalSection({
  titleHe,
  titleEn,
  id,
  children,
}: {
  titleHe: string;
  titleEn: string;
  /** Anchor id — must match the page's `toc` entry for sidebar navigation. */
  id?: string;
  children: ReactNode;
}) {
  const { language } = useLanguage();
  const isHebrew = language === "he";
  return (
    <section id={id} style={id ? { scrollMarginTop: "96px" } : undefined}>
      <h2 className="text-xl md:text-2xl font-semibold text-black mb-3">
        {isHebrew ? titleHe : titleEn}
      </h2>
      <div className="space-y-3 text-gray-800 leading-relaxed">{children}</div>
    </section>
  );
}

/** A bilingual paragraph. */
export function LegalParagraph({ he, en }: { he: string; en: string }) {
  const { language } = useLanguage();
  return <p className="leading-relaxed">{language === "he" ? he : en}</p>;
}

/** A bilingual bulleted clause list. `items` is an array of [he, en] tuples. */
export function LegalList({ items }: { items: Array<[string, string]> }) {
  const { language } = useLanguage();
  const isHebrew = language === "he";
  return (
    <ul className="space-y-2">
      {items.map(([he, en], i) => (
        <li key={i} className="flex gap-3 leading-relaxed">
          <span className="text-amber-600 font-bold mt-1 flex-shrink-0">•</span>
          <span>{isHebrew ? he : en}</span>
        </li>
      ))}
    </ul>
  );
}
