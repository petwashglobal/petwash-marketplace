/**
 * Deal Gate feature flags (CEO master spec 2026-06-27).
 *
 * ALL DEFAULT OFF. When a flag is OFF the system MUST NOT move live money for that
 * action — but the code, tables, status, and audit logs still run and the fee is
 * still CALCULATED in shadow mode ("would apply") so admin/testing can see it.
 * When PetWash admin flips a flag ON (env), the same calculated amount becomes a
 * real charge/refund. No missing architecture; no live-money risk while OFF.
 */
function flag(name: string): boolean {
  return process.env[name] === "true";
}

export const DEAL_GATE_FLAGS = {
  /** Charge the calculated late-cancellation fee for real. */
  get CANCELLATION_FEES_ENABLED() { return flag("CANCELLATION_FEES_ENABLED"); },
  /** Charge the calculated no-show fee for real. */
  get NO_SHOW_FEES_ENABLED() { return flag("NO_SHOW_FEES_ENABLED"); },
  /** Retain / recover the card/processor fee on refunds where legally disclosed. */
  get CARD_FEE_RECOVERY_ENABLED() { return flag("CARD_FEE_RECOVERY_ENABLED"); },
  /** Execute refunds automatically (vs record a pending_review refund for admin). */
  get AUTO_REFUNDS_ENABLED() { return flag("AUTO_REFUNDS_ENABLED"); },
  /** Pay provider compensation for late customer cancellations / no-shows. */
  get PROVIDER_COMPENSATION_ENABLED() { return flag("PROVIDER_COMPENSATION_ENABLED"); },
} as const;

export type DealGateFlagName = keyof typeof DEAL_GATE_FLAGS;

/** Snapshot for admin/diagnostics — shows which money actions are live vs shadow. */
export function dealGateFlagSnapshot(): Record<DealGateFlagName, boolean> {
  return {
    CANCELLATION_FEES_ENABLED: DEAL_GATE_FLAGS.CANCELLATION_FEES_ENABLED,
    NO_SHOW_FEES_ENABLED: DEAL_GATE_FLAGS.NO_SHOW_FEES_ENABLED,
    CARD_FEE_RECOVERY_ENABLED: DEAL_GATE_FLAGS.CARD_FEE_RECOVERY_ENABLED,
    AUTO_REFUNDS_ENABLED: DEAL_GATE_FLAGS.AUTO_REFUNDS_ENABLED,
    PROVIDER_COMPENSATION_ENABLED: DEAL_GATE_FLAGS.PROVIDER_COMPENSATION_ENABLED,
  };
}
