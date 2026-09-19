/**
 * "Add to Apple Wallet" — the button that was never there.
 *
 * CEO, 2026-09-19: "why i cannot have apple button add to wallet like others
 * and i press yes".
 *
 * The server has been able to build a signed .pkpass the whole time —
 * production logs show generateAppleWalletPass running to completion — but NO
 * client code ever called /api/prestige-pass/apple-wallet. The member pass had
 * no button at all, which is why only two passes were generated in three days.
 *
 * Deliberately a plain <a>, not a fetch:
 *   • iOS installs a pass from a NAVIGATION to a pkpass response. Fetching the
 *     bytes into JS and building a blob URL is the reliable way to get
 *     "Safari cannot download this file" instead.
 *   • the route already answers `Content-Disposition: inline`, which is what
 *     lets Wallet take it directly (see the note in prestige-pass.ts and
 *     server/tests/pkpassServedInline.regression.test.ts).
 *   • an <a> carries the session cookie the endpoint needs.
 */
import { useLanguage } from '@/lib/languageStore';

interface AddToAppleWalletProps {
  /** Defaults to the member pass. Booking/gift passes pass their own path. */
  href?: string;
  className?: string;
}

export function AddToAppleWallet({
  href = '/api/prestige-pass/apple-wallet',
  className,
}: AddToAppleWalletProps) {
  const { language } = useLanguage();
  const he = language === 'he';

  return (
    <a
      href={href}
      data-testid="link-add-to-apple-wallet"
      aria-label={he ? 'הוספה ל-Apple Wallet' : 'Add to Apple Wallet'}
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        background: '#000000',
        color: '#ffffff',
        borderRadius: '10px',
        padding: '12px 22px',
        textDecoration: 'none',
        fontWeight: 600,
        fontSize: '0.95rem',
        lineHeight: 1.1,
        border: '1px solid #000',
        // The badge always reads left-to-right, even on a Hebrew page —
        // it is an Apple lockup, not translated copy.
        direction: 'ltr',
      }}
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M17.05 12.54c-.02-2.3 1.88-3.4 1.96-3.45-1.07-1.56-2.73-1.78-3.32-1.8-1.41-.14-2.76.83-3.48.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.79-.41 6.92 1.16 9.19.77 1.11 1.69 2.35 2.9 2.31 1.16-.05 1.6-.75 3.01-.75s1.81.75 3.04.72c1.26-.02 2.05-1.13 2.82-2.24.89-1.29 1.25-2.54 1.27-2.6-.03-.01-2.44-.94-2.46-3.71zM14.77 5.4c.64-.78 1.07-1.85.95-2.93-.92.04-2.04.61-2.7 1.38-.59.69-1.11 1.79-.97 2.85 1.03.08 2.08-.52 2.72-1.3z" />
      </svg>
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.62rem', fontWeight: 500, opacity: 0.85, letterSpacing: '0.02em' }}>
          {he ? 'הוספה ל־' : 'Add to'}
        </span>
        <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.01em' }}>
          Apple Wallet
        </span>
      </span>
    </a>
  );
}

export default AddToAppleWallet;
