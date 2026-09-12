/**
 * Should the Pet Parent home show the green "show at the bay to redeem" card,
 * and should that card wear the PRESTIGE crown?  (CEO 2026-09-12)
 *
 * PrestigeHome already documents the rule at the top of the file — "the badge,
 * tier chip, and PRESTIGE wordmark only render when the user is actually
 * enrolled; a non-enrolled Pet Parent sees the clean home + a 'Join Prestige'
 * CTA instead of stolen valor" — but the membership card itself was never
 * gated. So the CEO's own account (nir.h@, NOT enrolled, every balance zero)
 * rendered a crowned PRESTIGE card with a live QR and the words "show at the
 * bay to redeem", directly underneath a button inviting him to JOIN Prestige.
 *
 * Two separate questions, deliberately kept apart:
 *
 *   show    — is there anything at this bay this account could actually
 *             redeem? Membership itself counts (member pricing at the K9000),
 *             and so does any positive balance.
 *   crowned — is this person actually a Prestige member? Balances do not buy
 *             the crown; only enrolment does.
 *
 * Pure and exported so the rule is testable without mounting the page.
 */

export interface RedeemCardInput {
  prestigeEnrolled: boolean;
  /** Wash credits from the wash-package ledger. */
  washCredits?: number | null;
  /** Cash wallet, in agorot. */
  cashCents?: number | null;
  /** eGift balance, in agorot. */
  giftCents?: number | null;
}

export interface RedeemCardDecision {
  /** Render the card at all — and, when false, do not mint a QR token either. */
  show: boolean;
  /** Render the PRESTIGE wordmark and the crown. */
  crowned: boolean;
}

/**
 * A balance is only real if it is a finite number strictly above zero.
 * The summary normalizer runs everything through `Number(... ?? 0)`, so a
 * missing field arrives as 0 and a malformed one as NaN — neither is credit,
 * and a negative balance is certainly not something to offer at a bay.
 */
function hasBalance(value: number | null | undefined): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

export function redeemCardDecision(input: RedeemCardInput): RedeemCardDecision {
  const crowned = input.prestigeEnrolled === true;
  const show =
    crowned ||
    hasBalance(input.washCredits) ||
    hasBalance(input.cashCents) ||
    hasBalance(input.giftCents);
  return { show, crowned };
}
