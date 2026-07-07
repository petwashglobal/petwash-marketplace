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
import { lynxRequest, lynxIsWired, getActorHierarchy } from './LynxClient';
import { logger } from '../lib/logger';

// ── Nayax card constants (from the Lynx Create Card reference) ────────────────
const CARD_TYPE_PREPAID = 33;
const PHYSICAL_TYPE_QR = 943237560;      // "QR Code" physical type
const DEFAULT_CURRENCY_ID = 1;           // ILS in the Nayax lookups (override via env)
const CARD_VALID_YEARS = 2;              // CardDateRules window for a single-use wash card
// CardHolderDetails.CountryID is MANDATORY on v2 and must be Nayax's INTERNAL
// CountryID — NOT the ISO numeric (per the sandbox-verified nayax-lynx-prepaid-cards
// skill: "card endpoints use Nayax's CountryID (225 for US), not 840"). So we resolve
// Israel's value from Get-Countries at mint time (see resolveCountryId), never hardcode
// the ISO 376. Override with LYNX_COUNTRY_ID if you already know the Nayax value.

function cfg() {
  return {
    // Extra gate on top of LynxClient: this action MOVES VALUE, so it stays dark
    // until explicitly enabled after a sandbox mint is verified.
    mintEnabled: (process.env.LYNX_CARD_MINT_ENABLED || '').trim().toLowerCase() === 'true',
    operatorId: process.env.LYNX_OPERATOR_ID?.trim() || undefined, // ActorID that issues the card
    currencyId: Number(process.env.LYNX_CURRENCY_ID || DEFAULT_CURRENCY_ID),
  };
}

/** Wired when the Lynx auth is up AND card-mint is explicitly enabled. The operator
 *  ActorID is resolved (env override or auto-discovered) at mint time. */
export function cardMintWired(): boolean {
  return lynxIsWired() && cfg().mintEnabled;
}

// The operator ActorID that issues cards: env override, else auto-discovered from
// the connected Lynx account and cached — so LYNX_OPERATOR_ID need not be set by hand.
let cachedOperatorId: string | null = null;
function extractOperatorActorId(data: any): string | null {
  const nodes: any[] = Array.isArray(data) ? data : (Array.isArray(data?.Hierarchy) ? data.Hierarchy : [data]);
  for (const n of nodes) if (n && n.OperatorActorID) return String(n.OperatorActorID); // explicit operator
  for (const n of nodes) if (n && n.ParentActorID == null && n.ActorID) return String(n.ActorID); // hierarchy root
  for (const n of nodes) if (n && n.ActorID) return String(n.ActorID); // fallback: first actor
  return null;
}
/** Resolve the issuing operator ActorID: env override, else discover it once. */
export async function resolveOperatorId(): Promise<string | null> {
  const envId = cfg().operatorId;
  if (envId) return envId;
  if (cachedOperatorId) return cachedOperatorId;
  const r = await getActorHierarchy();
  if (!r.ok) { logger.warn('[LynxCard] could not discover operator ActorID', { status: r.status }); return null; }
  const id = extractOperatorActorId(r.data);
  if (id) { cachedOperatorId = id; logger.info('[LynxCard] discovered operator ActorID', { actorId: id }); }
  return cachedOperatorId;
}

// Nayax's INTERNAL CountryID for Israel (NOT the ISO 376). Resolved once from the
// Get-Countries lookup — which returns both CountryID (Nayax) and CountryCode/ISO —
// so we always send the value Nayax's card endpoint actually expects.
let cachedCountryId: number | null = null;
export async function resolveCountryId(): Promise<number | null> {
  const envId = Number((process.env.LYNX_COUNTRY_ID || '').trim());
  if (Number.isFinite(envId) && envId > 0) return envId;
  if (cachedCountryId != null) return cachedCountryId;
  // Filter by Israel's dialing code (972) to get just its row.
  const r = await lynxRequest('GET', '/operational/v1/countries?DialCode=972');
  const list: any[] = Array.isArray(r.data)
    ? r.data
    : (Array.isArray((r.data as any)?.items) ? (r.data as any).items : []);
  const il = list.find((c) => c?.CountryCode === 'IL' || c?.CountryISONumericCode === 376 || c?.CountryDialingCode === 972);
  const id = il?.CountryID != null ? Number(il.CountryID) : NaN;
  if (Number.isFinite(id) && id > 0) {
    cachedCountryId = id;
    logger.info('[LynxCard] resolved Israel CountryID from Get-Countries', { countryId: id });
  } else {
    logger.warn('[LynxCard] could not resolve Israel CountryID', { status: r.status });
  }
  return cachedCountryId;
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
export async function mintWashCard(p: MintWashCardParams, opts?: { adminTest?: boolean }): Promise<MintWashCardResult> {
  const c = cfg();
  if (!lynxIsWired()) {
    return { ok: false, wired: false, status: 0, error: 'lynx_not_wired' };
  }
  // Customer mints require the production flag. A super-admin adminTest (one small,
  // audited card) bypasses it so the rail can be PROVEN before it's turned on live.
  if (!opts?.adminTest && !c.mintEnabled) {
    return { ok: false, wired: true, status: 0, error: 'card_mint_disabled' };
  }
  if (!(p.amountIls > 0)) {
    return { ok: false, wired: true, status: 0, error: 'invalid_amount' };
  }
  const operatorId = await resolveOperatorId();
  if (!operatorId) {
    return { ok: false, wired: true, status: 0, error: 'operator_id_unresolved' };
  }
  // Fail CLOSED on the CountryID rather than send a wrong (ISO) value.
  const countryId = await resolveCountryId();
  if (!countryId) {
    return { ok: false, wired: true, status: 0, error: 'country_id_unresolved' };
  }
  const cardUid = newCardUid(p.userId);
  const nowIso = new Date().toISOString();
  const expiryIso = new Date(Date.now() + CARD_VALID_YEARS * 365 * 24 * 60 * 60 * 1000).toISOString();
  const body = {
    CardDetails: {
      ActorID: Number(operatorId),
      CardUniqueIdentifier: cardUid,
      CardTypeID: CARD_TYPE_PREPAID,
      PhysicalTypeID: PHYSICAL_TYPE_QR,
      Status: 1,                                   // active
      ExternalApplicationUserID: p.userId,
      Notes: p.remarks ?? 'PetWash prepaid wash',
    },
    CardHolderDetails: {
      CardHolderName: p.holderName || 'PetWash Member',
      CountryID: countryId,                         // Nayax's internal CountryID (resolved), MANDATORY
      MemberTypeID: 801,
    },
    CardCreditAttributes: {
      CurrencyID: c.currencyId,
      Credit: p.amountIls,
      CreditTypeMoneyBit: true,                    // money credit
      CreditSingleUseBit: true,                    // ← spent after one wash (anti-replay)
      CreditAccumulateBit: false,
    },
    // v2 REQUIRES CardDateRules (ActivationDate + ExpirationDate) or the request fails.
    CardDateRules: {
      ActivationDate: nowIso,
      ExpirationDate: expiryIso,
    },
  };

  // SHAPE NOTE: this NESTED body follows the official Nayax v2 docs. The
  // nayax-lynx-prepaid-cards skill shows a FLAT body for /v2/cards — the two
  // authoritative sources conflict. The first admin test-mint is the tiebreaker:
  // if a nested body 400s, flatten CardDetails/CardHolderDetails/CardCreditAttributes
  // to top level and keep CardDateRules. Do NOT enable live mints until a sandbox
  // mint returns 2xx with a usable QR.
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

export const LynxCardService = { cardMintWired, resolveOperatorId, mintWashCard, getPrepaidCard, validateForMachine };
