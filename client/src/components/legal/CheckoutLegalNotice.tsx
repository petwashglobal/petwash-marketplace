import { Link } from "wouter";
import { useLanguage } from "@/lib/languageStore";

/**
 * CheckoutLegalNotice — point-of-sale consumer disclosure (Israel §14ג).
 *
 * The Consumer Protection Law, 1981 requires the cancellation right to be
 * disclosed AT the point of sale, not buried in a legal hub. Drop this in next
 * to any prepaid purchase CTA (eGift, wash packages, shop, booking pay step).
 * It states the 14-day distance-sale right + the statutory fee cap (5% or ₪100,
 * whichever is lower) and links to the full Cancellation & Refund Policy and
 * Terms. Self-sources language — no props needed.
 *
 * Brand: subtle ink text, gold underlined links — no loud banner.
 */
export function CheckoutLegalNotice({ className = "" }: { className?: string }) {
  const { language } = useLanguage();
  const he = language === "he";

  const linkCls =
    "text-[#B8932F] underline underline-offset-2 hover:text-[#D4AF37] transition-colors";

  return (
    <p
      className={`text-[10px] md:text-[11px] leading-relaxed text-center text-ink-400 ${className}`}
      data-testid="checkout-legal-notice"
    >
      {he ? (
        <>
          בעת השלמת הרכישה את/ה מאשר/ת את{" "}
          <Link href="/legal/cancellation-refund-policy" className={linkCls}>
            מדיניות הביטול וההחזר
          </Link>{" "}
          ואת{" "}
          <Link href="/terms" className={linkCls}>
            תנאי השימוש
          </Link>
          . זכות ביטול בעסקת מכר מרחוק תוך 14 ימים לפי חוק הגנת הצרכן,
          התשמ&quot;א-1981. דמי ביטול: 5% או 100&nbsp;₪, הנמוך מביניהם.
        </>
      ) : (
        <>
          By completing your purchase you agree to the{" "}
          <Link href="/legal/cancellation-refund-policy" className={linkCls}>
            Cancellation &amp; Refund Policy
          </Link>{" "}
          and the{" "}
          <Link href="/terms" className={linkCls}>
            Terms of Use
          </Link>
          . 14-day distance-sale cancellation right under the Consumer Protection
          Law, 1981. Cancellation fee: 5% or ₪100, whichever is lower.
        </>
      )}
    </p>
  );
}
