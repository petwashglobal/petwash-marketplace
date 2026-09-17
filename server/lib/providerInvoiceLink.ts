/**
 * One stay, two rows — keep the provider's invoice number on both.
 *
 * A Sitter Suite stay and a Walk My Pet walk are mirrored into
 * `booking_requests` so the provider's job inbox (/provider-os) can show them
 * (services/legacyBookingBridge.ts). That leaves TWO rows for one job, and each
 * has its own `provider_invoice_number`:
 *
 *   the sitter records the invoice in the provider inbox → booking_requests
 *   the payout approval for a sitter stay reads            → sitter_bookings
 *
 * So a sitter could do exactly what they were asked and still be blocked for a
 * missing invoice. This writes the number onto the other row too, whichever
 * side it arrives on. Best-effort: the customer-facing save never fails because
 * the mirror could not be updated — the number is already stored where it was
 * entered, and the payout gate reads both.
 */
import { pool } from '../db';
import { logger } from './logger';
import { resolveBookingSource } from '../services/booking-response/bookingSourceResolver';

/** The only legacy tables that carry a provider invoice number. */
const LEGACY_TABLES = ['sitter_bookings', 'walk_bookings'] as const;
export type LegacyInvoiceTable = (typeof LEGACY_TABLES)[number];

/** A booking_requests row was updated — copy the number onto its legacy row. */
export async function copyInvoiceToLegacyRow(requestId: string, invoiceNumber: string): Promise<void> {
  try {
    const { rows } = await pool.query(
      `SELECT quote_breakdown FROM booking_requests WHERE request_id = $1 LIMIT 1`, [requestId]);
    const resolved = resolveBookingSource(rows[0]?.quote_breakdown);
    const table = resolved.legacyTable;
    const legacyId = resolved.legacyBookingId;
    if (!table || !legacyId || !LEGACY_TABLES.includes(table as LegacyInvoiceTable)) return;
    // Table name comes from the whitelist above, never from the request.
    await pool.query(
      `UPDATE ${table} SET provider_invoice_number = $1, provider_invoice_submitted_at = NOW()
        WHERE booking_id = $2 AND COALESCE(provider_invoice_number, '') = ''`,
      [invoiceNumber, legacyId],
    );
  } catch (err: any) {
    logger.warn('[ProviderInvoice] could not copy the invoice number to the legacy row', {
      requestId, error: err?.message,
    });
  }
}

/** A legacy row was updated — copy the number onto its booking_requests mirror. */
export async function copyInvoiceToMirrorRequest(
  table: LegacyInvoiceTable, legacyBookingId: string, invoiceNumber: string,
): Promise<void> {
  try {
    await pool.query(
      `UPDATE booking_requests
          SET provider_invoice_number = $1, provider_invoice_submitted_at = NOW(), updated_at = NOW()
        WHERE quote_breakdown->'legacyRef'->>'table' = $2
          AND quote_breakdown->'legacyRef'->>'id' = $3
          AND COALESCE(provider_invoice_number, '') = ''`,
      [invoiceNumber, table, legacyBookingId],
    );
  } catch (err: any) {
    logger.warn('[ProviderInvoice] could not copy the invoice number to the mirror booking', {
      table, legacyBookingId, error: err?.message,
    });
  }
}
