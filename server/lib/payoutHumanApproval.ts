/**
 * PROVIDER PAYOUTS NEED A HUMAN "YES" FROM PET WASH (CEO rule, 2026-09-13).
 *
 * Providers can lie; money to a provider is never released by a timer, a cron,
 * a machine key or a "system" actor. A job may be COMPLETED automatically, and
 * the customer may CONFIRM it — but the release of provider money happens only
 * when a signed-in Pet Wash admin approves it.
 *
 * Found 2026-09-13 (all dormant only because no bank API is wired yet):
 *   - auto-approve-completions cron released Firestore escrow as
 *     'system_auto_approve' after 24h of customer silence, with zero evidence;
 *   - EscrowService.autoReleaseExpiredHolds released every expired hold as
 *     'system_auto_release' (5-min cron, booking-expiry poller, admin batch);
 *   - ProviderPayoutService.autoReleaseExpiredEscrows (hourly) ran
 *     releaseEscrowAndPayout → bank transfer the moment BANK_PAYOUT_LIVE is on;
 *   - POST /api/marketplace-bookings/process-escrow-releases released holdings
 *     for anyone holding a machine key.
 */

/** Actor ids that are never a human approval. */
export function isSystemPayoutActor(actor: string | null | undefined): boolean {
  const a = String(actor ?? '').trim().toLowerCase();
  return a === '' || a === 'system' || a.startsWith('system_') || a.startsWith('system:') || a.startsWith('cron');
}

export class HumanPayoutApprovalRequired extends Error {
  code = 'HUMAN_APPROVAL_REQUIRED' as const;
  constructor(what: string, actor: string | null | undefined) {
    super(`${what}: provider money is released only by a Pet Wash admin (actor "${actor ?? ''}" refused)`);
  }
}

/** Raise ONE admin alert per item waiting for a human decision. Never throws. */
export async function flagPayoutForAdminReview(input: {
  kind: 'escrow' | 'super_app_payout' | 'booking';
  id: string;
  bookingId?: string | null;
  providerId?: string | number | null;
  amountIls?: number | null;
  reason: string;
}): Promise<void> {
  try {
    const { createOrUpdateAlert } = await import('../services/AlertEngine');
    await createOrUpdateAlert({
      dedupeKey: `payout_review:${input.kind}:${input.id}`,
      category: 'provider',
      severity: 'warning',
      title: 'Provider payout waiting for Pet Wash approval',
      message: `${input.kind} ${input.id}${input.bookingId ? ` · booking ${input.bookingId}` : ''}`
        + `${input.amountIls != null ? ` · ₪${Number(input.amountIls).toFixed(2)}` : ''} — ${input.reason}`,
      linkedEntityType: input.kind,
      linkedEntityId: input.id,
      source: 'auto_sweep',
      metadata: { providerId: input.providerId ?? null, bookingId: input.bookingId ?? null },
    });
  } catch {
    /* an alert failure must never turn into a release */
  }
}
