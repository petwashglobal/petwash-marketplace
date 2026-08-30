/**
 * AttentionFeedList — CEO PROGRAM 37 / PROGRAM 2 renderer.
 *
 * Compact renderer for a composed attention feed. Each item is a
 * button so the caller wires onOpen(item.key) to route to the entity
 * (via DeepLinkResolver / server-side link).
 *
 * Every visible string is a stable slug — the caller translates.
 */
import React from 'react';
import type { JourneyPriority } from '@shared/marketplace/journeyState';
import type { AttentionCandidate } from '@/hooks/useAttentionCandidates';

interface Props {
  items: AttentionCandidate[];
  onOpen?: (item: AttentionCandidate) => void;
  className?: string;
}

const PRIORITY_COLOUR: Record<JourneyPriority, string> = {
  URGENT: 'bg-red-600 text-white',
  HIGH: 'bg-orange-500 text-white',
  MEDIUM: 'bg-amber-400 text-gray-900',
  INFO: 'bg-gray-200 text-gray-800',
  NONE: 'bg-gray-100 text-gray-500',
};

export function AttentionFeedList({ items, onOpen, className }: Props) {
  if (!items || items.length === 0) {
    return (
      <div
        data-testid="attention-feed-empty"
        className={`text-xs text-gray-500 px-3 py-2 ${className ?? ''}`}
      >
        NO_ATTENTION_ITEMS
      </div>
    );
  }
  return (
    <ul data-testid="attention-feed-list" className={`divide-y divide-gray-100 ${className ?? ''}`}>
      {items.map((it) => (
        <li key={it.key}>
          <button
            type="button"
            data-testid={`attention-feed-item-${it.key}`}
            data-domain={it.domain}
            data-priority={it.priority}
            data-required={it.isRequired ? '1' : '0'}
            onClick={() => onOpen?.(it)}
            className="w-full text-left px-3 py-2 hover:bg-gray-50 focus:outline-none flex items-center gap-2"
          >
            <span
              data-testid="attention-priority-badge"
              className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${PRIORITY_COLOUR[it.priority] ?? PRIORITY_COLOUR.NONE}`}
            >
              {it.priority}
            </span>
            <span className="text-xs text-gray-500 uppercase tracking-wider">{it.domain}</span>
            <span className="flex-1 truncate text-sm font-medium">{it.reasonCode}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
