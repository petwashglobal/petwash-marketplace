/**
 * Regression pin — client Inbox wire (hook + card).
 *
 * Source-anchored so a refactor that:
 *   • drifts the hook off /api/marketplace/inbox,
 *   • loses the 401 / 403 outcome mapping,
 *   • drops the itemKind / domain / workspace testids on the card,
 * is caught in CI before it lands.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CLIENT_ROOT = path.resolve(__dirname, '../../client/src');
const HOOK = fs.readFileSync(path.join(CLIENT_ROOT, 'hooks/useInboxItems.ts'), 'utf8');
const CARD = fs.readFileSync(path.join(CLIENT_ROOT, 'components/marketplace/InboxItemCard.tsx'), 'utf8');

describe('client Inbox wire — hook', () => {
  it('hits /api/marketplace/inbox', () => {
    expect(HOOK).toMatch(/\/api\/marketplace\/inbox\?/);
  });

  it('maps 401 → auth_required and 403 → workspace_unavailable', () => {
    expect(HOOK).toContain("'auth_required'");
    expect(HOOK).toContain("'workspace_unavailable'");
    expect(HOOK).toContain('code === 401');
    expect(HOOK).toContain('code === 403');
  });

  it('queryKey carries workspace/category/limit/locale so the cache stays coherent', () => {
    expect(HOOK).toMatch(/queryKey:\s*\[[^\]]*opts\.workspace[^\]]*opts\.category[^\]]*opts\.limit[^\]]*opts\.locale[^\]]*\]/s);
  });
});

describe('client Inbox wire — InboxItemCard', () => {
  it('exposes threadId testid and thread-type / workspace / kind / domain data attrs', () => {
    expect(CARD).toMatch(/data-testid=\{`inbox-item-\$\{item\.threadId\}`\}/);
    expect(CARD).toContain('data-thread-type={item.threadType}');
    expect(CARD).toContain('data-workspace={item.workspaceContext}');
    expect(CARD).toContain('data-item-kind={item.itemKind}');
    expect(CARD).toContain('data-domain={item.domain}');
  });

  it('renders the unread badge only when unreadCount > 0', () => {
    expect(CARD).toMatch(/const hasUnread = item\.unreadCount > 0/);
    expect(CARD).toMatch(/hasUnread &&/);
  });

  it('never invents user-facing copy — statusBadge is rendered as the slug the server emitted', () => {
    // We expect {item.statusBadge} rendered verbatim, no fallback string.
    expect(CARD).toMatch(/\{item\.statusBadge\}/);
  });
});
