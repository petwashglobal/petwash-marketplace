import { pool } from "../db";
import type { QueuePriority } from "./providerDecisionEngine";
import { logProviderMessage } from "./providerMessageLog";

export interface QueueItemDTO {
  queueId: number;
  applicationId: number;
  appId: string;
  applicantName: string;
  applicantEmail: string;
  applicantMobile: string;
  providerType: string;
  status: string;
  queueStatus: string;
  priority: QueuePriority;
  faceScore: number | null;
  livenessScore: number | null;
  ocrConfidence: number | null;
  flags: string[];
  fraudFlags: string[];
  fraudRiskLevel: string | null;
  unreadCount: number;
  assignedTo: string | null;
  dueAt: string | null;
  reviewReasons: string[];
  createdAt: string;
  subStatus: string | null;
}

export async function upsertReviewQueue(input: {
  applicationId: number;
  priority?: QueuePriority;
  reviewReasons?: string[];
  dueHours?: number;
}): Promise<void> {
  const due = input.dueHours
    ? new Date(Date.now() + input.dueHours * 3600 * 1000).toISOString()
    : new Date(Date.now() + 48 * 3600 * 1000).toISOString();

  const reasons = JSON.stringify(input.reviewReasons ?? []);

  await pool.query(
    `INSERT INTO provider_review_queue
       (application_id, status, priority, review_reasons, due_at)
     VALUES ($1, 'open', $2, $3::jsonb, $4)
     ON CONFLICT (application_id)
     DO UPDATE SET
       status = CASE WHEN provider_review_queue.status = 'completed' THEN 'open'
                     ELSE provider_review_queue.status END,
       priority = EXCLUDED.priority,
       review_reasons = EXCLUDED.review_reasons,
       due_at = LEAST(provider_review_queue.due_at, EXCLUDED.due_at)`,
    [input.applicationId, input.priority ?? "normal", reasons, due]
  );
}

export async function completeQueueItem(applicationId: number): Promise<void> {
  await pool.query(
    `UPDATE provider_review_queue
        SET status = 'completed', completed_at = NOW()
      WHERE application_id = $1`,
    [applicationId]
  );
}

export async function assignQueueItem(input: {
  applicationId: number;
  assignedTo: string;
}): Promise<void> {
  await pool.query(
    `UPDATE provider_review_queue
        SET status = 'assigned', assigned_to = $2, assigned_at = NOW()
      WHERE application_id = $1`,
    [input.applicationId, input.assignedTo]
  );
}

export async function unassignQueueItem(applicationId: number): Promise<void> {
  await pool.query(
    `UPDATE provider_review_queue
        SET status = 'open', assigned_to = NULL, assigned_at = NULL
      WHERE application_id = $1`,
    [applicationId]
  );
}

export async function getQueueList(options?: {
  status?: string;
  priority?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: QueueItemDTO[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (options?.status && options.status !== "all") {
    conditions.push(`q.status = $${idx++}`);
    params.push(options.status);
  }
  if (options?.priority) {
    conditions.push(`q.priority = $${idx++}`);
    params.push(options.priority);
  }
  if (options?.assignedTo) {
    conditions.push(`q.assigned_to = $${idx++}`);
    params.push(options.assignedTo);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  params.push(limit, offset);

  const [dataRes, countRes] = await Promise.all([
    pool.query(
      `SELECT
         q.id AS queue_id,
         q.application_id,
         a.application_id AS app_id,
         a.first_name || ' ' || a.last_name AS applicant_name,
         a.email AS applicant_email,
         a.phone_number AS applicant_mobile,
         a.provider_type,
         a.status,
         q.status AS queue_status,
         q.priority,
         a.biometric_match_score AS face_score,
         a.kyc_liveness_score AS liveness_score,
         a.kyc_ocr_confidence AS ocr_confidence,
         a.kyc_decision_flags AS flags,
         a.fraud_flags,
         a.kyc_fraud_risk_level AS fraud_risk_level,
         q.unread_count,
         q.assigned_to,
         q.due_at,
         q.review_reasons,
         q.created_at,
         a.sub_status
       FROM provider_review_queue q
       JOIN provider_applications a ON a.id = q.application_id
       ${where}
       ORDER BY
         CASE q.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END ASC,
         q.due_at ASC NULLS LAST,
         q.created_at ASC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    ),
    pool.query(
      `SELECT COUNT(*) AS total FROM provider_review_queue q ${where}`,
      params.slice(0, -2)
    ),
  ]);

  const items: QueueItemDTO[] = dataRes.rows.map((r) => ({
    queueId: r.queue_id,
    applicationId: r.application_id,
    appId: r.app_id,
    applicantName: r.applicant_name,
    applicantEmail: r.applicant_email,
    applicantMobile: r.applicant_mobile,
    providerType: r.provider_type,
    status: r.status,
    queueStatus: r.queue_status,
    priority: r.priority as QueuePriority,
    faceScore: r.face_score !== null ? parseFloat(r.face_score) : null,
    livenessScore: r.liveness_score !== null ? parseFloat(r.liveness_score) : null,
    ocrConfidence: r.ocr_confidence !== null ? parseFloat(r.ocr_confidence) : null,
    flags: (() => {
      try { return JSON.parse(r.flags || "[]"); } catch { return []; }
    })(),
    fraudFlags: (() => {
      try { return JSON.parse(r.fraud_flags || "[]"); } catch { return []; }
    })(),
    fraudRiskLevel: r.fraud_risk_level,
    unreadCount: r.unread_count,
    assignedTo: r.assigned_to,
    dueAt: r.due_at,
    reviewReasons: (() => {
      try { return JSON.parse(r.review_reasons || "[]"); } catch { return []; }
    })(),
    createdAt: r.created_at,
    subStatus: r.sub_status,
  }));

  return { items, total: parseInt(countRes.rows[0].total) };
}

export async function getQueueBadgeCount(): Promise<{ open: number; urgent: number }> {
  const res = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE status IN ('open','assigned')) AS open,
       COUNT(*) FILTER (WHERE status IN ('open','assigned') AND priority IN ('urgent','high')) AS urgent
     FROM provider_review_queue`
  );
  return {
    open: parseInt(res.rows[0].open || "0"),
    urgent: parseInt(res.rows[0].urgent || "0"),
  };
}

export async function logSystemMessage(input: {
  applicationId: number;
  body: string;
  providerVisible?: boolean;
}): Promise<void> {
  await logProviderMessage({
    applicationId: input.applicationId,
    direction: "outbound",
    channel: "system",
    body: input.body,
    fromAddress: "system@petwash.co.il",
    deliveryStatus: "delivered",
    providerVisible: input.providerVisible ?? false,
  });
}
