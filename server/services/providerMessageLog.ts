import { pool } from "../db";
import { logger } from "../lib/logger";

export type MessageDirection = "outbound" | "inbound" | "internal_note";
export type MessageChannel = "email" | "sms" | "system" | "internal_note" | "portal";
export type DeliveryStatus = "queued" | "sent" | "failed" | "delivered" | "opened";

export async function ensureThread(applicationId: number): Promise<number> {
  const existing = await pool.query(
    `SELECT id FROM provider_application_threads WHERE application_id = $1`,
    [applicationId]
  );
  if (existing.rows.length > 0) return existing.rows[0].id as number;

  const insert = await pool.query(
    `INSERT INTO provider_application_threads (application_id)
     VALUES ($1)
     ON CONFLICT (application_id) DO UPDATE SET updated_at = NOW()
     RETURNING id`,
    [applicationId]
  );
  const threadId = insert.rows[0].id as number;

  // Back-fill communication_thread_id on the application row
  await pool.query(
    `UPDATE provider_applications SET communication_thread_id = $1 WHERE id = $2`,
    [threadId, applicationId]
  );

  return threadId;
}

export async function logProviderMessage(input: {
  applicationId: number;
  direction: MessageDirection;
  channel: MessageChannel;
  subject?: string | null;
  body: string;
  fromAddress?: string | null;
  toAddress?: string | null;
  sentBy?: string | null;
  deliveryStatus?: DeliveryStatus | null;
  providerVisible?: boolean;
}): Promise<void> {
  try {
    const threadId = await ensureThread(input.applicationId);
    await pool.query(
      `INSERT INTO provider_application_messages
         (thread_id, application_id, direction, channel, subject, body,
          from_address, to_address, sent_by, delivery_status, provider_visible)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        threadId,
        input.applicationId,
        input.direction,
        input.channel,
        input.subject ?? null,
        input.body,
        input.fromAddress ?? null,
        input.toAddress ?? null,
        input.sentBy ?? null,
        input.deliveryStatus ?? "queued",
        input.providerVisible ?? true,
      ]
    );

    // bump thread updated_at
    await pool.query(
      `UPDATE provider_application_threads SET updated_at = NOW() WHERE id = $1`,
      [threadId]
    );
  } catch (err) {
    console.error("[ProviderMessageLog] Failed to log message:", err);
  }
}

export async function getThreadMessages(applicationId: number, adminView = false): Promise<unknown[]> {
  const visibilityClause = adminView ? "" : "AND m.provider_visible = true";
  const res = await pool.query(
    `SELECT m.id, m.direction, m.channel, m.subject, m.body,
            m.from_address, m.to_address, m.sent_by,
            m.delivery_status, m.provider_visible, m.created_at
       FROM provider_application_messages m
      WHERE m.application_id = $1
        ${visibilityClause}
      ORDER BY m.created_at ASC`,
    [applicationId]
  );
  return res.rows;
}

export async function incrementUnreadCount(applicationId: number): Promise<void> {
  try {
    await pool.query(
      `UPDATE provider_review_queue SET unread_count = unread_count + 1
        WHERE application_id = $1`,
      [applicationId]
    );
  } catch (err) {
    logger.warn('[ProviderMessageLog] incrementUnreadCount failed', { applicationId, error: (err as Error)?.message });
  }
}

export async function clearUnreadCount(applicationId: number): Promise<void> {
  try {
    await pool.query(
      `UPDATE provider_review_queue SET unread_count = 0 WHERE application_id = $1`,
      [applicationId]
    );
  } catch (err) {
    logger.warn('[ProviderMessageLog] clearUnreadCount failed', { applicationId, error: (err as Error)?.message });
  }
}
