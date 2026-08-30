/**
 * InboxItemCard — compact renderer for a single Inbox item.
 *
 * Kept slug-based: every user-facing string that comes from the
 * server is emitted as a stable code (statusBadge, titleCode,
 * subtitleCode). Free-form fields (title / subtitle / lastMessage /
 * petSummary / serviceSummary) are user-generated content the
 * server already masked upstream and are rendered verbatim.
 */
import React from 'react';
import type { InboxItem } from '@shared/marketplace/inboxItem';

interface Props {
  item: InboxItem;
  onOpen?: (threadId: string) => void;
  className?: string;
}

export function InboxItemCard({ item, onOpen, className }: Props) {
  const hasUnread = item.unreadCount > 0;
  return (
    <button
      type="button"
      data-testid={`inbox-item-${item.threadId}`}
      data-thread-type={item.threadType}
      data-workspace={item.workspaceContext}
      data-item-kind={item.itemKind}
      data-domain={item.domain}
      onClick={() => onOpen?.(item.threadId)}
      className={`w-full text-left px-3 py-2 border-b border-gray-100 hover:bg-gray-50 focus:outline-none ${className ?? ''}`}
    >
      <div className="flex items-baseline gap-2">
        <div className={`flex-1 truncate ${hasUnread ? 'font-semibold' : 'font-normal'}`}>
          {item.title}
        </div>
        {item.statusBadge && (
          <span
            data-testid="inbox-status-badge"
            className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-gray-100 text-gray-600"
          >
            {item.statusBadge}
          </span>
        )}
      </div>
      <div className="text-xs text-gray-500 truncate">{item.subtitle}</div>
      <div className="mt-1 flex items-baseline gap-2">
        <div className="flex-1 truncate text-sm text-gray-700">{item.lastMessage}</div>
        {hasUnread && (
          <span
            data-testid="inbox-unread-count"
            className="text-[11px] font-bold bg-emerald-600 text-white rounded-full px-1.5 min-w-[20px] text-center"
          >
            {item.unreadCount}
          </span>
        )}
      </div>
    </button>
  );
}
