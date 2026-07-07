/**
 * LynxRefundService — Nayax Lynx refund workflow (request → upload evidence →
 * approve / decline). Closes the "no automated refund rail" gap.
 *
 * Shapes + pitfalls are from the sandbox-VERIFIED nayax-lynx-refunds skill
 * (writechoiceorg/nayax-ai) cross-checked with the Nayax dev portal. See memory
 * nayax-ai-skills-repo-findings-2026-07-07.
 *
 * THE #1 RULE (why this service exists rather than a raw fetch): on these
 * endpoints the HTTP status can look successful while the body reports failure.
 * So success is judged from the BODY, never the status code:
 *   - refund-request  → success ONLY if the body carries a RefundID.
 *   - refund-decline  → a body like {"Status":"failed"} is a failure despite 2xx.
 *   - refund-approve  → may not complete in sandbox; treat a failed body as failed.
 *
 * GATING: ships DARK. Every call is a safe no-op unless LynxClient is wired
 * (LYNX_ENABLED + auth) AND LYNX_REFUND_ENABLED=true. It ALSO needs a Nayax token
 * with the `refund` scope, which is NOT on standard tokens — request it from your
 * Nayax rep before enabling. Money-moving, so double-gated on purpose.
 *
 * SECRETS: never logs FileData (evidence bytes) or tokens.
 */
import { lynxRequest, lynxIsWired } from './LynxClient';
import { logger } from '../lib/logger';

function refundEnabled(): boolean {
  return (process.env.LYNX_REFUND_ENABLED || '').trim().toLowerCase() === 'true';
}

/** Wired only when Lynx auth is up AND refunds are explicitly enabled. */
export function refundRailWired(): boolean {
  return lynxIsWired() && refundEnabled();
}

export interface RefundContext {
  transactionId: string;   // the Nayax TransactionId being refunded
  siteId: string;          // MachineInfo/site id
  machineAuTime: string;   // machine authorization timestamp (from the sale)
}

export interface RequestRefundParams extends RefundContext {
  amount: number;                 // RefundAmount (money units, e.g. 55 = ₪55)
  reason: string;                 // RefundReason
  emailList?: string;             // RefundEmailList (comma-sep or '')
}

export interface UploadRefundParams extends RefundContext {
  refundId: string | number;      // from the request step
  fileName: string;               // e.g. "evidence.pdf"
  fileDataBase64: string;         // base64-encoded file content (required)
}

export interface RefundResult<T = any> {
  ok: boolean;                    // TRUE only when the BODY confirms success
  wired: boolean;
  status: number;                 // HTTP status (informational only)
  refundId?: string;              // present on a successful request
  error?: string;
  raw?: T;                        // raw body for the caller to audit
}

/** The Lynx refund gateway can wrap a logical failure in a 2xx. Detect it. */
function bodyReportsFailure(data: any): boolean {
  const status = (data?.Status ?? data?.status ?? '').toString().toLowerCase();
  return status === 'failed' || status === 'failure' || status === 'error';
}

function notWired(endpoint: string): RefundResult {
  return { ok: false, wired: false, status: 0, error: 'refund_rail_not_wired', raw: { endpoint } };
}

/**
 * Step 1 — open a refund case. Success ONLY if the body returns a RefundID
 * (a 2xx without a RefundID is a failure). Save the RefundID for later steps.
 */
export async function requestRefund(p: RequestRefundParams): Promise<RefundResult> {
  if (!refundRailWired()) return notWired('refund-request');
  if (!(p.amount > 0)) return { ok: false, wired: true, status: 0, error: 'invalid_amount' };

  const body = {
    RefundAmount: p.amount,
    RefundEmailList: p.emailList ?? '',
    RefundReason: p.reason,
    TransactionId: p.transactionId,
    SiteId: p.siteId,
    MachineAuTime: p.machineAuTime,
  };
  const r = await lynxRequest('POST', '/operational/v1/payment/refund-request', body);
  const refundId = r.data != null
    ? String((r.data as any).RefundID ?? (r.data as any).RefundId ?? '') || undefined
    : undefined;

  // Judge from the body: a RefundID must be present and the body must not say failed.
  const ok = r.ok && !!refundId && !bodyReportsFailure(r.data);
  if (!ok) {
    logger.warn('[LynxRefund] request failed (no RefundID / failure body)', { httpStatus: r.status, txnTail: String(p.transactionId).slice(-6) });
    return { ok: false, wired: true, status: r.status, error: r.error || 'no_refund_id', raw: r.data };
  }
  logger.info('[LynxRefund] refund case opened', { refundId, txnTail: String(p.transactionId).slice(-6) });
  return { ok: true, wired: true, status: r.status, refundId, raw: r.data };
}

/**
 * Step 2 — attach evidence. FileData (base64) is REQUIRED; an empty body returns
 * a 400 "FileData is empty". Path is upload-refund (NOT refund-documentation).
 */
export async function uploadRefundDoc(p: UploadRefundParams): Promise<RefundResult> {
  if (!refundRailWired()) return notWired('upload-refund');
  if (!p.fileDataBase64) return { ok: false, wired: true, status: 0, error: 'file_data_empty' };

  const body = {
    RefundID: p.refundId,
    FileName: p.fileName,
    FileData: p.fileDataBase64,        // NEVER logged
    TransactionId: p.transactionId,
    SiteId: p.siteId,
    MachineAuTime: p.machineAuTime,
  };
  const r = await lynxRequest('POST', '/operational/v1/payment/upload-refund', body);
  const ok = r.ok && !bodyReportsFailure(r.data);
  if (!ok) {
    logger.warn('[LynxRefund] evidence upload failed', { httpStatus: r.status, refundId: p.refundId });
    return { ok: false, wired: true, status: r.status, error: r.error || 'upload_failed', raw: r.data };
  }
  logger.info('[LynxRefund] evidence uploaded', { refundId: p.refundId, fileName: p.fileName });
  return { ok: true, wired: true, status: r.status, refundId: String(p.refundId), raw: r.data };
}

/**
 * Step 3a — approve. Upload evidence FIRST. Approve/Decline are mutually
 * exclusive for a RefundID. May not complete in the sandbox — confirm end to end
 * with your Nayax rep. Judged from the body.
 */
export async function approveRefund(refundId: string | number, ctx?: Partial<RefundContext>): Promise<RefundResult> {
  return closeRefund('approve', refundId, ctx);
}

/** Step 3b — decline. A {"Status":"failed"} body is a failure despite a 2xx. */
export async function declineRefund(refundId: string | number, ctx?: Partial<RefundContext>): Promise<RefundResult> {
  return closeRefund('decline', refundId, ctx);
}

async function closeRefund(
  kind: 'approve' | 'decline',
  refundId: string | number,
  ctx?: Partial<RefundContext>,
): Promise<RefundResult> {
  const endpoint = `refund-${kind}`;
  if (!refundRailWired()) return notWired(endpoint);
  if (refundId == null || refundId === '') return { ok: false, wired: true, status: 0, error: 'missing_refund_id' };

  const body: Record<string, unknown> = { RefundID: refundId };
  if (ctx?.transactionId) body.TransactionId = ctx.transactionId;
  if (ctx?.siteId) body.SiteId = ctx.siteId;
  if (ctx?.machineAuTime) body.MachineAuTime = ctx.machineAuTime;

  const r = await lynxRequest('POST', `/operational/v1/payment/${endpoint}`, body);
  const ok = r.ok && !bodyReportsFailure(r.data);
  if (!ok) {
    logger.warn(`[LynxRefund] ${kind} failed`, { httpStatus: r.status, refundId, bodyStatus: (r.data as any)?.Status });
    return { ok: false, wired: true, status: r.status, error: r.error || `${kind}_failed`, raw: r.data };
  }
  logger.info(`[LynxRefund] refund ${kind}d`, { refundId });
  return { ok: true, wired: true, status: r.status, refundId: String(refundId), raw: r.data };
}

export const LynxRefundService = {
  refundRailWired,
  requestRefund,
  uploadRefundDoc,
  approveRefund,
  declineRefund,
};
