import { Link } from 'wouter';
import { Apple, Wallet, Sparkles, ChevronRight } from 'lucide-react';
import { useFirebaseAuth } from '@/auth/AuthProvider';
import { type Language } from '@/lib/i18n';

interface PrestigeWalletCTAProps {
  language: Language;
}

/**
 * Homepage Prestige Pass call-to-action.
 *
 * Membership-gated by design — a Prestige Wallet pass is a member artifact, so
 * anonymous visitors are routed to the 18+ interest gate, never handed a pass:
 *   • logged-out          → "Join PetWash Prestige" → /prestige/waitlist
 *   • logged-in (member)  → Apple / Google Wallet buttons → /prestige-pass
 *
 * The /prestige-pass flow is the single source of truth for pass generation:
 * it loads the member's real tier/points and already degrades gracefully when
 * Apple/Google Wallet certs are not configured (503 → "coming soon"). This CTA
 * deliberately does NOT generate passes or touch wallet/cert logic itself.
 *
 * NOTE: the Apple/Google buttons below use on-brand styled buttons. To swap in
 * the official "Add to Apple Wallet" / "Add to Google Wallet" 2026 badge art,
 * replace the button label markup with the official <img> — no logic change.
 */
export default function PrestigeWalletCTA({ language }: PrestigeWalletCTAProps) {
  const { user } = useFirebaseAuth();
  const isHebrew = language === 'he';

  return (
    <section
      id="prestige-wallet"
      className="py-10 sm:py-14 relative overflow-hidden"
      style={{ background: '#ffffff' }}
      data-testid="prestige-wallet-cta"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-px bg-gradient-to-r from-transparent to-[#c9a96e]" />
            <Sparkles className="w-4 h-4 text-[#c9a96e]" strokeWidth={1.2} />
            <div className="w-12 h-px bg-gradient-to-l from-transparent to-[#c9a96e]" />
          </div>

          <p
            className="text-[10px] sm:text-[11px] tracking-[0.35em] uppercase mb-5 font-medium"
            style={{ color: '#c9a96e' }}
          >
            PetWash Prestige
          </p>

          <h2
            className="text-3xl sm:text-4xl lg:text-[3rem] text-[#1a1a1a] mb-4 px-4 font-light leading-tight"
            style={{ fontFamily: "'Playfair Display', 'Didot', 'Bodoni MT', Georgia, serif", letterSpacing: '-0.03em' }}
          >
            {isHebrew ? 'הכרטיס שלך ב-Wallet' : 'Your Pass in Wallet'}
          </h2>

          <p
            className="text-sm sm:text-[15px] text-[#888] max-w-md mx-auto mb-8 leading-relaxed"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {isHebrew
              ? 'חברי PetWash Prestige מקבלים את הכרטיס ב-Apple Wallet ו-Google Wallet — תמיד זמין, מתעדכן אוטומטית.'
              : 'PetWash Prestige members carry their pass in Apple Wallet and Google Wallet — always with you, auto-updating.'}
          </p>

          {user ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3" data-testid="wallet-buttons-member">
              {/* TODO: swap label markup for official "Add to Apple Wallet" badge art */}
              <Link
                href="/prestige-pass"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-[#1a1a1a] text-white text-sm font-medium tracking-wide hover:bg-[#333] transition-all duration-300"
                style={{ borderRadius: '10px' }}
                data-testid="cta-apple-wallet"
              >
                <Apple className="w-5 h-5" strokeWidth={1.5} />
                {isHebrew ? 'הוסף ל-Apple Wallet' : 'Add to Apple Wallet'}
              </Link>

              {/* TODO: swap label markup for official "Add to Google Wallet" badge art */}
              <Link
                href="/prestige-pass"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 bg-white text-[#1a1a1a] text-sm font-medium tracking-wide border border-[#ddd] hover:border-[#c9a96e] transition-all duration-300"
                style={{ borderRadius: '10px' }}
                data-testid="cta-google-wallet"
              >
                <Wallet className="w-5 h-5 text-[#c9a96e]" strokeWidth={1.5} />
                {isHebrew ? 'הוסף ל-Google Wallet' : 'Add to Google Wallet'}
              </Link>
            </div>
          ) : (
            <Link
              href="/prestige/waitlist"
              className="inline-flex items-center justify-center gap-2 px-8 py-3.5 bg-[#1a1a1a] text-white text-sm font-medium tracking-[0.05em] uppercase hover:bg-[#333] transition-all duration-300"
              style={{ borderRadius: '10px' }}
              data-testid="cta-join-prestige"
            >
              {isHebrew ? 'הצטרף ל-PetWash Prestige' : 'Join PetWash Prestige'}
              <ChevronRight className={`w-4 h-4 ${isHebrew ? 'rotate-180' : ''}`} />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
