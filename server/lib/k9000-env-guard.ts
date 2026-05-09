/**
 * K9000 Environment Presence Guard (PR-K).
 *
 * Single source of truth for "is the K9000 hardware command path
 * configured for this process".
 *
 * Background — forensic audit (PR #202) finding #11:
 *   In any environment where MACHINE_ACTIVATION_URL is unset, the
 *   prior wash + redeem routes either:
 *     • returned 503 (production only), or
 *     • logged a "DEMO MODE" warning and proceeded to debit the
 *       wallet / accept a Nayax-authorised charge while the
 *       physical machine was never commanded.
 *   The second branch is "fake machine success" and is forbidden
 *   per Rule H (PR-CI-PAYMENT-MODE):
 *     "No fake success. No log-only payout. No customer balance
 *      mutation without verified payment source."
 *
 * Resolution — env-agnostic guard:
 *   • If MACHINE_ACTIVATION_URL is set → OK. Routes attempt the
 *     real machine command as before.
 *   • If MACHINE_ACTIVATION_URL is unset → routes refuse the flow
 *     with HTTP 503 BEFORE any wallet debit, regardless of
 *     NODE_ENV. Developers wishing to exercise the K9000 path
 *     locally must point MACHINE_ACTIVATION_URL at a local stub.
 *
 * Boundaries:
 *   • Pure env read. No DB. No vendor SDK. No money logic.
 *   • Does NOT decide HTTP response shape; callers keep their own
 *     localised error strings (Hebrew + English) and any
 *     route-specific fields like correlationId.
 *   • Does NOT touch Nayax / Tranzila / SUMIT / Stripe.
 */

export function isK9000MachineConfigured(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return !!env.MACHINE_ACTIVATION_URL;
}
