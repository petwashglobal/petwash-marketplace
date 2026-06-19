import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/languageStore";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import type { ReactNode } from "react";

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
  children: ReactNode;
}

export function LegalPage({ titleHe, titleEn, subtitleHe, subtitleEn, children }: LegalPageProps) {
  const { language } = useLanguage();
  const isHebrew = language === "he";
  const isRtl = language === "he" || language === "ar";

  return (
    <div className={`min-h-[100dvh] bg-white ${isRtl ? "rtl" : "ltr"}`} dir={isRtl ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
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

        <div className="space-y-8 text-black">{children}</div>

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
  children,
}: {
  titleHe: string;
  titleEn: string;
  children: ReactNode;
}) {
  const { language } = useLanguage();
  const isHebrew = language === "he";
  return (
    <section>
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
