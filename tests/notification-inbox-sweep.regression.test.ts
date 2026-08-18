/**
 * PR-NOTIFICATION-INBOX-SWEEP — regression pin for four small client fixes
 * surfaced by the 2026-08-18 audit:
 *
 *   #6 DashboardV2 bell was href="/account" (identical to Menu icon) → /notifications
 *   #7 NotificationCenterPanel bell badge capped at 9+ vs 99+ inside → both 99+
 *   #8 ProviderTaskInbox chat nav used b.bookingNumber || b.id (BK-XXXX 404s) → b.id
 *   #9 ProviderTaskInbox STATUS_LABEL declared but never rendered → chip mounted
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const REPO = path.resolve(__dirname, '..');
const load = (p: string) => fs.readFileSync(path.join(REPO, p), 'utf8');

const DASH = load('client/src/pages/DashboardV2.tsx');
const NCP = load('client/src/components/NotificationCenterPanel.tsx');
const PTI = load('client/src/pages/ProviderTaskInbox.tsx');

describe('#6 DashboardV2 bell routes to /notifications', () => {
  it('bell Link uses href="/notifications" (not /account)', () => {
    // Find the Bell icon and its enclosing Link
    expect(DASH).toMatch(/<Link\s+href="\/notifications"[^>]*>\s*<Bell/);
  });
  it('does NOT regress to /account for the bell', () => {
    expect(DASH).not.toMatch(/<Link\s+href="\/account"[^>]*>\s*<Bell/);
  });
});

describe('#7 NotificationCenterPanel bell badge cap raised to 99+', () => {
  it('cap is 99+ on the outside bell', () => {
    expect(NCP).toMatch(/count\s*>\s*99\s*\?\s*["']99\+["']/);
  });
  it('does NOT regress to 9+', () => {
    // Old shape was `count > 9 ? "9+"`. Make sure that exact snippet is gone.
    expect(NCP).not.toMatch(/count\s*>\s*9\s*\?\s*["']9\+["']/);
  });
});

describe('#8 ProviderTaskInbox chat nav uses b.id', () => {
  it('booking-chat navigation drops the bookingNumber fallback', () => {
    expect(PTI).toMatch(/navigate\(`\/booking-chat\/\$\{b\.id\}`\)/);
  });
  it('never re-introduces the bookingNumber-first fallback as a LIVE call', () => {
    // Strip line comments first so the historical "was ..." note above the
    // fix doesn't false-positive.
    const withoutComments = PTI.replace(/\/\/[^\n]*/g, '');
    expect(withoutComments).not.toMatch(/navigate\(`\/booking-chat\/\$\{b\.bookingNumber\s*\|\|\s*b\.id\}`\)/);
  });
});

describe('#9 ProviderTaskInbox status chip is rendered', () => {
  it('renders STATUS_LABEL[b.status] as a chip with stable testid', () => {
    expect(PTI).toMatch(/STATUS_LABEL\[b\.status\]/);
    expect(PTI).toMatch(/data-testid=\{`task-inbox-status-\$\{b\.id\}`\}/);
  });
  it('the STATUS_LABEL map declaration is still intact', () => {
    expect(PTI).toMatch(/const\s+STATUS_LABEL\s*:\s*Record<string,\s*string>\s*=\s*\{/);
  });
});
