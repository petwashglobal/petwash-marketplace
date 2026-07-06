/**
 * Nayax Lynx — prepaid wash-card mint (the Cortina-FREE redeem-at-bay rail).
 *
 * IDEA (verified against the Lynx card API 2026-07-06): instead of the Cortina
 * integrator flow, when a customer redeems a pre-paid wash we mint a Nayax
 * SINGLE-USE prepaid QR card loaded with exactly the wash amount, tied to the
 * customer. The customer shows the card's QR at the bay; the Nayax reader deducts
 * it natively and the wash starts. Because the card is SINGLE-USE and for the
 * exact amount, a screenshot of the QR is worthless after one wash — no rotation
 * needed, no replay fraud. No SecretToken, no certification, no Nayax integrator.
 *
 * MONEY MODEL: the fiscal receipt already fired when the customer PAID us for the
 * wash-package / eGift / wallet credit (see IsraeliDigitalReceiptService). Minting
 * a card is moving that already-paid, already-receipted value onto a Nayax card so
 * it can be spent at the bay — it is NOT a new charge to the customer and issues
 * NO new fiscal document. Reconciliation: our ledger (customer paid) ↔ the Nayax
 * card balance (getPrepaidCard) ↔ the wash session.
 *
 * GATING: doubly dark — needs the Lynx auth wired (LynxClient) AND an explicit
 * LYNX_CARD_MINT_ENABLED=true, because this MOVES VALUE. Safe no-op otherwise.
 * Uses LynxClient's shared auth (token or operator-login session) via lynxRequest.
 */
import { lynxRequest, lynxIsWired } from './LynxClient';
import { logger } from '../lib/logger';

// ── Nayax card constants (from the Lynx Create Card reference) ────────────────
const CARD_TYPE_PREPAID = 33;
const PHYSICAL_TYPE_QR = 943237560;      // "QR Code" physical type
const DEFAULT_CURRENCY_ID = 1;           // ILS in the Nayax lookups (override via env)

function cfg() {
  return {
    // Extra gate on top of LynxClient: this action MOVES VALUE, so it stays dark
    // until explicitly enabled after a sandbox mint is verified.
    mintEnabled: (process.env.LYNX_CARD_MINT_ENABLED || '').trim().toLowerCase() === 'true',
    operatorId: process.env.LYNX_OPERATOR_ID?.trim() || undefined, // ActorID that issues the card
    currencyId: Number(process.env.LYNX_CURRENCY_ID || DEFAULT_CURRENCY_ID),
  };
}

/** Wired only when the Lynx auth is up AND card-mint is explicitly enabled AND an operator id is set. */
export function cardMintWired(): boolean {
  const c = cfg();
  return lynxIsWired() && c.mintEnabled && Boolean(c.operatorId);
}

export interface MintWashCardParams {
  userId: string;          // our customer id → ExternalApplicationUserID
  amountIls: number;       // exact wash price to load (money units, e.g. 55 = ₪55)
  holderName?: string;
  remarks?: string;        // audit note (e.g. "wash-package redemption <bookingId>")
}

export interface MintWashCardResult {
  ok: boolean;
  wired: boolean;
  cardUid?: string;        // our unique id for the card (also the redemption key)
  status: number;
  qr?: unknown;            // whatever QR/identifier the create response returns (verify on first mint)
  raw?: unknown;
  error?: string;
}

/** A collision-resistant, non-PII unique id for the card. */
function newCardUid(userId: string): string {
  const rand = Math.random().toString(36).slice(2, 10);
  return `PWWASH-${userId.slice(-8)}-${Date.now().toString(36)}-${rand}`.toUpperCase();
}

/**
 * Mint a SINGLE-USE prepaid QR card loaded with `amountIls`, tied to the customer.
 * Money-safe: doubly gated, single-use, exact amount, never logs card internals.
 */
export async function mintWashCard(p: MintWashCardParams): Promise<MintWashCardResult> {
  const c = cfg();
  if (!cardMintWired()) {
    return { ok: false, wired: false, status: 0, error: 'card_mint_not_wired' };
  }
  if (!(p.amountIls > 0)) {
    return { ok: false, wired: true, status: 0, error: 'invalid_amount' };
  }
  const cardUid = newCardUid(p.userId);
  const body = {
    CardDetails: {
      ActorID: Number(c.operatorId),
      CardUniqueIdentifier: cardUid,
      CardTypeID: CARD_TYPE_PREPAID,
      PhysicalTypeID: PHYSICAL_TYPE_QR,
      Status: 1,                                   // active
      ExternalApplicationUserID: p.userId,
      Notes: p.remarks ?? 'PetWash prepaid wash',
    },
    CardHolderDetails: {
      CardHolderName: p.holderName || 'PetWash Member',
      MemberTypeID: 801,
    },
    CardCreditAttributes: {
      CurrencyID: c.currencyId,
      Credit: p.amountIls,
      CreditTypeMoneyBit: true,                    // money credit
      CreditSingleUseBit: true,                    // ← spent after one wash (anti-replay)
      CreditAccumulateBit: false,
    },
  };

  const r = await lynxRequest('POST', '/operational/v2/cards', body);
  if (!r.ok) {
    logger.warn('[LynxCard] mint failed', { status: r.status, error: r.error, cardUidTail: cardUid.slice(-6) });
    return { ok: false, wired: true, status: r.status, error: r.error || `http_${r.status}`, raw: r.data };
  }
  logger.info('[LynxCard] single-use wash card minted', { cardUidTail: cardUid.slice(-6), amountIls: p.amountIls });
  // The QR the customer presents is derived from the create response (QrString /
  // Monyx id / the CardUniqueIdentifier) — surfaced raw here; confirm the exact
  // field on the FIRST sandbox mint, then map it explicitly.
  return { ok: true, wired: true, status: r.status, cardUid, qr: r.data, raw: r.data };
}

/** Read a card's live balance/usage — for reconciliation (did the bay deduct it?). */
export async function getPrepaidCard(cardId: string): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  if (!lynxIsWired()) return { ok: false, status: 0, error: 'lynx_not_wired' };
  const r = await lynxRequest('GET', `/operational/v1/cards/${encodeURIComponent(cardId)}/prepaid`);
  return { ok: r.ok, status: r.status, data: r.data, error: r.ok ? undefined : (r.error || `http_${r.status}`) };
}

/** Confirm a card can be used at a specific bay (machine) before we show its QR. */
export async function validateForMachine(machineId: string, cardUid: string): Promise<{ ok: boolean; status: number; data?: unknown; error?: string }> {
  if (!lynxIsWired()) return { ok: false, status: 0, error: 'lynx_not_wired' };
  const q = `?cardUniqueIdentifier=${encodeURIComponent(cardUid)}`;
  const r = await lynxRequest('GET', `/operational/v1/cards/validate-machine/${encodeURIComponent(machineId)}${q}`);
  return { ok: r.ok, status: r.status, data: r.data, error: r.ok ? undefined : (r.error || `http_${r.status}`) };
}

export const LynxCardService = { cardMintWired, mintWashCard, getPrepaidCard, validateForMachine };
