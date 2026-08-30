/**
 * ActionButton — client render layer for the Action Brain.
 *
 * CEO Doctrine 2026-08-30 §7 (button states), §79 (label discipline),
 * §80 (destructive repeats verb), §98 (generic client components).
 *
 * Wraps an AvailableAction into a button with the full state machine
 * the doctrine requires:
 *
 *   IDLE → AWAITING_CONFIRMATION → SUBMITTING → SUCCEEDED / FAILED / STALE
 *
 * Consumers pass the AvailableAction (surfaced by
 * `listAvailableActions()`) plus an async `onExecute` that returns the
 * ExecuteActionResponse from `executeAction()`. This component handles:
 *
 *   • Confirmation UX per confirmationLevel (§43, §44).
 *   • Idempotency-safe: disables during submit so double-click is a no-op.
 *   • Success / processing / failure copy per §81–§84 doctrine.
 *   • Destructive style for visualKind: 'destructive' (§80).
 */
import { useState } from 'react';
import type {
  ActionResult,
  AvailableAction,
  ConfirmationLevel,
} from '@shared/marketplace/action';
import { getCatalogEntry } from '@shared/marketplace/actionCatalog';

export type OnExecute = () => Promise<{
  ok: boolean;
  result?: ActionResult;
  reasonCode?: string;
}>;

export interface ActionButtonProps {
  action: AvailableAction;
  onExecute: OnExecute;
  /** Optional override for the button label. Defaults to catalog entry. */
  label?: string;
  /** Called after a SUCCEEDED / PROCESSING result. Client refetches data. */
  onSuccess?: (result: ActionResult) => void;
  className?: string;
}

type Phase = 'IDLE' | 'AWAITING_CONFIRMATION' | 'SUBMITTING' | 'DONE';

function visualClassFor(kind: string | undefined, base: string): string {
  switch (kind) {
    case 'destructive':
      return `${base} bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300`;
    case 'safety':
      return `${base} bg-amber-600 text-white hover:bg-amber-700 disabled:bg-amber-300`;
    case 'primary':
      return `${base} bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-emerald-300`;
    default:
      return `${base} bg-gray-800 text-white hover:bg-gray-900 disabled:bg-gray-400`;
  }
}

/**
 * §5, §43, §44: confirmation UX matches the consequence. Every level
 * needing a modal returns true here; NONE / TOAST_UNDO fire immediately.
 */
function needsConfirmationPrompt(level: ConfirmationLevel): boolean {
  return (
    level === 'LIGHT_CONFIRM' ||
    level === 'REVIEW_SCREEN' ||
    level === 'EXPLICIT_CONFIRM' ||
    level === 'REAUTH_AND_CONFIRM'
  );
}

export function ActionButton({
  action,
  onExecute,
  label: labelOverride,
  onSuccess,
  className = '',
}: ActionButtonProps) {
  const entry = getCatalogEntry(action.type);
  const label = labelOverride ?? entry?.label ?? action.type;
  const visualKind = entry?.visualKind;

  const [phase, setPhase] = useState<Phase>('IDLE');
  const [lastResult, setLastResult] = useState<ActionResult | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const disabled =
    !action.enabled || phase === 'SUBMITTING' || phase === 'DONE';

  const buttonClass = visualClassFor(
    visualKind,
    `${className} rounded-full px-5 py-2.5 text-sm font-medium transition disabled:cursor-not-allowed`,
  );

  const submit = async () => {
    setPhase('SUBMITTING');
    setErrorCode(null);
    const res = await onExecute();
    if (!res.ok || !res.result) {
      setErrorCode(res.reasonCode ?? 'UNKNOWN');
      setPhase('IDLE');
      return;
    }
    setLastResult(res.result);
    setPhase('DONE');
    onSuccess?.(res.result);
  };

  const onClick = () => {
    if (disabled) return;
    if (needsConfirmationPrompt(action.confirmationLevel)) {
      setPhase('AWAITING_CONFIRMATION');
    } else {
      void submit();
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={buttonClass}
        data-testid={`action-btn-${action.type.toLowerCase()}`}
        data-risk={action.riskLevel}
        data-confirmation={action.confirmationLevel}
      >
        {phase === 'SUBMITTING' ? `${label}…` : label}
      </button>

      {phase === 'AWAITING_CONFIRMATION' && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          data-testid={`action-confirm-${action.type.toLowerCase()}`}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
            <p className="mt-2 text-sm text-gray-600">
              {confirmationCopyFor(action.confirmationLevel)}
            </p>
            {action.confirmationLevel === 'REAUTH_AND_CONFIRM' && (
              <p className="mt-2 text-xs text-amber-700">
                You&rsquo;ll be asked to re-verify your identity to complete this change.
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-gray-300 px-4 py-2 text-sm text-gray-700"
                onClick={() => setPhase('IDLE')}
                data-testid={`action-cancel-${action.type.toLowerCase()}`}
              >
                Keep it as is
              </button>
              {/* §80 destructive button repeats the ACTION verb — never bare "Yes". */}
              <button
                type="button"
                className={visualClassFor(visualKind, 'rounded-full px-5 py-2 text-sm font-medium')}
                onClick={() => void submit()}
                data-testid={`action-confirm-verb-${action.type.toLowerCase()}`}
              >
                {label}
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === 'DONE' && lastResult && (
        <div
          className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900"
          data-testid={`action-result-${action.type.toLowerCase()}`}
        >
          {resultCopyFor(lastResult)}
        </div>
      )}

      {errorCode && (
        <div
          className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900"
          data-testid={`action-error-${action.type.toLowerCase()}`}
        >
          {errorCopyFor(errorCode)}
        </div>
      )}
    </>
  );
}

// ── Copy dictionaries (§78: reason code → UX) ────────────────────────

function confirmationCopyFor(level: ConfirmationLevel): string {
  switch (level) {
    case 'LIGHT_CONFIRM':
      return 'Confirm this action?';
    case 'REVIEW_SCREEN':
      return "Please review the details before confirming.";
    case 'EXPLICIT_CONFIRM':
      return "This affects money or your commitment. Please confirm.";
    case 'REAUTH_AND_CONFIRM':
      return "For safety we'll ask you to re-verify before continuing.";
    default:
      return '';
  }
}

function resultCopyFor(r: ActionResult): string {
  switch (r.status) {
    case 'SUCCEEDED':
      return 'Done.';
    case 'PROCESSING':
      return "We're processing this — we'll update you once it's confirmed.";
    case 'REQUIRES_ACTION':
      return 'One more step is needed.';
    default:
      return 'Something went wrong. Please try again.';
  }
}

function errorCopyFor(code: string): string {
  switch (code) {
    case 'REAUTH_REQUIRED':
      return "Please re-verify your identity and try again.";
    case 'QUOTE_CHANGED':
      return "The price or availability changed. Please review the new quote.";
    case 'STALE_PREVIEW':
      return "Details changed. Please review the updated screen.";
    case 'PAYMENT_STILL_PROCESSING':
    case 'PAYMENT_UNCERTAIN':
      return "We're still confirming your payment. Please wait a moment.";
    case 'PROVIDER_NO_LONGER_AVAILABLE':
      return "The provider is no longer available at this time.";
    case 'PET_SPECIES_UNSUPPORTED':
      return "This provider doesn't support one of your pets for this service.";
    default:
      return "Something didn't work. Please try again or contact support.";
  }
}
