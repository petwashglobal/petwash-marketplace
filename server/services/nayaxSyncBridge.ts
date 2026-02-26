/**
 * Nayax Dual-Store Sync Bridge
 *
 * ── Problem ───────────────────────────────────────────────────────────────────
 * PetWash™ has two Nayax data stores:
 *   1. Firestore  — `nayaxFirestoreService.ts` writes to Firestore collections
 *                   (nayax_transactions, nayax_terminals, nayax_vouchers).
 *                   Used by K9000 station IoT operations (routes.ts).
 *   2. PostgreSQL — `nayaxService.ts` (NayaxPaymentService) writes to PostgreSQL
 *                   tables (nayaxTransactions, nayaxTerminals, nayaxWebhookEvents).
 *                   Used by gift card / marketplace payments.
 *
 * Without a sync bridge, Firestore-side transactions are invisible to
 * PostgreSQL-based reporting, reconciliation, and the financial ledger.
 *
 * ── Solution ──────────────────────────────────────────────────────────────────
 * This service provides non-blocking sync functions called by nayaxFirestoreService.ts
 * AFTER successful Firestore writes. PostgreSQL failures are logged but do NOT
 * fail the primary Firestore operation (keeping station IoT path fast & resilient).
 *
 * Sync direction: Firestore → PostgreSQL (one-way bridge).
 * Read operations always use the authoritative source for the given path.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { db } from '../db';
import { nayaxTransactions, nayaxTerminals } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

const LOG_TAG = '[NayaxSyncBridge]';

export interface FirestoreNayaxTx {
  id: string;
  uid?: string;
  packageId?: string;
  amount: number;
  currency: string;
  status: string;
  nayaxTransactionId?: string;
  customerEmail?: string;
  terminalId?: string;
  stationId?: string;
  merchantFee?: number;
  vatAmount?: number;
  netAfterFees?: number;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface FirestoreNayaxTerminal {
  id: string;
  name?: string;
  serialNumber?: string;
  apiKey?: string;
  location?: string;
  stationId?: string;
  status?: string;
  lastPingAt?: string | Date;
}

/**
 * Sync a Firestore-created Nayax transaction to PostgreSQL.
 * Called non-blocking after `createNayaxTransaction()` in nayaxFirestoreService.
 */
export async function syncTransactionToPostgres(tx: FirestoreNayaxTx): Promise<void> {
  try {
    const existing = await db
      .select({ id: nayaxTransactions.id })
      .from(nayaxTransactions)
      .where(eq(nayaxTransactions.id, tx.id))
      .limit(1);

    if (existing.length > 0) {
      return;
    }

    await db.insert(nayaxTransactions).values({
      id: tx.id,
      customerUid: tx.uid ?? null,
      amount: String(tx.amount),
      currency: tx.currency || 'ILS',
      status: tx.status || 'initiated',
      nayaxTransactionId: tx.nayaxTransactionId ?? null,
      terminalId: tx.terminalId ?? null,
      stationId: tx.stationId ?? null,
      merchantId: null,
      createdAt: tx.createdAt ? new Date(tx.createdAt as any) : new Date(),
    });

    logger.info(`${LOG_TAG} Transaction synced to PostgreSQL`, { id: tx.id });
  } catch (error: any) {
    logger.error(`${LOG_TAG} Failed to sync transaction to PostgreSQL (non-fatal)`, {
      id: tx.id,
      error: error?.message,
    });
  }
}

/**
 * Sync a Firestore transaction status update to PostgreSQL.
 * Called non-blocking after `updateTransactionStatus()` in nayaxFirestoreService.
 */
export async function syncTransactionStatusToPostgres(
  transactionId: string,
  status: string,
  nayaxTransactionId?: string,
  financials?: {
    merchantFee?: number;
    vatAmount?: number;
    netAfterFees?: number;
  }
): Promise<void> {
  try {
    const updatePayload: Record<string, any> = {
      status,
      updatedAt: new Date(),
    };

    if (nayaxTransactionId) {
      updatePayload.nayaxTransactionId = nayaxTransactionId;
    }
    if (financials?.merchantFee !== undefined) {
      updatePayload.merchantFee = String(financials.merchantFee);
    }
    if (financials?.vatAmount !== undefined) {
      updatePayload.vatAmount = String(financials.vatAmount);
    }
    if (financials?.netAfterFees !== undefined) {
      updatePayload.netAmount = String(financials.netAfterFees);
    }

    const result = await db
      .update(nayaxTransactions)
      .set(updatePayload)
      .where(eq(nayaxTransactions.id, transactionId))
      .returning({ id: nayaxTransactions.id });

    if (result.length === 0) {
      logger.warn(`${LOG_TAG} Transaction not found in PostgreSQL for status sync — will be created on next sync`, {
        transactionId,
        status,
      });
    } else {
      logger.info(`${LOG_TAG} Transaction status synced to PostgreSQL`, { transactionId, status });
    }
  } catch (error: any) {
    logger.error(`${LOG_TAG} Failed to sync transaction status to PostgreSQL (non-fatal)`, {
      transactionId,
      status,
      error: error?.message,
    });
  }
}

/**
 * Sync a Firestore terminal record to PostgreSQL.
 * Called non-blocking after terminal validation / registration in nayaxFirestoreService.
 */
export async function syncTerminalToPostgres(terminal: FirestoreNayaxTerminal): Promise<void> {
  try {
    const existing = await db
      .select({ id: nayaxTerminals.id })
      .from(nayaxTerminals)
      .where(eq(nayaxTerminals.id, terminal.id))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(nayaxTerminals)
        .set({
          status: (terminal.status as any) || 'online',
          lastHeartbeat: terminal.lastPingAt ? new Date(terminal.lastPingAt as any) : new Date(),
          updatedAt: new Date(),
        })
        .where(eq(nayaxTerminals.id, terminal.id));

      logger.info(`${LOG_TAG} Terminal updated in PostgreSQL`, { id: terminal.id });
      return;
    }

    await db.insert(nayaxTerminals).values({
      id: terminal.id,
      terminalName: terminal.name ?? terminal.id,
      serialNumber: terminal.serialNumber ?? terminal.id,
      apiKey: terminal.apiKey ?? '',
      stationId: terminal.stationId ?? terminal.location ?? terminal.id,
      status: (terminal.status as any) || 'online',
      lastHeartbeat: terminal.lastPingAt ? new Date(terminal.lastPingAt as any) : new Date(),
      installationDate: new Date(),
    });

    logger.info(`${LOG_TAG} Terminal created in PostgreSQL`, { id: terminal.id });
  } catch (error: any) {
    logger.error(`${LOG_TAG} Failed to sync terminal to PostgreSQL (non-fatal)`, {
      id: terminal.id,
      error: error?.message,
    });
  }
}

/**
 * Bulk reconcile Firestore transactions with PostgreSQL.
 * Run periodically (e.g., nightly cron) to catch any gaps from sync failures.
 * Returns count of transactions synced.
 */
export async function reconcileFirestoreTransactions(
  firestoreTransactions: FirestoreNayaxTx[]
): Promise<number> {
  let synced = 0;
  for (const tx of firestoreTransactions) {
    try {
      await syncTransactionToPostgres(tx);
      synced++;
    } catch {
      // Individual errors already logged inside syncTransactionToPostgres
    }
  }
  logger.info(`${LOG_TAG} Reconciliation complete`, { total: firestoreTransactions.length, synced });
  return synced;
}
