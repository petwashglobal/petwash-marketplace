import { pool } from "../db";

export async function writeProviderAudit(input: {
  applicationId: number;
  eventType: string;
  actorUserId?: string | null;
  actorRole?: string | null;
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO provider_review_audit
         (application_id, event_type, actor_user_id, actor_role, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        input.applicationId,
        input.eventType,
        input.actorUserId ?? null,
        input.actorRole ?? null,
        input.payload ? JSON.stringify(input.payload) : null,
      ]
    );
  } catch (err) {
    console.error("[ProviderAudit] Failed to write audit event:", err);
  }
}

export async function getAuditTrail(applicationId: number): Promise<unknown[]> {
  const res = await pool.query(
    `SELECT id, event_type, actor_user_id, actor_role, payload, created_at
       FROM provider_review_audit
      WHERE application_id = $1
      ORDER BY created_at DESC
      LIMIT 200`,
    [applicationId]
  );
  return res.rows;
}
