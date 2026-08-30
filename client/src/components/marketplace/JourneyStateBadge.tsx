/**
 * JourneyStateBadge — compact renderer for a JourneyState projection.
 *
 * Drop this into any card (booking card, order card, gift card) with
 * (kind, id) and it will fetch the actor's projection and render:
 *   • the attention priority as a colored chip
 *   • the primary action slug (for the parent to translate + hook up)
 *   • a "waitingOn" hint for at-a-glance context
 *
 * The component NEVER guesses a translation — it emits the stable
 * slug and colour, and the parent app is responsible for the label
 * lookup (§ every-string-is-a-slug discipline in JourneyState).
 */
import React from 'react';
import { useEntityJourneyState, type EntityJourneyKind } from '@/hooks/useEntityJourneyState';
import type { JourneyPriority } from '@shared/marketplace/journeyState';

interface Props {
  kind: EntityJourneyKind;
  id: string;
  /** Optional short slug to render alongside — useful when the caller already knows the state. */
  hintLabelCode?: string;
  className?: string;
  /** Optional callback for the primary action slug (parent wires the button). */
  onPrimaryAction?: (actionType: string) => void;
}

const PRIORITY_COLOUR: Record<JourneyPriority, string> = {
  URGENT: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-amber-400 text-gray-900',
  INFO: 'bg-gray-200 text-gray-800',
  NONE: 'bg-gray-100 text-gray-500',
};

export function JourneyStateBadge({ kind, id, hintLabelCode, className, onPrimaryAction }: Props) {
  const { outcome, journey, isLoading } = useEntityJourneyState(kind, id);

  if (isLoading) {
    return <span className={`inline-block px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-400 ${className ?? ''}`}>…</span>;
  }
  if (!outcome || outcome.status === 'error') return null;
  if (outcome.status === 'not_found' || outcome.status === 'not_a_party') return null;
  if (outcome.status === 'not_implemented') {
    // Honest surface (§72): render a subdued placeholder, never a fake OK.
    return (
      <span
        data-testid="journey-badge-not-implemented"
        className={`inline-block px-2 py-0.5 text-xs rounded bg-gray-100 text-gray-400 ${className ?? ''}`}
      >
        {hintLabelCode ?? '—'}
      </span>
    );
  }

  const j = journey!;
  const colour = PRIORITY_COLOUR[j.attentionPriority] ?? PRIORITY_COLOUR.NONE;
  const primary = j.primaryAction?.actionType;

  return (
    <span
      data-testid={`journey-badge-${kind}-${id}`}
      data-priority={j.attentionPriority}
      data-waiting-on={j.waitingOn}
      data-state={j.currentStateCode}
      className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded ${colour} ${className ?? ''}`}
    >
      <span data-testid="journey-badge-state">{j.currentStateCode}</span>
      {primary && (
        <button
          type="button"
          data-testid="journey-badge-primary"
          data-action-type={primary}
          onClick={() => onPrimaryAction?.(primary)}
          className="ml-1 underline underline-offset-2 focus:outline-none"
        >
          {primary}
        </button>
      )}
    </span>
  );
}
