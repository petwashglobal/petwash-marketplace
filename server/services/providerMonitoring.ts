import { pool } from "../db";

export async function emitProviderEvent(input: {
  applicationId?: number | null;
  eventName: string;
  severity?: "info" | "warning" | "critical";
  payload?: Record<string, unknown> | null;
}): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO provider_workflow_events
         (application_id, event_name, severity, payload)
       VALUES ($1, $2, $3, $4)`,
      [
        input.applicationId ?? null,
        input.eventName,
        input.severity ?? "info",
        input.payload ? JSON.stringify(input.payload) : null,
      ]
    );
  } catch (err) {
    console.error("[ProviderMonitoring] Failed to emit event:", err);
  }
}

export async function getRecentEvents(options?: {
  severity?: string;
  limit?: number;
}): Promise<unknown[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (options?.severity) {
    conditions.push(`severity = $${idx++}`);
    params.push(options.severity);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit ?? 100;
  params.push(limit);

  const res = await pool.query(
    `SELECT id, application_id, event_name, severity, payload, created_at
       FROM provider_workflow_events
       ${where}
       ORDER BY created_at DESC
       LIMIT $${idx}`,
    params
  );
  return res.rows;
}
