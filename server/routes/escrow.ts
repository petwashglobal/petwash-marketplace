import express from "express";
import EscrowService, { type EscrowPayment } from "../services/EscrowService";
import { requireAuth } from "../customAuth";
import { requireAdmin } from "../adminAuth";
import { logger } from "../lib/logger";
import { logReceipt, appendFormSubmission, logOpsLiveFeed } from "../services/googleSheetsIntegration";
import { logAuditEvent } from "../middleware/auditLog";
import { runWithIdempotency } from "../lib/idempotency-helper";

const SHEETS_DISPUTE_CASES = 'Dispute Cases';

const router = express.Router();

/**
 * PR-W34a: every escrow money-mutation now writes an audit_events row.
 * Fire-and-forget (setImmediate) so the customer response isn't blocked
 * if Postgres is slow. The same pattern the Sheets logging already uses.
 */
function emitEscrowAudit(params: {
  actionType: string;
  actorUserId: string;
  actorRole?: string;
  escrowId: string;
  bookingId?: string;
  amountILS?: string | number;
  reason?: string;
  ip?: string;
  userAgent?: string;
}): void {
  setImmediate(() => {
    logAuditEvent({
      actorUserId: params.actorUserId,
      actorRole: params.actorRole,
      actionType: params.actionType,
      targetType: 'escrow',
      targetId: params.escrowId,
      ip: params.ip,
      userAgent: params.userAgent,
      metadata: {
        escrowId: params.escrowId,
        bookingId: params.bookingId,
        amountILS: params.amountILS,
        reason: params.reason,
      },
    }).catch((e) => logger.warn('[Escrow] audit_events write failed (non-blocking)', { error: e?.message }));
  });
}

async function assertEscrowParticipant(
  escrowId: string,
  callerId: string
): Promise<EscrowPayment> {
  const escrow = await EscrowService.getEscrowPayment(escrowId);
  if (!escrow) {
    const err: any = new Error("Escrow not found");
    err.status = 404;
    throw err;
  }
  if (escrow.customerId !== callerId && escrow.providerId !== callerId) {
    logger.warn("[Escrow] Unauthorized access attempt", {
      escrowId,
      callerId,
      customerId: escrow.customerId,
      providerId: escrow.providerId,
    });
    const err: any = new Error("Forbidden: you are not a party to this escrow");
    err.status = 403;
    throw err;
  }
  return escrow;
}

router.post("/create", requireAuth, async (req, res) => {
  try {
    const { bookingId, providerId, amount, nayaxTransactionId, metadata } = req.body;
    const customerId = req.user!.uid;

    // PR-W45: replay-safe via walletIdempotencyKeys. Body fingerprint
    // hashes the fields that determine money flow; identical retries
    // return the original {escrow:...} payload instead of creating a
    // second row. Honours `Idempotency-Key` header if present.
    const result = await runWithIdempotency({
      endpoint: 'escrow:create',
      headerKey: req.headers['idempotency-key'],
      bodyFingerprint: ({ bookingId, customerId, providerId, amount, nayaxTransactionId }) =>
        `${bookingId}:${customerId}:${providerId}:${amount}:${nayaxTransactionId ?? ''}`,
      body: { bookingId, customerId, providerId, amount, nayaxTransactionId },
      logContext: { customerId, bookingId },
      operation: async () => {
        const escrow = await EscrowService.createEscrowPayment(
          bookingId, customerId, providerId, amount, nayaxTransactionId, metadata,
        );
        emitEscrowAudit({
          actionType: 'ESCROW_CREATE',
          actorUserId: customerId,
          actorRole: 'customer',
          escrowId: (escrow as any)?.id ?? 'unknown',
          bookingId,
          amountILS: amount,
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
        });
        return { escrow };
      },
    });

    if (result.kind === 'in_flight') {
      return res.status(409).json({
        error: 'Escrow create with same body is already being processed.',
        errorCode: 'IDEMPOTENCY_IN_FLIGHT',
      });
    }
    res.json(result.response);
  } catch (error: any) {
    logger.error("[Escrow] Error creating", { error: error.message });
    res.status(error.status ?? 500).json({ error: error.message });
  }
});

router.post("/:escrowId/release", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const callerId = req.user!.uid;

    const escrow = await assertEscrowParticipant(escrowId, callerId);

    if (escrow.customerId !== callerId) {
      return res.status(403).json({
        error: "Only the customer who created this escrow can release it",
      });
    }

    // PR-W45: idempotency-cache. Replay returns the same {success:true}
    // instead of bubbling up a "already released" 500.
    const result = await runWithIdempotency({
      endpoint: 'escrow:release',
      headerKey: req.headers['idempotency-key'],
      bodyFingerprint: ({ escrowId, callerId }) => `${escrowId}:${callerId}`,
      body: { escrowId, callerId },
      logContext: { escrowId, callerId },
      operation: async () => {
        await EscrowService.releaseEscrowPayment(escrowId, callerId);
        emitEscrowAudit({
          actionType: 'ESCROW_RELEASE',
          actorUserId: callerId,
          actorRole: 'customer',
          escrowId,
          bookingId: escrow.bookingId,
          amountILS: escrow.amount,
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
        });
        return { success: true };
      },
    });

    if (result.kind === 'in_flight') {
      return res.status(409).json({ error: 'Release in progress', errorCode: 'IDEMPOTENCY_IN_FLIGHT' });
    }

    res.json(result.response);

    // ── Fire-and-forget: Sheets receipt + live feed ────────────────────────
    setImmediate(() => {
      const amountStr = String(escrow.amount || '');
      Promise.all([
        logReceipt({
          receiptId: `escrow-release-${escrowId}`,
          transactionId: escrow.nayaxTransactionId || escrowId,
          customerName: '',
          email: '',
          amount: amountStr,
          paymentMethod: 'Escrow Release',
          platform: 'PetWash',
          serviceType: 'Escrow',
          description: `Escrow released — booking ${escrow.bookingId}`,
          status: 'Released',
        }),
        logOpsLiveFeed({
          eventType: 'escrow.released',
          source: 'escrow_route',
          entityId: escrowId,
          bookingId: escrow.bookingId,
          amountILS: amountStr,
          platform: 'PetWash',
          status: 'released',
          actor: callerId,
          details: `customer released escrow to provider`,
        }),
      ]).catch(e => logger.warn('[Escrow] Sheets logging error (non-blocking)', e));
    });
  } catch (error: any) {
    logger.error("[Escrow] Error releasing", { error: error.message });
    res.status(error.status ?? 500).json({ error: error.message });
  }
});

router.post("/:escrowId/refund", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;
    const callerId = req.user!.uid;

    const escrow = await assertEscrowParticipant(escrowId, callerId);

    const result = await runWithIdempotency({
      endpoint: 'escrow:refund',
      headerKey: req.headers['idempotency-key'],
      bodyFingerprint: ({ escrowId, callerId, reason }) => `${escrowId}:${callerId}:${reason ?? ''}`,
      body: { escrowId, callerId, reason },
      logContext: { escrowId, callerId },
      operation: async () => {
        await EscrowService.refundEscrowPayment(escrowId, reason, callerId);
        emitEscrowAudit({
          actionType: 'ESCROW_REFUND',
          actorUserId: callerId,
          actorRole: 'participant',
          escrowId,
          bookingId: escrow.bookingId,
          amountILS: escrow.amount,
          reason,
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
        });
        return { success: true };
      },
    });

    if (result.kind === 'in_flight') {
      return res.status(409).json({ error: 'Refund in progress', errorCode: 'IDEMPOTENCY_IN_FLIGHT' });
    }

    res.json(result.response);

    // ── Fire-and-forget: Sheets receipt + live feed ────────────────────────
    setImmediate(() => {
      const amountStr = String(escrow.amount || '');
      Promise.all([
        logReceipt({
          receiptId: `escrow-refund-${escrowId}`,
          transactionId: escrow.nayaxTransactionId || escrowId,
          customerName: '',
          email: '',
          amount: amountStr,
          paymentMethod: 'Escrow Refund',
          platform: 'PetWash',
          serviceType: 'Escrow',
          description: `Escrow refunded — booking ${escrow.bookingId}${reason ? ` — ${reason}` : ''}`,
          status: 'Refunded',
        }),
        logOpsLiveFeed({
          eventType: 'escrow.refunded',
          source: 'escrow_route',
          entityId: escrowId,
          bookingId: escrow.bookingId,
          amountILS: amountStr,
          platform: 'PetWash',
          status: 'refunded',
          actor: callerId,
          details: reason || 'escrow refunded to customer',
        }),
      ]).catch(e => logger.warn('[Escrow] Sheets logging error (non-blocking)', e));
    });
  } catch (error: any) {
    logger.error("[Escrow] Error refunding", { error: error.message });
    res.status(error.status ?? 500).json({ error: error.message });
  }
});

router.post("/:escrowId/dispute", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;
    const callerId = req.user!.uid;

    const escrow = await assertEscrowParticipant(escrowId, callerId);

    const result = await runWithIdempotency({
      endpoint: 'escrow:dispute',
      headerKey: req.headers['idempotency-key'],
      bodyFingerprint: ({ escrowId, callerId, reason }) => `${escrowId}:${callerId}:${reason ?? ''}`,
      body: { escrowId, callerId, reason },
      logContext: { escrowId, callerId },
      operation: async () => {
        await EscrowService.disputeEscrowPayment(escrowId, reason, callerId);
        emitEscrowAudit({
          actionType: 'ESCROW_DISPUTE',
          actorUserId: callerId,
          actorRole: 'participant',
          escrowId,
          bookingId: escrow.bookingId,
          amountILS: escrow.amount,
          reason,
          ip: req.ip,
          userAgent: req.headers['user-agent'] as string | undefined,
        });
        return { success: true };
      },
    });

    if (result.kind === 'in_flight') {
      return res.status(409).json({ error: 'Dispute in progress', errorCode: 'IDEMPOTENCY_IN_FLIGHT' });
    }

    res.json(result.response);

    // ── Fire-and-forget: Dispute cases sheet + live feed ──────────────────
    setImmediate(() => {
      const amountStr = String(escrow.amount || '');
      Promise.all([
        appendFormSubmission(SHEETS_DISPUTE_CASES, {
          caseId: `escrow-dispute-${escrowId}`,
          bookingId: escrow.bookingId,
          customerId: escrow.customerId,
          providerId: escrow.providerId,
          serviceType: 'Escrow',
          amountInDispute: amountStr,
          customerClaim: reason || '',
          providerResponse: '',
          evidenceUrls: '',
          assignedTo: '',
          status: 'Open',
          resolution: '',
          resolutionDate: '',
          compensation: '',
          notes: `Dispute raised by ${callerId}`,
        }),
        logOpsLiveFeed({
          eventType: 'escrow.disputed',
          source: 'escrow_route',
          entityId: escrowId,
          bookingId: escrow.bookingId,
          amountILS: amountStr,
          platform: 'PetWash',
          status: 'disputed',
          actor: callerId,
          details: reason || 'escrow dispute opened',
        }),
      ]).catch(e => logger.warn('[Escrow] Sheets logging error (non-blocking)', e));
    });
  } catch (error: any) {
    logger.error("[Escrow] Error disputing", { error: error.message });
    res.status(error.status ?? 500).json({ error: error.message });
  }
});

router.get("/payments", requireAuth, async (req, res) => {
  try {
    const userId = req.user!.uid;
    const payments = await EscrowService.getUserPayments(userId);
    res.json({ payments });
  } catch (error: any) {
    logger.error("[Escrow] Error fetching payments", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.get("/:escrowId", requireAuth, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const callerId = req.user!.uid;

    const escrow = await assertEscrowParticipant(escrowId, callerId);
    res.json({ escrow });
  } catch (error: any) {
    logger.error("[Escrow] Error fetching", { error: error.message });
    res.status(error.status ?? 500).json({ error: error.message });
  }
});

router.get("/booking/:bookingId", requireAuth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const callerId = req.user!.uid;

    const escrows = await EscrowService.getEscrowsByBooking(bookingId);

    const permitted = escrows.filter(
      (e) => e.customerId === callerId || e.providerId === callerId
    );

    res.json({ escrows: permitted });
  } catch (error: any) {
    logger.error("[Escrow] Error fetching by booking", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

router.post("/admin/auto-release", requireAdmin, async (req: any, res) => {
  try {
    const releasedCount = await EscrowService.autoReleaseExpiredHolds();

    emitEscrowAudit({
      actionType: 'ESCROW_AUTO_RELEASE',
      actorUserId: req.user?.uid || req.firebaseUser?.uid || 'system',
      actorRole: 'admin',
      escrowId: 'batch',
      ip: req.ip,
      userAgent: req.headers['user-agent'] as string | undefined,
    });

    res.json({ releasedCount });
  } catch (error: any) {
    logger.error("[Escrow] Error auto-releasing", { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
