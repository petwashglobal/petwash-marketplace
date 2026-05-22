import { useLocation } from 'wouter';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type Language } from '@/lib/i18n';

/**
 * AuthGateCard — a sign-in gate that never dead-ends.
 *
 * Instead of only telling the user "you must be logged in", it offers the next
 * step right here (Sign in / Create account / Join VIP Prestige) and returns
 * the user to the page they were on (`?redirect=`) after they authenticate.
 *
 * Reuse this anywhere a feature is gated behind auth so the experience is
 * consistent across the site.
 */
export function AuthGateCard({
  language,
  title,
  message,
  /** Where to send the user after they authenticate. Defaults to the current page. */
  redirectTo,
  /** Show the "Join VIP Pet Wash™ Prestige" invitation. Default true. */
  showVip = true,
}: {
  language: Language;
  title?: string;
  message?: string;
  redirectTo?: string;
  showVip?: boolean;
}) {
  const isHe = language === 'he';
  const [location, navigate] = useLocation();
  const back = encodeURIComponent(redirectTo || location || '/');

  const go = (path: string) => navigate(path);

  return (
    <div className="rounded-3xl border border-amber-200 bg-amber-50 p-8 text-center">
      <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-3" />
      <h3 className="font-semibold text-amber-900">
        {title || (isHe ? 'נדרשת התחברות' : 'Sign in to continue')}
      </h3>
      <p className="text-sm text-amber-700 mt-1">
        {message ||
          (isHe
            ? 'התחברו או הצטרפו ל-PetWash כדי להמשיך — תחזרו לכאן מיד אחרי ההתחברות.'
            : 'Sign in or create a PetWash account to continue — you’ll come right back here.')}
      </p>

      <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
        <Button
          onClick={() => go(`/signin?redirect=${back}`)}
          className="bg-amber-600 hover:bg-amber-700 text-white"
          data-testid="authgate-signin"
        >
          {isHe ? 'התחברות' : 'Sign in'}
        </Button>
        <Button
          variant="outline"
          onClick={() => go(`/signup?redirect=${back}&intent=customer`)}
          className="border-amber-300 text-amber-800 hover:bg-amber-100"
          data-testid="authgate-signup"
        >
          {isHe ? 'הצטרפו ל-PetWash' : 'Create a free account'}
        </Button>
      </div>

      {showVip && (
        <button
          type="button"
          onClick={() => go(`/signup?redirect=${back}&intent=prestige`)}
          className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700 underline underline-offset-4 hover:text-amber-900"
          data-testid="authgate-vip"
        >
          {isHe ? 'מועדון VIP Pet Wash™ Prestige' : 'Join VIP Pet Wash™ Prestige'}
        </button>
      )}
    </div>
  );
}
