/**
 * PetWash™ Unified Voucher Service
 *
 * Financial instrument engine for:
 *   - WASH_PACKAGE vouchers (redeem washes at physical K9000 stations)
 *   - PLATFORM_CREDIT vouchers (redeem ILS credit on web/app platforms)
 *
 * Security model:
 *   1. Long-lived JWS (ES256) signs immutable fields at issuance — detects DB tampering
 *   2. Short-lived QR tokens (JWT, 3-minute TTL) for station/app redemption — anti-replay via jti registry
 *   3. Append-only hash-chained ledger — every state change creates an immutable audit entry
 *   4. Balance reconciled from ledger on every redemption — DB remaining fields are cache only
 *
 * CRITICAL: Server-side only. Never import into frontend.
 */

import crypto from "crypto";
import { SignJWT, importPKCS8, importSPKI, jwtVerify } from "jose";
import { eq, desc, and, sql } from "drizzle-orm";
import { db } from "../db";
import {
  unifiedVouchers,
  unifiedVoucherLedger,
  redeemedQrTokens,
  type UnifiedVoucher,
  type UnifiedVoucherLedgerEntry,
} from "../../shared/schema";
import { logger } from "../lib/logger";
import { walletService } from "./WalletService";

// ─────────────────────────────────────────────
// Key loading
// ─────────────────────────────────────────────

function loadPem(envVar: string | undefined): string {
  if (!envVar) return "";
  let key = envVar.replace(/\\n/g, "\n").trim();
  if (!key.includes("\n") && key.includes("-----BEGIN")) {
    const B_PRI = ["-----BEGIN", "PRIVATE KEY-----"].join(" ");
    const E_PRI = ["-----END", "PRIVATE KEY-----"].join(" ");
    const B_PUB = ["-----BEGIN", "PUBLIC KEY-----"].join(" ");
    const E_PUB = ["-----END", "PUBLIC KEY-----"].join(" ");
    key = key
      .replace(B_PRI, B_PRI + "\n")
      .replace(E_PRI, "\n" + E_PRI)
      .replace(B_PUB, B_PUB + "\n")
      .replace(E_PUB, "\n" + E_PUB);
  }
  return key;
}

const PRIVATE_KEY_PEM = loadPem(process.env.VOUCHER_ES256_PRIVATE_KEY_PEM);
const PUBLIC_KEY_PEM = loadPem(process.env.VOUCHER_ES256_PUBLIC_KEY_PEM);

const ISSUER = "petwash.unified-vouchers.2026";
const AUDIENCE_STATION = "petwash.stations";
const AUDIENCE_WEB = "petwash.web";
const QR_TOKEN_TTL_SECONDS = 180; // 3 minutes

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

export type VoucherType = "WASH_PACKAGE" | "PLATFORM_CREDIT";
export type VoucherStatus =
  | "ISSUED"
  | "ACTIVE"
  | "PARTIALLY_REDEEMED"
  | "REDEEMED"
  | "EXPIRED"
  | "CANCELLED";
export type DesignTheme = "pink" | "green" | "black" | "gold";
export type LedgerEvent = "ISSUE" | "REDEEM" | "REFUND" | "ADJUST" | "CANCEL" | "EXPIRE";
export type Channel = "STATION" | "WEB" | "APP" | "ADMIN";
export type SupportedLocale = "he" | "en" | "ar" | "fr" | "ru" | "es";

export interface IssueVoucherParams {
  voucherType: VoucherType;
  designTheme?: DesignTheme;
  // Value: supply valueIls for PLATFORM_CREDIT, washes for WASH_PACKAGE
  valueIls?: number;
  washCount?: number;
  currency?: string;
  expiresAt?: Date;
  // Recipient
  recipientDisplayName: string;
  recipientLocale?: SupportedLocale;
  recipientEmail?: string;
  recipientPhone?: string;
  personalMessage?: string;
  // Ownership
  purchasedByUserId?: string;
  purchasedByEmail?: string;
  ownerUserId?: string;
  // Purchase tracing
  purchaseOrderId?: string;
  nayaxTxId?: string;
  // Wallet pass readiness
  svgTemplateKey?: string;
  metadata?: Record<string, unknown>;
}

export interface RedeemParams {
  voucherId?: string;
  serialNumber?: string;
  qrToken?: string; // short-lived JWT (required for STATION channel)
  channel: Channel;
  // Amount to redeem
  amountIls?: number; // for PLATFORM_CREDIT
  washes?: number;    // for WASH_PACKAGE
  // Actor
  actorUserId?: string;
  actorRole?: string;
  // Context
  stationId?: string;
  locationLabel?: string;
  externalRef?: string;
  notes?: string;
}

export interface QrTokenPayload {
  jti: string;       // unique token id
  vid: string;       // voucher id
  sn: string;        // serial number
  scope: Channel[];  // allowed redemption channels
  exp: number;
  iss: string;
}

export interface VoucherWithBalance extends UnifiedVoucher {
  ledgerBalanceValue: number | null;
  ledgerBalanceWashes: number | null;
  ledgerEntries: UnifiedVoucherLedgerEntry[];
}

// ─────────────────────────────────────────────
// ID / Serial generation
// ─────────────────────────────────────────────

function generateVoucherId(): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const rand = crypto.randomBytes(5).toString("hex").toUpperCase();
  return `UV-${date}-${rand}`;
}

function generateSerial(): string {
  // 80-bit CSPRNG (10 bytes → 20 hex). "PWV-2026-" + 20 = 29 chars (col varchar(32)).
  // Was 32-bit (`randomBytes(2)`×2): birthday-collision ~29% at 50k vouchers AND low
  // enough to brute-force, since the serial doubles as the guest-voucher bearer value.
  // Raised to match the 80-bit member gift-card code. See collision-retry in issueVoucher.
  return `PWV-2026-${crypto.randomBytes(10).toString("hex").toUpperCase()}`;
}

// ─────────────────────────────────────────────
// Cryptographic helpers
// ─────────────────────────────────────────────

function canonicalImmutableFields(v: {
  id: string;
  serialNumber: string;
  voucherType: string;
  valueOriginal: string | null;
  washesOriginal: number | null;
  currency: string;
  purchasedByUserId?: string | null;
}): string {
  return JSON.stringify({
    id: v.id,
    sn: v.serialNumber,
    type: v.voucherType,
    valOrig: v.valueOriginal,
    washOrig: v.washesOriginal,
    cur: v.currency,
    buyer: v.purchasedByUserId ?? null,
  });
}

export function computeImmutableHash(fields: Parameters<typeof canonicalImmutableFields>[0]): string {
  return crypto
    .createHash("sha256")
    .update(canonicalImmutableFields(fields))
    .digest("hex");
}

async function signJws(payload: Record<string, unknown>, expirySeconds?: number): Promise<string> {
  if (!PRIVATE_KEY_PEM) throw new Error("VOUCHER_ES256_PRIVATE_KEY_PEM not configured");
  const privKey = await importPKCS8(PRIVATE_KEY_PEM, "ES256");
  let builder = new SignJWT(payload)
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer(ISSUER)
    .setIssuedAt();
  if (expirySeconds) builder = builder.setExpirationTime(`${expirySeconds}s`);
  return builder.sign(privKey);
}

async function verifyJws(token: string, audience?: string): Promise<Record<string, unknown>> {
  if (!PUBLIC_KEY_PEM) throw new Error("VOUCHER_ES256_PUBLIC_KEY_PEM not configured");
  const pubKey = await importSPKI(PUBLIC_KEY_PEM, "ES256");
  const opts: Parameters<typeof jwtVerify>[2] = { issuer: ISSUER };
  if (audience) opts.audience = audience;
  const { payload } = await jwtVerify(token, pubKey, opts);
  return payload as Record<string, unknown>;
}

// ─────────────────────────────────────────────
// Ledger helpers
// ─────────────────────────────────────────────

function computeEntryHash(
  voucherId: string,
  seqNo: number,
  event: string,
  deltaValue: string,
  deltaWashes: number,
  prevEntryHash: string | null,
  createdAt: string
): string {
  const canonical = JSON.stringify({
    vid: voucherId,
    seq: seqNo,
    evt: event,
    dv: deltaValue,
    dw: deltaWashes,
    prev: prevEntryHash,
    ts: createdAt,
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

// `conn` lets callers run this inside a transaction (so the read is covered by
// the same FOR UPDATE lock); defaults to the pooled db for existing callers.
async function getLastLedgerEntry(voucherId: string, conn: any = db): Promise<UnifiedVoucherLedgerEntry | null> {
  const rows = await conn
    .select()
    .from(unifiedVoucherLedger)
    .where(eq(unifiedVoucherLedger.voucherId, voucherId))
    .orderBy(desc(unifiedVoucherLedger.seqNo))
    .limit(1);
  return rows[0] ?? null;
}

async function appendLedgerEntry(params: {
  voucherId: string;
  event: LedgerEvent;
  deltaValue: number;
  deltaWashes: number;
  balanceValueAfter: number | null;
  balanceWashesAfter: number | null;
  channel: Channel;
  actorUserId?: string;
  actorRole?: string;
  stationId?: string;
  locationLabel?: string;
  externalRef?: string;
  qrTokenJti?: string;
  qrTokenNonce?: string;
  notes?: string;
}, conn: any = db): Promise<UnifiedVoucherLedgerEntry> {
  const lastEntry = await getLastLedgerEntry(params.voucherId, conn);
  const seqNo = lastEntry ? lastEntry.seqNo + 1 : 0;
  const prevEntryHash = lastEntry ? lastEntry.entryHash : null;
  const now = new Date().toISOString();

  const entryHash = computeEntryHash(
    params.voucherId,
    seqNo,
    params.event,
    params.deltaValue.toFixed(2),
    params.deltaWashes,
    prevEntryHash,
    now
  );

  const signedJws = await signJws({
    vid: params.voucherId,
    seq: seqNo,
    evt: params.event,
    hash: entryHash,
  });

  const [entry] = await conn
    .insert(unifiedVoucherLedger)
    .values({
      voucherId: params.voucherId,
      seqNo,
      prevEntryHash,
      entryHash,
      signedJws,
      event: params.event,
      deltaValue: params.deltaValue.toFixed(2),
      deltaWashes: params.deltaWashes,
      balanceValueAfter: params.balanceValueAfter !== null ? params.balanceValueAfter.toFixed(2) : null,
      balanceWashesAfter: params.balanceWashesAfter,
      channel: params.channel,
      actorUserId: params.actorUserId ?? null,
      actorRole: params.actorRole ?? "system",
      stationId: params.stationId ?? null,
      locationLabel: params.locationLabel ?? null,
      externalRef: params.externalRef ?? null,
      qrTokenJti: params.qrTokenJti ?? null,
      qrTokenNonce: params.qrTokenNonce ?? null,
      notes: params.notes ?? null,
    })
    .returning();

  return entry;
}

// ─────────────────────────────────────────────
// Ledger reconciliation (source of truth)
// ─────────────────────────────────────────────

interface LedgerBalance {
  valueRemaining: number | null;  // null for WASH_PACKAGE
  washesRemaining: number | null; // null for PLATFORM_CREDIT
}

async function reconcileFromLedger(voucher: UnifiedVoucher, conn: any = db): Promise<LedgerBalance> {
  const entries = await conn
    .select()
    .from(unifiedVoucherLedger)
    .where(eq(unifiedVoucherLedger.voucherId, voucher.id))
    .orderBy(unifiedVoucherLedger.seqNo);

  if (entries.length === 0) {
    return {
      valueRemaining: voucher.valueOriginal ? Number(voucher.valueOriginal) : null,
      washesRemaining: voucher.washesOriginal ?? null,
    };
  }

  const last = entries[entries.length - 1];
  return {
    valueRemaining: last.balanceValueAfter !== null ? Number(last.balanceValueAfter) : null,
    washesRemaining: last.balanceWashesAfter ?? null,
  };
}

// ─────────────────────────────────────────────
// Integrity verification
// ─────────────────────────────────────────────

export async function verifyVoucherIntegrity(
  voucher: UnifiedVoucher
): Promise<{ valid: boolean; reason?: string }> {
  try {
    const expectedHash = computeImmutableHash({
      id: voucher.id,
      serialNumber: voucher.serialNumber,
      voucherType: voucher.voucherType,
      valueOriginal: voucher.valueOriginal,
      washesOriginal: voucher.washesOriginal,
      currency: voucher.currency,
      purchasedByUserId: voucher.purchasedByUserId,
    });

    if (expectedHash !== voucher.immutableHash) {
      return { valid: false, reason: "IMMUTABLE_HASH_MISMATCH: DB fields tampered" };
    }

    const payload = await verifyJws(voucher.signedJws);
    if (payload.hash !== expectedHash || payload.vid !== voucher.id) {
      return { valid: false, reason: "JWS_PAYLOAD_MISMATCH: signature does not match fields" };
    }

    return { valid: true };
  } catch (err: any) {
    return { valid: false, reason: `VERIFY_ERROR: ${err.message}` };
  }
}

// ─────────────────────────────────────────────
// Issue voucher (public API)
// ─────────────────────────────────────────────

export async function issueVoucher(params: IssueVoucherParams): Promise<UnifiedVoucher> {
  if (params.voucherType === "PLATFORM_CREDIT" && !params.valueIls) {
    throw new Error("PLATFORM_CREDIT voucher requires valueIls");
  }
  if (params.voucherType === "WASH_PACKAGE" && !params.washCount) {
    throw new Error("WASH_PACKAGE voucher requires washCount");
  }

  const currency = params.currency ?? "ILS";
  const valueOriginal =
    params.voucherType === "PLATFORM_CREDIT" ? params.valueIls!.toFixed(2) : null;
  const washesOriginal = params.voucherType === "WASH_PACKAGE" ? params.washCount! : null;

  // Insert with a small retry on a UNIQUE collision of id/serial. At 80-bit entropy a
  // collision is astronomically unlikely, but a duplicate-key throw on a PAID guest
  // order would otherwise strand it as "paid-but-not-issued". Regenerate id+serial (and
  // their signature) and retry, so a genuine buyer always gets their voucher.
  let voucher: any;
  for (let attempt = 0; ; attempt++) {
    const id = generateVoucherId();
    const serialNumber = generateSerial();
    const immutableHash = computeImmutableHash({
      id,
      serialNumber,
      voucherType: params.voucherType,
      valueOriginal,
      washesOriginal,
      currency,
      purchasedByUserId: params.purchasedByUserId ?? null,
    });
    const signedJws = await signJws({ vid: id, sn: serialNumber, hash: immutableHash });
    try {
      [voucher] = await db
        .insert(unifiedVouchers)
        .values({
          id,
          serialNumber,
          voucherType: params.voucherType,
          designTheme: params.designTheme ?? "pink",
          status: "ISSUED",
          currency,
          valueOriginal,
          valueRemaining: valueOriginal,
          washesOriginal,
          washesRemaining: washesOriginal,
          recipientDisplayName: params.recipientDisplayName,
          recipientLocale: params.recipientLocale ?? "he",
          recipientEmail: params.recipientEmail ?? null,
          recipientPhone: params.recipientPhone ?? null,
          personalMessage: params.personalMessage ?? null,
          purchasedByUserId: params.purchasedByUserId ?? null,
          purchasedByEmail: params.purchasedByEmail ?? null,
          ownerUserId: params.ownerUserId ?? null,
          purchaseOrderId: params.purchaseOrderId ?? null,
          nayaxTxId: params.nayaxTxId ?? null,
          svgTemplateKey: params.svgTemplateKey ?? null,
          expiresAt: params.expiresAt ?? null,
          metadata: params.metadata ?? null,
          immutableHash,
          signedJws,
        })
        .returning();
      break;
    } catch (e: any) {
      const isUniqueViolation =
        e?.code === "23505" || /duplicate key|unique constraint/i.test(String(e?.message || ""));
      if (isUniqueViolation && attempt < 3) {
        logger.warn("[UnifiedVoucher] serial/id collision — regenerating", { attempt });
        continue;
      }
      throw e;
    }
  }

  // Genesis ledger entry (seqNo = 0)
  await appendLedgerEntry({
    voucherId: voucher.id,
    event: "ISSUE",
    deltaValue: 0,
    deltaWashes: 0,
    balanceValueAfter: valueOriginal ? Number(valueOriginal) : null,
    balanceWashesAfter: washesOriginal,
    channel: "ADMIN",
    actorUserId: params.purchasedByUserId ?? "system",
    actorRole: "system",
    notes: `Voucher issued — type: ${params.voucherType}`,
  });

  logger.info("[UnifiedVoucher] Issued", {
    id: voucher.id,
    serial: voucher.serialNumber,
    type: params.voucherType,
    value: valueOriginal,
    washes: washesOriginal,
  });

  return voucher;
}

// ─────────────────────────────────────────────
// Generate short-lived QR token
// ─────────────────────────────────────────────

export async function generateQrToken(
  voucherId: string,
  allowedChannels: Channel[] = ["STATION", "APP"]
): Promise<string> {
  const [voucher] = await db
    .select()
    .from(unifiedVouchers)
    .where(eq(unifiedVouchers.id, voucherId))
    .limit(1);
  if (!voucher) throw new Error("Voucher not found");

  const integrity = await verifyVoucherIntegrity(voucher);
  if (!integrity.valid) throw new Error(`Voucher integrity failed: ${integrity.reason}`);

  const jti = crypto.randomBytes(16).toString("hex");

  const token = await signJws(
    {
      jti,
      vid: voucher.id,
      sn: voucher.serialNumber,
      scope: allowedChannels,
      type: voucher.voucherType,
    },
    QR_TOKEN_TTL_SECONDS
  );

  return token;
}

// ─────────────────────────────────────────────
// Verify & extract QR token (anti-replay)
// ─────────────────────────────────────────────

async function verifyQrToken(token: string): Promise<QrTokenPayload> {
  const payload = await verifyJws(token);
  const jti = payload.jti as string;
  const vid = payload.vid as string;

  if (!jti || !vid) throw new Error("QR token missing required claims");

  // Anti-replay: check jti not already used
  const [existing] = await db
    .select()
    .from(redeemedQrTokens)
    .where(eq(redeemedQrTokens.jti, jti))
    .limit(1);

  if (existing) throw new Error("QR token already redeemed (replay detected)");

  return payload as unknown as QrTokenPayload;
}

// ─────────────────────────────────────────────
// Redeem voucher (core engine)
// ─────────────────────────────────────────────

export interface RedeemResult {
  success: boolean;
  voucherId: string;
  serialNumber: string;
  voucherType: VoucherType;
  redeemedValue?: number;
  redeemedWashes?: number;
  balanceValueAfter?: number;
  balanceWashesAfter?: number;
  newStatus: VoucherStatus;
  ledgerSeqNo: number;
  traceId: string;
}

export async function redeemVoucher(params: RedeemParams): Promise<RedeemResult> {
  const traceId = crypto.randomBytes(6).toString("hex");

  // ── 1. Load voucher ──
  let voucher: UnifiedVoucher | undefined;
  if (params.voucherId) {
    const [v] = await db
      .select()
      .from(unifiedVouchers)
      .where(eq(unifiedVouchers.id, params.voucherId))
      .limit(1);
    voucher = v;
  } else if (params.serialNumber) {
    const [v] = await db
      .select()
      .from(unifiedVouchers)
      .where(eq(unifiedVouchers.serialNumber, params.serialNumber))
      .limit(1);
    voucher = v;
  }
  if (!voucher) throw new Error("Voucher not found");

  // ── 2. Integrity check ──
  const integrity = await verifyVoucherIntegrity(voucher);
  if (!integrity.valid) {
    logger.error("[UnifiedVoucher] Integrity FAIL on redeem", { traceId, reason: integrity.reason });
    throw new Error(`Voucher integrity check failed: ${integrity.reason}`);
  }

  // ── 3. Status checks ──
  if (voucher.status === "CANCELLED") throw new Error("Voucher is cancelled");
  if (voucher.status === "REDEEMED") throw new Error("Voucher is fully redeemed");
  if (voucher.status === "EXPIRED") throw new Error("Voucher is expired");
  if (voucher.expiresAt && voucher.expiresAt < new Date()) {
    await db
      .update(unifiedVouchers)
      .set({ status: "EXPIRED", updatedAt: new Date() })
      .where(eq(unifiedVouchers.id, voucher.id));
    throw new Error("Voucher has expired");
  }

  // ── 4. QR token verification (required for STATION channel) ──
  let qrJti: string | undefined;
  let qrTokenPayload: QrTokenPayload | undefined;
  if (params.channel === "STATION") {
    if (!params.qrToken) throw new Error("QR token required for STATION channel");
    qrTokenPayload = await verifyQrToken(params.qrToken);
    if (qrTokenPayload.vid !== voucher.id) throw new Error("QR token does not match voucher");
    if (!qrTokenPayload.scope.includes("STATION")) throw new Error("QR token not valid for STATION");
    qrJti = qrTokenPayload.jti;
  } else if (params.qrToken) {
    // Optional QR token on other channels — verify but don't enforce
    try {
      qrTokenPayload = await verifyQrToken(params.qrToken);
      if (qrTokenPayload.vid !== voucher.id) throw new Error("QR token mismatch");
      qrJti = qrTokenPayload.jti;
    } catch (e: any) {
      logger.warn("[UnifiedVoucher] Optional QR token invalid", { traceId, error: e.message });
    }
  }

  // ── 5–8. Reconcile, validate, and write — all inside ONE transaction with a
  // row lock on the voucher (SELECT … FOR UPDATE) so two concurrent redeems
  // cannot both read the same remaining balance and double-spend. A second
  // redeem blocks at the lock until the first commits, then reconciles against
  // the now-committed ledger. Mirrors confirmRedemption (PR #712).
  // The wallet bridge (step 9) stays OUTSIDE the tx on purpose: addCredits is
  // idempotent on (wallet, source, voucherId) and uses its own connection.
  let deltaValue = 0;
  let deltaWashes = 0;
  let balanceValueAfter: number | null = null;
  let balanceWashesAfter: number | null = null;
  let newStatus: VoucherStatus = "PARTIALLY_REDEEMED";
  let ledgerSeqNo = 0;

  await (db as any).transaction(async (tx: typeof db) => {
    // Lock the voucher row — a concurrent redeem blocks here until we commit.
    await tx.execute(sql`SELECT id FROM unified_vouchers WHERE id = ${voucher.id} FOR UPDATE`);

    // Re-check status UNDER the lock (the checks above are fast-fail only).
    const [locked] = await tx
      .select()
      .from(unifiedVouchers)
      .where(eq(unifiedVouchers.id, voucher.id))
      .limit(1);
    if (!locked) throw new Error("Voucher not found");
    if (locked.status === "CANCELLED") throw new Error("Voucher is cancelled");
    if (locked.status === "REDEEMED") throw new Error("Voucher is fully redeemed");
    if (locked.status === "EXPIRED") throw new Error("Voucher is expired");
    if (locked.expiresAt && locked.expiresAt < new Date()) throw new Error("Voucher has expired");

    // Reconcile balance from ledger (source of truth) under the lock.
    const ledgerBalance = await reconcileFromLedger(locked, tx);
    const valueRemaining = ledgerBalance.valueRemaining;
    const washesRemaining = ledgerBalance.washesRemaining;
    balanceValueAfter = valueRemaining;
    balanceWashesAfter = washesRemaining;

    // Validate requested redemption amount against the locked balance.
    if (locked.voucherType === "PLATFORM_CREDIT") {
      if (!params.amountIls || params.amountIls <= 0) throw new Error("amountIls required and must be > 0");
      if (valueRemaining === null) throw new Error("Ledger has no value balance for this voucher");
      if (params.amountIls > valueRemaining + 0.001) {
        throw new Error(
          `Insufficient credit: requested ${params.amountIls} ILS, remaining ${valueRemaining.toFixed(2)} ILS`
        );
      }
      deltaValue = Math.min(params.amountIls, valueRemaining);
      balanceValueAfter = Math.max(0, valueRemaining - deltaValue);
    } else if (locked.voucherType === "WASH_PACKAGE") {
      const washes = params.washes ?? 1;
      if (washes <= 0) throw new Error("washes must be > 0");
      if (washesRemaining === null) throw new Error("Ledger has no wash balance for this voucher");
      if (washes > washesRemaining) {
        throw new Error(`Insufficient washes: requested ${washes}, remaining ${washesRemaining}`);
      }
      deltaWashes = washes;
      balanceWashesAfter = washesRemaining - deltaWashes;
    }

    // Determine new status.
    newStatus = "PARTIALLY_REDEEMED";
    if (
      (locked.voucherType === "PLATFORM_CREDIT" && balanceValueAfter! <= 0.001) ||
      (locked.voucherType === "WASH_PACKAGE" && balanceWashesAfter! <= 0)
    ) {
      newStatus = "REDEEMED";
    }

    // Mark QR jti as used (unique constraint + row lock both guard replay).
    if (qrJti) {
      await tx.insert(redeemedQrTokens).values({
        jti: qrJti,
        voucherId: locked.id,
        channel: params.channel,
        stationId: params.stationId ?? null,
        actorUserId: params.actorUserId ?? null,
        externalRef: params.externalRef ?? null,
        tokenExp: qrTokenPayload?.exp ? new Date(qrTokenPayload.exp * 1000) : null,
      });
    }

    // Append immutable ledger entry (atomic with the voucher cache update).
    const ledgerEntry = await appendLedgerEntry({
      voucherId: locked.id,
      event: "REDEEM",
      deltaValue,
      deltaWashes,
      balanceValueAfter: balanceValueAfter !== null ? balanceValueAfter : null,
      balanceWashesAfter: balanceWashesAfter !== null ? balanceWashesAfter : null,
      channel: params.channel,
      actorUserId: params.actorUserId ?? null,
      actorRole: params.actorRole ?? "customer",
      stationId: params.stationId ?? null,
      locationLabel: params.locationLabel ?? null,
      externalRef: params.externalRef ?? null,
      qrTokenJti: qrJti ?? null,
      notes: params.notes ?? null,
    }, tx);
    ledgerSeqNo = ledgerEntry.seqNo;

    // Update voucher cache fields.
    await tx
      .update(unifiedVouchers)
      .set({
        status: newStatus,
        valueRemaining: balanceValueAfter !== null ? balanceValueAfter.toFixed(2) : null,
        washesRemaining: balanceWashesAfter !== null ? balanceWashesAfter : null,
        lastRedeemedAt: new Date(),
        activatedAt: locked.activatedAt ?? new Date(),
        fullyRedeemedAt: newStatus === "REDEEMED" ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(unifiedVouchers.id, locked.id));
  });

  // ── 9. Wallet bridge: credit egift balance for PLATFORM_CREDIT vouchers ──
  // K9000 audit #6 fix: bridge failures used to log-and-forget, so a deadlock,
  // restart, or network hiccup between the voucher-tx commit and this call
  // meant the voucher was spent but the wallet was never credited — customer
  // permanently lost the ILS. Now on failure we persist a wallet_anomaly_alerts
  // row so ops can retry the bridge write by hand; voucher ledger is already
  // correct at this point, only the wallet mirror needs re-application.
  if (
    voucher.voucherType === "PLATFORM_CREDIT" &&
    deltaValue > 0 &&
    (params.channel === "WEB" || params.channel === "APP")
  ) {
    const userId = voucher.ownerUserId ?? voucher.purchasedByUserId;
    if (userId) {
      const amountCents = Math.round(deltaValue * 100);
      try {
        await walletService.addCredits(
          userId,
          "egift",
          amountCents,
          "unified_voucher",
          voucher.id,
          "Voucher PLATFORM_CREDIT redeemed"
        );
        logger.info("[UnifiedVoucher] Wallet bridge: egift credited", {
          traceId,
          userId,
          amountCents,
          voucherId: voucher.id,
        });
      } catch (walletErr: any) {
        logger.error("[UnifiedVoucher] Wallet bridge FAILED — logging anomaly for ops reconcile", {
          traceId, userId, amountCents, voucherId: voucher.id, error: walletErr?.message,
        });
        try {
          const { pool } = await import("../db");
          await pool.query(
            `INSERT INTO wallet_anomaly_alerts
               (alert_id, user_id, alert_type, severity, context_json, detected_at, resolved)
             VALUES ($1, $2, 'voucher_wallet_credit_failed', 'critical', $3, NOW(), false)
             ON CONFLICT DO NOTHING`,
            [
              `VOUCHER-BRIDGE-${voucher.id}-${Date.now()}`,
              userId,
              JSON.stringify({
                voucherId: voucher.id,
                serialNumber: voucher.serialNumber,
                amountCents,
                channel: params.channel,
                origin: "unifiedVoucherService.redeem",
                error: String(walletErr?.message || "unknown"),
                traceId,
              }),
            ],
          );
        } catch (anomalyErr: any) {
          logger.error("[UnifiedVoucher] Anomaly log write ALSO failed — manual ops intervention required", {
            traceId, userId, voucherId: voucher.id, error: anomalyErr?.message,
          });
        }
      }
    }
  }

  logger.info("[UnifiedVoucher] Redeemed", {
    traceId,
    voucherId: voucher.id,
    serial: voucher.serialNumber,
    channel: params.channel,
    deltaValue,
    deltaWashes,
    newStatus,
  });

  return {
    success: true,
    voucherId: voucher.id,
    serialNumber: voucher.serialNumber,
    voucherType: voucher.voucherType as VoucherType,
    redeemedValue: deltaValue > 0 ? deltaValue : undefined,
    redeemedWashes: deltaWashes > 0 ? deltaWashes : undefined,
    balanceValueAfter: balanceValueAfter ?? undefined,
    balanceWashesAfter: balanceWashesAfter ?? undefined,
    newStatus,
    ledgerSeqNo,
    traceId,
  };
}

// ─────────────────────────────────────────────
// Load voucher with full ledger balance
// ─────────────────────────────────────────────

export async function getVoucherWithBalance(voucherId: string): Promise<VoucherWithBalance> {
  const [voucher] = await db
    .select()
    .from(unifiedVouchers)
    .where(eq(unifiedVouchers.id, voucherId))
    .limit(1);
  if (!voucher) throw new Error("Voucher not found");

  const entries = await db
    .select()
    .from(unifiedVoucherLedger)
    .where(eq(unifiedVoucherLedger.voucherId, voucherId))
    .orderBy(unifiedVoucherLedger.seqNo);

  const balance = await reconcileFromLedger(voucher);

  return {
    ...voucher,
    ledgerBalanceValue: balance.valueRemaining,
    ledgerBalanceWashes: balance.washesRemaining,
    ledgerEntries: entries,
  };
}

// ─────────────────────────────────────────────
// Adjust / Cancel (admin operations)
// ─────────────────────────────────────────────

export async function cancelVoucher(
  voucherId: string,
  reason: string,
  actorUserId: string
): Promise<void> {
  const [voucher] = await db
    .select()
    .from(unifiedVouchers)
    .where(eq(unifiedVouchers.id, voucherId))
    .limit(1);
  if (!voucher) throw new Error("Voucher not found");
  if (voucher.status === "REDEEMED") throw new Error("Cannot cancel a fully redeemed voucher");
  if (voucher.status === "CANCELLED") throw new Error("Voucher already cancelled");

  const balance = await reconcileFromLedger(voucher);

  await appendLedgerEntry({
    voucherId,
    event: "CANCEL",
    deltaValue: 0,
    deltaWashes: 0,
    balanceValueAfter: 0,
    balanceWashesAfter: 0,
    channel: "ADMIN",
    actorUserId,
    actorRole: "admin",
    notes: reason,
  });

  await db
    .update(unifiedVouchers)
    .set({
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(unifiedVouchers.id, voucherId));
}

export async function adjustVoucherBalance(
  voucherId: string,
  params: {
    deltaValue?: number;
    deltaWashes?: number;
    reason: string;
    actorUserId: string;
  }
): Promise<void> {
  const [voucher] = await db
    .select()
    .from(unifiedVouchers)
    .where(eq(unifiedVouchers.id, voucherId))
    .limit(1);
  if (!voucher) throw new Error("Voucher not found");
  if (["CANCELLED", "REDEEMED", "EXPIRED"].includes(voucher.status)) {
    throw new Error(`Cannot adjust a ${voucher.status} voucher`);
  }

  const balance = await reconcileFromLedger(voucher);
  const newValueAfter = balance.valueRemaining !== null
    ? Math.max(0, balance.valueRemaining + (params.deltaValue ?? 0))
    : null;
  const newWashesAfter = balance.washesRemaining !== null
    ? Math.max(0, balance.washesRemaining + (params.deltaWashes ?? 0))
    : null;

  await appendLedgerEntry({
    voucherId,
    event: "ADJUST",
    deltaValue: -(params.deltaValue ?? 0), // negative delta = credit back
    deltaWashes: -(params.deltaWashes ?? 0),
    balanceValueAfter: newValueAfter,
    balanceWashesAfter: newWashesAfter,
    channel: "ADMIN",
    actorUserId: params.actorUserId,
    actorRole: "admin",
    notes: params.reason,
  });

  await db
    .update(unifiedVouchers)
    .set({
      valueRemaining: newValueAfter !== null ? newValueAfter.toFixed(2) : null,
      washesRemaining: newWashesAfter !== null ? newWashesAfter : null,
      updatedAt: new Date(),
    })
    .where(eq(unifiedVouchers.id, voucherId));
}
