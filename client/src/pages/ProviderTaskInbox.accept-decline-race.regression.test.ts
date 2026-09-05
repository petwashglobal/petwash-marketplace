/**
 * REGRESSION PIN — Accept/Decline race guard on ProviderTaskInbox.
 *
 * Each button's `disabled` prop was gated on `processingId === b.id + "<its
 * own action>"` only. Tapping Accept started a mutation that set
 * processingId to `${b.id}accept`, which did NOT disable the Decline button
 * for the same booking (its check was `processingId === b.id + "decline"`,
 * still false) — a customer-visible race where a provider mis-tap (or a
 * scripted double-tap test) could fire accept AND decline concurrently for
 * one booking. The server's status-gated atomic transition
 * (server/routes/provider-dashboard-v2.ts) rejects whichever request loses
 * the race, so this was never a data-integrity bug — but the outcome for
 * one booking should never depend on request ordering, and the loser saw a
 * confusing "Cannot 'x' a booking with status 'y'" error toast for an
 * action the provider never meant to send.
 *
 * Fix: both buttons now disable while EITHER action is in flight for that
 * booking.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SRC = readFileSync(resolve(__dirname, 'ProviderTaskInbox.tsx'), 'utf8');

describe('ProviderTaskInbox — Accept/Decline mutual exclusion', () => {
  it('Accept button disables while EITHER accept or decline is pending for this booking', () => {
    const acceptButton = SRC.slice(
      SRC.indexOf('onClick={() => handleAction(b.id, "accept")}') - 400,
      SRC.indexOf('onClick={() => handleAction(b.id, "accept")}'),
    );
    expect(acceptButton).toMatch(
      /disabled=\{processingId === b\.id \+ "accept" \|\| processingId === b\.id \+ "decline"\}/,
    );
  });

  it('Decline button disables while EITHER accept or decline is pending for this booking', () => {
    const declineButton = SRC.slice(
      SRC.indexOf('onClick={() => handleAction(b.id, "decline")}') - 400,
      SRC.indexOf('onClick={() => handleAction(b.id, "decline")}'),
    );
    expect(declineButton).toMatch(
      /disabled=\{processingId === b\.id \+ "accept" \|\| processingId === b\.id \+ "decline"\}/,
    );
  });

  it('never re-introduces the single-action-only disable guard', () => {
    // The old, narrower guard as a standalone disabled prop (not the OR'd pair).
    expect(SRC).not.toMatch(/disabled=\{processingId === b\.id \+ "accept"\}(?!\s*\|\|)/);
    expect(SRC).not.toMatch(/disabled=\{processingId === b\.id \+ "decline"\}(?!\s*\|\|)/);
  });
});
