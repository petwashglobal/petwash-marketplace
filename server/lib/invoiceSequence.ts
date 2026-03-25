import { db } from '../db';
import { sql } from 'drizzle-orm';
import { logger } from './logger';

/**
 * Generates a sequential, unique commission invoice number.
 * Format: PW-INV-YYYY-NNNNN  (e.g. PW-INV-2025-00001)
 * Backed by the `commission_invoice_seq` PostgreSQL sequence — guaranteed unique.
 */
export async function generateCommissionInvoiceNumber(): Promise<string> {
  const result = await db.execute(
    sql`SELECT nextval('commission_invoice_seq') AS seq_val`
  );
  const seqVal = (result.rows[0] as { seq_val: string | number }).seq_val;
  const year = new Date().getFullYear();
  const padded = String(seqVal).padStart(5, '0');
  const invoiceNumber = `PW-INV-${year}-${padded}`;
  logger.info('[InvoiceSequence] Generated commission invoice number', { invoiceNumber });
  return invoiceNumber;
}
