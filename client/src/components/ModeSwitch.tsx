/**
 * ModeSwitch — Customer ↔ Provider mode picker for multi-role users.
 *
 * Per CEO 2026-08-18 §7: shows a two-choice selector ONLY when the
 * authenticated user actually has BOTH capabilities (activated customer
 * AND provider.active === true, per server-side getUserCapabilities).
 * Switching NEVER mutates user.role — it only persists a local UI
 * preference (see client/src/lib/uiMode.ts). Server authorization stays
 * capability-based on every request.
 *
 * Behavior:
 *   • Signed out / loading / single-role user → renders nothing.
 *   • Multi-role user → renders a segmented control. The current mode
 *     is highlighted; clicking the other button flips the preference.
 *   • On flip, invalidates data queries so surfaces re-fetch under the
 *     new perspective (customer bookings vs provider bookings).
 *   • RTL-aware via useLanguage.
 *
 * Consumers: mount inside PetWashHeader, ProviderToday, and account
 * screens. Multiple instances stay in sync (module-level store).
 */

import { useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { UserRound, HardHat } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { useUiMode, type UiMode } from '@/lib/uiMode';
import { useUserCapabilities } from '@/hooks/useUserCapabilities';
import {
  hasCustomerCapability,
  hasProviderCapability,
} from '@shared/lib/userCapabilities';

export interface ModeSwitchProps {
  /**
   * When `true` (default) the switch navigates on flip:
   *   customer → /
   *   provider → /provider/today (the CEO-benchmark focused surface)
   * When `false`, only the UI preference flips; the caller is
   * responsible for any navigation.
   */
  navigateOnFlip?: boolean;
  /** Optional extra class names for the outer wrapper. */
  className?: string;
  /** Test-id root; default "mode-switch". */
  testId?: string;
}

export function ModeSwitch({
  navigateOnFlip = true,
  className = '',
  testId = 'mode-switch',
}: ModeSwitchProps) {
  const { language } = useLanguage();
  const isHe = language === 'he';
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { capabilities, isLoading } = useUserCapabilities();
  const [mode, setMode] = useUiMode();

  const canCustomer = hasCustomerCapability(capabilities);
  const canProvider = hasProviderCapability(capabilities);
  const showSwitch = useMemo(() => canCustomer && canProvider, [canCustomer, canProvider]);

  if (isLoading || !showSwitch) return null;

  const handleFlip = (target: UiMode) => {
    if (target === mode) return;
    setMode(target);
    // Invalidate data that changes perspective between roles. Cheap; each
    // surface refetches lazily. Avoid a full qc.clear() — it would drop
    // Firebase auth cache and other cross-role state.
    qc.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/upcoming'] });
    qc.invalidateQueries({ queryKey: ['/api/provider-dashboard/v2/stats'] });
    qc.invalidateQueries({ queryKey: ['/api/me/status'] });
    qc.invalidateQueries({ queryKey: ['/api/me/capabilities'] });
    if (navigateOnFlip) {
      navigate(target === 'provider' ? '/provider/today' : '/');
    }
  };

  const customerLabel = isHe ? 'לקוח' : 'Customer';
  const providerLabel = isHe ? 'ספק' : 'Provider';

  return (
    <div
      role="group"
      aria-label={isHe ? 'החלף מצב' : 'Switch mode'}
      className={`inline-flex items-center rounded-full border border-gray-300 bg-white p-0.5 text-sm ${className}`}
      dir={isHe ? 'rtl' : 'ltr'}
      data-testid={testId}
    >
      <ModeButton
        active={mode === 'customer'}
        onClick={() => handleFlip('customer')}
        icon={<UserRound className="me-1 h-4 w-4" />}
        label={customerLabel}
        testId={`${testId}-customer`}
      />
      <ModeButton
        active={mode === 'provider'}
        onClick={() => handleFlip('provider')}
        icon={<HardHat className="me-1 h-4 w-4" />}
        label={providerLabel}
        testId={`${testId}-provider`}
      />
    </div>
  );
}

function ModeButton({
  active, onClick, icon, label, testId,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  testId: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'inline-flex items-center rounded-full px-3 py-1.5 font-medium transition-colors ' +
        (active
          ? 'bg-gray-900 text-white'
          : 'bg-transparent text-gray-700 hover:text-gray-900')
      }
      data-testid={testId}
    >
      {icon}
      {label}
    </button>
  );
}
