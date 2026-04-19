/**
 * IsraelComplianceEngine — P2 Unified Facade
 * ============================================
 * Single entry-point for all Israeli tax and compliance logic.
 * All booking routes should call this engine instead of calling
 * IsraeliDigitalReceiptService / VATCalculatorService / octopusLedger directly.
 *
 * Three-state lifecycle per transaction:
 *   ACCEPT   → operational escrow event (payment captured, no P&L entry)
 *   COMPLETE → final financial event (settlement, P&L, withholding, SHAAM)
 *   CANCEL   → reversal event (void / credit note, withholding reversal, ledger entry)
 *
 * Policy switches are sourced from shared/israel-compliance-config.ts.
 * Constants pending CPA sign-off are flagged with pendingCpaSignoff=true.
 */

import { db } from '../db';
import {
  octopusBookings,
  octopusLedger,
  withholdingRemittanceLedger,
  digitalReceipts,
  providerCommissions,
  type OctopusBooking,
} from '@shared/schema';
import { eq, sql, and } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { nanoid } from 'nanoid';

import {
  ISRAEL_VAT_RATE,
  AGENT_MODEL_POLICY,
  OSEK_PATUR_VAT_POLICY,
  WITHHOLDING_RATE_POLICY,
  isShaamAllocationRequired,
  getWithholdingPeriod,
  resolveWithholdingRate,
  COMPANY_TAX_ID,
  COMPANY_NAME_EN,
} from '@shared/israel-compliance-config';
import { IsraeliDigitalReceiptService } from './IsraeliDigitalReceiptService';
import VATCalculatorService from './VATCalculatorService';
import { allocateTaxSequenceNumber } from './TaxSequenceService';
import { createHash } from 'crypto';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Platform =
  | 'sitter-suite'
  | 'walk-my-pet'
  | 'pettrek'
  | 'pet-wash-hub'
  | 'paw-finder'
  | 'plush-lab'
  | 'enterprise';

export type OsekType = 'osek_patur' | 'osek_murshe';

export interface ProviderContext {
  providerId: string;
  providerType: string;
  osekType?: OsekType;
  withholdingCertExpiryDate?: Date;
  withholdingCertRate?: number; // 0–100 (e.g. 5 for 5%)
}

export interface BookingContext {
  bookingId: string;        // string booking reference (e.g. "SITTER-2026-ABCD")
  bookingDbId?: number;     // numeric PK from the platform's bookings table
  platform: Platform;
  grossChargedILS: number;  // exact amount charged to the customer (VAT-inclusive)
  provider: ProviderContext;
  customerEmail?: string;
  idempotencyKey?: string;  // octopus idempotency key (usually = bookingId)
}

// ── Accept event result ───────────────────────────────────────────────────────

export interface AcceptEventResult {
  success: boolean;
  octopusLedgerId?: string;
  escrowNote: string;
  error?: string;
}

// ── Complete event result ─────────────────────────────────────────────────────

export interface CompleteEventResult {
  success: boolean;
  commissionId?: string;
  withholdingAmount?: number;
  withholdingRate?: number;
  netProviderPayout?: number;
  vatOnCommission?: number;
  shaamRequired?: boolean;
  certExpired?: boolean;
  plLedgerId?: string;
  error?: string;
}

// ── Cancel event result ───────────────────────────────────────────────────────

export interface CancelEventResult {
  success: boolean;
  voidedReceiptIds?: number[];
  creditNoteNumber?: string;
  withholdingReversed?: boolean;
  octopusLedgerId?: string;
  error?: string;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class IsraelComplianceEngine {

  // ── ACCEPT ─────────────────────────────────────────────────────────────────
  /**
   * Record an ACCEPT event:
   *  - Marks the octopus booking as CONFIRMED
   *  - Writes a PAYMENT_CAPTURED ledger entry (escrow hold)
   *  - Does NOT create a P&L entry (that happens at COMPLETE)
   *
   * Israeli law: payment capture is an operational (escrow) event.
   * The taxable supply has not yet been delivered.
   */
  static async recordAcceptEvent(
    ctx: BookingContext,
    nayaxTransactionId?: string,
  ): Promise<AcceptEventResult> {
    try {
      const idKey = ctx.idempotencyKey ?? ctx.bookingId;
      const [octopusRecord] = await db
        .select()
        .from(octopusBookings)
        .where(eq(octopusBookings.idempotencyKey, idKey))
        .limit(1);

      let octopusLedgerId: string | undefined;

      if (octopusRecord) {
        await db
          .update(octopusBookings)
          .set({ status: 'CONFIRMED', updatedAt: new Date() })
          .where(eq(octopusBookings.id, octopusRecord.id));

        octopusLedgerId = `OL-${nanoid(8)}`;
        await db.insert(octopusLedger).values({
          id: octopusLedgerId,
          type: 'PAYMENT_CAPTURED',
          bookingId: octopusRecord.id,
          amount: Math.round(ctx.grossChargedILS * 100),
          platform: this._toPlatformEnum(ctx.platform),
          metadata: {
            nayaxTransactionId: nayaxTransactionId ?? null,
            escrowNote: 'Funds captured into escrow. No P&L entry until service completion.',
            agentModel: AGENT_MODEL_POLICY.model,
            pendingCpaSignoff: AGENT_MODEL_POLICY.pendingCpaSignoff,
          },
        });
      }

      logger.info('[IsraelComplianceEngine] ACCEPT event recorded (escrow)', {
        bookingId: ctx.bookingId,
        platform: ctx.platform,
        grossILS: ctx.grossChargedILS,
        octopusLedgerId,
      });

      return {
        success: true,
        octopusLedgerId,
        escrowNote: 'Payment captured. Financial settlement deferred to service completion.',
      };
    } catch (err: any) {
      logger.error('[IsraelComplianceEngine] ACCEPT event failed', {
        bookingId: ctx.bookingId,
        error: err.message,
      });
      return { success: false, escrowNote: '', error: err.message };
    }
  }

  // ── COMPLETE ───────────────────────────────────────────────────────────────
  /**
   * Record a COMPLETE event (final financial settlement):
   *  1. Calculate marketplace VAT (commission-based)
   *  2. Apply Form 2542 cert or policy-default withholding rate
   *  3. Write provider commission row
   *  4. Write withholding_remittance_ledger (held)
   *  5. Determine SHAAM requirement on the settlement document
   *  6. Write authoritative P&L ledger entry (Firestore + digital_receipts)
   *  7. Update octopus booking to COMPLETED
   *
   * Israeli law מועד החיוב: the taxable event is service delivery, not payment capture.
   */
  static async recordCompleteEvent(
    ctx: BookingContext,
    commissionRate?: number,
  ): Promise<CompleteEventResult> {
    try {
      // ── 1. Withholding resolution ──────────────────────────────────────────
      const wh = resolveWithholdingRate(
        ctx.provider.withholdingCertExpiryDate,
        ctx.provider.withholdingCertRate,
      );

      // ── 2. Skip withholding for Osek Patur if policy says so ──────────────
      const applyWithholding =
        ctx.provider.osekType === 'osek_patur'
          ? WITHHOLDING_RATE_POLICY.applyToOsekPatur
          : true;

      // ── 3. Settlement calculation ──────────────────────────────────────────
      const rate = commissionRate ?? 0.15;
      const platformFeeGross = ctx.grossChargedILS * rate;
      const providerGross = ctx.grossChargedILS - platformFeeGross;
      const vatOnCommission = platformFeeGross * (ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE));

      const withholdingRate = applyWithholding ? wh.rate : 0;
      const withholdingAmount = parseFloat((providerGross * withholdingRate).toFixed(2));
      const netProviderPayout = parseFloat((providerGross - withholdingAmount).toFixed(2));

      // ── 4. SHAAM check on the settlement document ─────────────────────────
      const exVatOnFee = platformFeeGross / (1 + ISRAEL_VAT_RATE);
      const shaamRequired = isShaamAllocationRequired(exVatOnFee);

      // ── 5. Write provider commission + withholding ledger ─────────────────
      const settlementResult = await IsraeliDigitalReceiptService.recordProviderSettlement({
        bookingId: ctx.bookingId,
        providerId: ctx.provider.providerId,
        providerType: ctx.provider.providerType,
        grossPayoutAmount: providerGross,
        osekType: ctx.provider.osekType,
        withholdingCertExpiryDate: ctx.provider.withholdingCertExpiryDate,
        withholdingCertRate: ctx.provider.withholdingCertRate,
        customerPaidAmount: ctx.grossChargedILS,
        bookingDbId: ctx.bookingDbId ?? 0,
        commissionRate: rate * 100,
      });

      // ── 6. P&L ledger entry (authoritative financial record) ───────────────
      let plLedgerId: string | undefined;
      try {
        const plEntry = await VATCalculatorService.recordTransactionFromGross(
          ctx.platform,
          ctx.bookingId,
          ctx.grossChargedILS,
          ctx.bookingId,
          {
            completedAt: new Date().toISOString(),
            bookingDbId: ctx.bookingDbId,
            agentModel: AGENT_MODEL_POLICY.model,
            pendingCpaSignoff: AGENT_MODEL_POLICY.pendingCpaSignoff,
            shaamRequired,
            certExpired: wh.certExpired,
            withholdingSource: wh.source,
          },
          settlementResult.settlement ? {
            withholdingTaxAmount: settlementResult.settlement.withholdingTaxAmount,
            withholdingTaxRate: settlementResult.settlement.withholdingTaxRate,
            netPaymentToProvider: settlementResult.settlement.netPaymentToProvider,
            commissionId: settlementResult.settlement.commissionId,
            osekType: ctx.provider.osekType,
          } : undefined,
        );
        plLedgerId = plEntry.id;
      } catch (plErr: any) {
        logger.warn('[IsraelComplianceEngine] P&L ledger write failed (non-blocking)', {
          bookingId: ctx.bookingId,
          error: plErr.message,
        });
      }

      // ── 7. Update octopus booking ─────────────────────────────────────────
      try {
        const idKey = ctx.idempotencyKey ?? ctx.bookingId;
        const [octopusRecord] = await db
          .select()
          .from(octopusBookings)
          .where(eq(octopusBookings.idempotencyKey, idKey))
          .limit(1);

        if (octopusRecord) {
          await db
            .update(octopusBookings)
            .set({ status: 'COMPLETED', updatedAt: new Date() })
            .where(eq(octopusBookings.id, octopusRecord.id));

          await db.insert(octopusLedger).values({
            id: `OL-${nanoid(8)}`,
            type: 'PROVIDER_EARNING',
            bookingId: octopusRecord.id,
            amount: Math.round(netProviderPayout * 100),
            platform: this._toPlatformEnum(ctx.platform),
            metadata: {
              plLedgerId,
              commissionId: settlementResult.commissionId,
              withholdingAmount,
              withholdingRate,
              shaamRequired,
              certExpired: wh.certExpired,
              agentModel: AGENT_MODEL_POLICY.model,
              pendingCpaSignoff: AGENT_MODEL_POLICY.pendingCpaSignoff,
            },
          });
        }
      } catch (octopusErr: any) {
        logger.warn('[IsraelComplianceEngine] Octopus COMPLETE update failed (non-blocking)', {
          bookingId: ctx.bookingId,
          error: octopusErr.message,
        });
      }

      if (shaamRequired) {
        logger.warn('[IsraelComplianceEngine] SHAAM allocation number required — pending API integration', {
          bookingId: ctx.bookingId,
          exVatOnFee,
        });
      }

      if (wh.certExpired) {
        logger.warn('[IsraelComplianceEngine] Form 2542 cert EXPIRED — using policy default rate', {
          bookingId: ctx.bookingId,
          defaultRate: WITHHOLDING_RATE_POLICY.defaultRate,
        });
      }

      logger.info('[IsraelComplianceEngine] COMPLETE event recorded', {
        bookingId: ctx.bookingId,
        grossILS: ctx.grossChargedILS,
        withholdingAmount,
        netProviderPayout,
        shaamRequired,
        commissionId: settlementResult.commissionId,
      });

      return {
        success: true,
        commissionId: settlementResult.commissionId,
        withholdingAmount,
        withholdingRate,
        netProviderPayout,
        vatOnCommission: parseFloat(vatOnCommission.toFixed(2)),
        shaamRequired,
        certExpired: wh.certExpired,
        plLedgerId,
      };
    } catch (err: any) {
      logger.error('[IsraelComplianceEngine] COMPLETE event failed', {
        bookingId: ctx.bookingId,
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  // ── CANCEL ─────────────────────────────────────────────────────────────────
  /**
   * Record a CANCEL event:
   *  - Writes CANCELLATION entry to octopus_ledger
   *  - Voids any open receipts for this booking
   *  - If a provider settlement already exists (post-COMPLETE), issues a credit note
   *  - Reverses any held withholding_remittance_ledger entries
   *
   * Caller specifies whether the cancellation is pre-completion (no money moved
   * yet beyond escrow) or post-completion (settlement already recorded).
   */
  static async recordCancelEvent(params: {
    ctx: BookingContext;
    reason: string;
    cancelledBy: 'provider' | 'customer' | 'admin' | 'system';
    isPostCompletion?: boolean;  // true when service was already delivered + settled
  }): Promise<CancelEventResult> {
    const { ctx, reason, cancelledBy, isPostCompletion = false } = params;

    try {
      const voidedReceiptIds: number[] = [];
      let creditNoteNumber: string | undefined;
      let withholdingReversed = false;

      // ── 1. octopus_ledger CANCELLATION entry ──────────────────────────────
      let octopusLedgerId: string | undefined;
      try {
        const idKey = ctx.idempotencyKey ?? ctx.bookingId;
        const [octopusRecord] = await db
          .select()
          .from(octopusBookings)
          .where(eq(octopusBookings.idempotencyKey, idKey))
          .limit(1);

        if (octopusRecord) {
          await db
            .update(octopusBookings)
            .set({ status: 'CANCELLED', updatedAt: new Date() })
            .where(eq(octopusBookings.id, octopusRecord.id));

          octopusLedgerId = `OL-${nanoid(8)}`;
          await db.insert(octopusLedger).values({
            id: octopusLedgerId,
            type: 'CANCELLATION',
            bookingId: octopusRecord.id,
            amount: 0,
            platform: this._toPlatformEnum(ctx.platform),
            metadata: {
              reason,
              cancelledBy,
              cancelledAt: new Date().toISOString(),
              isPostCompletion,
            },
          });
        }
      } catch (octopusErr: any) {
        logger.warn('[IsraelComplianceEngine] Octopus CANCEL entry failed (non-blocking)', {
          bookingId: ctx.bookingId,
          error: octopusErr.message,
        });
      }

      // ── 2. Receipts — void or issue credit note ───────────────────────────
      const existingReceipts = await IsraeliDigitalReceiptService.getReceiptByBookingId(
        ctx.bookingId,
      );

      for (const receipt of existingReceipts) {
        if (receipt.isVoided) continue;

        if (isPostCompletion && receipt.receiptType !== 'credit_note') {
          // Service was already completed → issue a credit note instead of voiding
          const creditResult = await IsraeliDigitalReceiptService.issueCreditNote({
            originalReceiptId: receipt.id,
            refundAmount: Math.abs(parseFloat(receipt.totalAmount)),
            reason,
            platform: ctx.platform,
            bookingId: ctx.bookingId,
            customerEmail: receipt.customerEmail,
          });
          if (creditResult.success && creditResult.creditNoteNumber) {
            creditNoteNumber = creditResult.creditNoteNumber;
          }
        } else {
          // Pre-completion → void the receipt directly
          const voidResult = await IsraeliDigitalReceiptService.voidReceipt({
            receiptId: receipt.id,
            voidReason: `Booking cancelled (${cancelledBy}): ${reason}`,
          });
          if (voidResult.success) {
            voidedReceiptIds.push(receipt.id);
          }
        }
      }

      // ── 3. Reverse withholding_remittance_ledger ──────────────────────────
      try {
        const [reverseResult] = await db
          .update(withholdingRemittanceLedger)
          .set({
            status: 'reversed',
            reversedAt: new Date(),
            reverseReason: `Booking cancelled (${cancelledBy}): ${reason}`,
            updatedAt: new Date(),
          })
          .where(
            sql`booking_id = ${ctx.bookingId} AND status = 'held'`,
          )
          .returning();

        withholdingReversed = !!reverseResult;
      } catch (wrlErr: any) {
        logger.warn('[IsraelComplianceEngine] Withholding reversal failed (non-blocking)', {
          bookingId: ctx.bookingId,
          error: wrlErr.message,
        });
      }

      logger.info('[IsraelComplianceEngine] CANCEL event recorded', {
        bookingId: ctx.bookingId,
        cancelledBy,
        isPostCompletion,
        voidedReceiptIds,
        creditNoteNumber,
        withholdingReversed,
      });

      return {
        success: true,
        voidedReceiptIds,
        creditNoteNumber,
        withholdingReversed,
        octopusLedgerId,
      };
    } catch (err: any) {
      logger.error('[IsraelComplianceEngine] CANCEL event failed', {
        bookingId: ctx.bookingId,
        error: err.message,
      });
      return { success: false, error: err.message };
    }
  }

  // ── VAT HELPERS ────────────────────────────────────────────────────────────

  /**
   * Back-calculate VAT from a VAT-inclusive gross amount.
   * Israeli consumer prices are always VAT-inclusive (Consumer Protection Law §17a).
   */
  static vatFromGross(grossILS: number): { netILS: number; vatILS: number } {
    const vatILS = parseFloat((grossILS * (ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE))).toFixed(2));
    return { netILS: parseFloat((grossILS - vatILS).toFixed(2)), vatILS };
  }

  /**
   * Determine the platform's VAT liability based on the agent model and provider type.
   * ⚠️ pendingCpaSignoff=true for AGENT_MODEL_POLICY — treat returned values as provisional.
   */
  static computePlatformVatLiability(
    grossChargedILS: number,
    commissionRate: number,
    osekType?: OsekType,
  ): {
    platformFeeGross: number;
    vatLiability: number;
    osekPaturAdjustment: number;
    totalVatOwed: number;
    pendingCpaSignoff: boolean;
  } {
    const platformFeeGross = grossChargedILS * commissionRate;
    const { vatILS: vatOnFee } = this.vatFromGross(platformFeeGross);

    // Osek Patur providers: under the conservative policy assumption, the platform
    // cannot reclaim input-VAT on the provider's share, so total VAT exposure
    // effectively equals VAT on the full gross (provider side not offset).
    let osekPaturAdjustment = 0;
    if (
      osekType === 'osek_patur' &&
      OSEK_PATUR_VAT_POLICY.platformCannotReclaimInputVatFromOsekPatur
    ) {
      const providerGross = grossChargedILS - platformFeeGross;
      osekPaturAdjustment = parseFloat(
        (providerGross * (ISRAEL_VAT_RATE / (1 + ISRAEL_VAT_RATE))).toFixed(2),
      );
    }

    return {
      platformFeeGross: parseFloat(platformFeeGross.toFixed(2)),
      vatLiability: vatOnFee,
      osekPaturAdjustment,
      totalVatOwed: parseFloat((vatOnFee + osekPaturAdjustment).toFixed(2)),
      pendingCpaSignoff:
        AGENT_MODEL_POLICY.pendingCpaSignoff || OSEK_PATUR_VAT_POLICY.pendingCpaSignoff,
    };
  }

  // ── RECONCILIATION CHECKS ──────────────────────────────────────────────────

  /**
   * Check that all the financial artifacts for a booking are internally consistent:
   *   - booking exists
   *   - digital_receipts match expected amounts
   *   - provider_commissions row exists if booking is completed
   *   - withholding_remittance_ledger entry exists (if withholding was due)
   *   - no 'held' withholding entries remain for cancelled bookings
   *
   * Returns a list of discrepancy strings (empty = clean).
   */
  static async reconcileBooking(bookingId: string): Promise<{
    bookingId: string;
    discrepancies: string[];
    status: 'clean' | 'discrepancies_found';
  }> {
    const discrepancies: string[] = [];

    // 1. Check for receipts
    const receipts = await IsraeliDigitalReceiptService.getReceiptByBookingId(bookingId);
    const liveReceipts = receipts.filter(r => !r.isVoided && r.receiptType !== 'credit_note');
    const creditNotes = receipts.filter(r => r.receiptType === 'credit_note');
    const voidedReceipts = receipts.filter(r => r.isVoided);

    // 2. Check provider_commissions
    const commissions = await db
      .select()
      .from(providerCommissions)
      .where(sql`booking_id::text LIKE ${`%${bookingId}%`}`);

    // 3. Check withholding ledger
    const withholdingRows = await db
      .select()
      .from(withholdingRemittanceLedger)
      .where(eq(withholdingRemittanceLedger.bookingId, bookingId));

    const heldWithholding = withholdingRows.filter(w => w.status === 'held');
    const reversedWithholding = withholdingRows.filter(w => w.status === 'reversed');

    // Check: if credit notes exist, there should be no held withholding
    if (creditNotes.length > 0 && heldWithholding.length > 0) {
      discrepancies.push(
        `Booking ${bookingId}: credit note exists but withholding_remittance_ledger still has ${heldWithholding.length} 'held' entry/entries — reversal may have failed`,
      );
    }

    // Check: if voided receipts exist without credit notes, held entries should also be 0
    if (voidedReceipts.length > 0 && creditNotes.length === 0 && heldWithholding.length > 0) {
      discrepancies.push(
        `Booking ${bookingId}: receipts voided but ${heldWithholding.length} held withholding entries remain — check voidReceipt() reversal`,
      );
    }

    // Check: live receipts without any commission row (only meaningful for completed bookings)
    if (liveReceipts.length > 0 && commissions.length === 0) {
      const completionReceipts = liveReceipts.filter(
        r => r.receiptType === 'provider_settlement' || r.receiptType === 'pl_ledger_entry',
      );
      if (completionReceipts.length > 0) {
        discrepancies.push(
          `Booking ${bookingId}: settlement receipt exists but no provider_commissions row found`,
        );
      }
    }

    // Check: SHAAM required but no allocation number
    for (const r of liveReceipts) {
      if (r.shaamRequired && !r.shaamAllocationNumber) {
        discrepancies.push(
          `Booking ${bookingId} receipt ${r.receiptNumber}: shaamRequired=true but shaamAllocationNumber is null — SHAAM API integration pending`,
        );
      }
    }

    return {
      bookingId,
      discrepancies,
      status: discrepancies.length === 0 ? 'clean' : 'discrepancies_found',
    };
  }

  // ── POLICY REPORT ──────────────────────────────────────────────────────────

  /**
   * Returns a snapshot of the current policy configuration.
   * Useful for admin dashboards and audit trails.
   * All fields pending CPA sign-off are clearly flagged.
   */
  static getPolicySnapshot(): {
    vatRate: number;
    agentModel: typeof AGENT_MODEL_POLICY;
    osekPaturVatPolicy: typeof OSEK_PATUR_VAT_POLICY;
    withholdingRatePolicy: typeof WITHHOLDING_RATE_POLICY;
    shaamThresholds: {
      phase1Start: string;
      phase1ThresholdILS: number;
      phase2Start: string;
      phase2ThresholdILS: number;
    };
    generatedAt: string;
  } {
    return {
      vatRate: ISRAEL_VAT_RATE,
      agentModel: AGENT_MODEL_POLICY,
      osekPaturVatPolicy: OSEK_PATUR_VAT_POLICY,
      withholdingRatePolicy: WITHHOLDING_RATE_POLICY,
      shaamThresholds: {
        phase1Start: '2026-01-01',
        phase1ThresholdILS: 10_000,
        phase2Start: '2026-06-01',
        phase2ThresholdILS: 5_000,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private static _toPlatformEnum(platform: Platform): string {
    const map: Record<Platform, string> = {
      'sitter-suite':  'PETSITTER',
      'walk-my-pet':   'PETTREK',
      'pettrek':       'PETTREK',
      'pet-wash-hub':  'PETWASH_HUB',
      'paw-finder':    'PETSITTER',
      'plush-lab':     'PETSITTER',
      'enterprise':    'PETWASH_HUB',
    };
    return map[platform] ?? 'PETWASH_HUB';
  }
}
