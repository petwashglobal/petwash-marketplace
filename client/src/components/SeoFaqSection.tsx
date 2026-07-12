import { useEffect } from 'react';

export interface SeoFaqItem {
  qHe: string;
  qEn: string;
  aHe: string;
  aEn: string;
}

interface SeoFaqSectionProps {
  faq: SeoFaqItem[];
  isHebrew: boolean;
  titleHe?: string;
  titleEn?: string;
  className?: string;
}

/**
 * SeoFaqSection — a visible FAQ accordion whose questions/answers are mirrored
 * 1:1 into FAQPage JSON-LD, so answer engines (ChatGPT / Perplexity / Google AI
 * Overviews) can lift a factual sentence verbatim. Mirrors the pattern proven on
 * the Locations page; reuse it on any marketing page.
 *
 * Pass TRUTHFUL, legal-safe copy only — no guaranteed / medical / eco claims,
 * and any price must be the real ₪55 incl-VAT (run petwash-marketing-legal over
 * the copy before publish).
 *
 * Manages its OWN <script id="faq-jsonld"> — NOT the shared injectStructuredData
 * 'structured-data' block — so it composes with a page's existing structured data
 * instead of clobbering it, and it removes the script on unmount so a page's FAQ
 * never leaks onto the next route. JSON-LD is emitted in Hebrew (Israel is
 * Hebrew-first search); the visible accordion follows the current UI language.
 */
export function SeoFaqSection({
  faq,
  isHebrew,
  titleHe = 'שאלות נפוצות',
  titleEn = 'Frequently asked questions',
  className,
}: SeoFaqSectionProps) {
  useEffect(() => {
    const schema = {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((f) => ({
        '@type': 'Question',
        name: f.qHe,
        acceptedAnswer: { '@type': 'Answer', text: f.aHe },
      })),
    };
    const id = 'faq-jsonld';
    let script = document.getElementById(id) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify(schema);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [faq]);

  return (
    <section
      dir={isHebrew ? 'rtl' : 'ltr'}
      className={className ?? 'max-w-3xl mx-auto px-4 py-14'}
      aria-label={isHebrew ? titleHe : titleEn}
    >
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
        {isHebrew ? titleHe : titleEn}
      </h2>
      <div className="space-y-3">
        {faq.map((f, i) => (
          <details
            key={i}
            className="group rounded-xl border border-gray-200 bg-white px-5 py-4"
          >
            <summary className="cursor-pointer list-none flex justify-between items-center gap-3 font-semibold text-gray-900">
              <span>{isHebrew ? f.qHe : f.qEn}</span>
              <span className="text-[#D4AF37] text-xl leading-none transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-gray-600 leading-relaxed">
              {isHebrew ? f.aHe : f.aEn}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
