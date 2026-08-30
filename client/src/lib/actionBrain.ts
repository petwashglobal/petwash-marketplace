/**
 * Client-side Action Brain helpers — CEO Doctrine 2026-08-30 §41, §98.
 *
 * Two functions any surface can use to consume the framework:
 *
 *   listAvailableActions(entity, id?) → AvailableAction[]
 *   executeAction(actionType, body)  → { ok, result: ActionResult }
 *
 * Plus:
 *   newIdempotencyKey()              → IdempotencyKey (per user intent)
 *
 * The helpers use apiRequest() so the auth header + CSRF handshake are
 * consistent with the rest of the app. Errors surface as typed
 * ReasonCodes — the caller maps to UX per §78.
 */
import { apiRequest } from '@/lib/queryClient';
import type {
  ActionResult,
  AvailableAction,
  IdempotencyKey,
  ReasonCode,
} from '@shared/marketplace/action';

// ── Entity → endpoint mapping ─────────────────────────────────────────

export type ActionEntity = 'booking' | 'meet-greet' | 'prestige' | 'provider-application';

function pathFor(entity: ActionEntity, id?: string): string {
  switch (entity) {
    case 'booking':
      return `/api/actions/booking/${encodeURIComponent(id ?? '')}/actions`;
    case 'meet-greet':
      return `/api/actions/meet-greet/${encodeURIComponent(id ?? '')}/actions`;
    case 'prestige':
      return `/api/actions/prestige/actions`;
    case 'provider-application':
      return `/api/actions/provider-application/${encodeURIComponent(id ?? '')}/actions`;
  }
}

// ── listAvailableActions ──────────────────────────────────────────────

export interface ListAvailableActionsResult {
  actions: AvailableAction[];
  reasonCode?: ReasonCode;
}

/**
 * GET the entity's available action set. Empty list is a valid answer
 * (nothing legal in this state) — the caller renders "no actions"
 * gracefully rather than treating it as an error.
 */
export async function listAvailableActions(
  entity: ActionEntity,
  id?: string,
): Promise<ListAvailableActionsResult> {
  const res = await apiRequest('GET', pathFor(entity, id));
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      actions: [],
      reasonCode: (body?.reasonCode as ReasonCode) ?? 'UNKNOWN',
    };
  }
  const data = await res.json();
  return { actions: Array.isArray(data?.actions) ? data.actions : [] };
}

// ── executeAction ─────────────────────────────────────────────────────

/**
 * Client body — deliberately NARROW. Client MUST NOT send impact,
 * reauthProven, riskLevel, or confirmationLevel — the server derives
 * all four from its own state + Firebase auth claims (CEO 2026-08-30
 * §1, §2). Sending them is IGNORED by the route; they are removed
 * from this type to prevent accidental client-side claims.
 */
export interface ExecuteActionBody {
  entityId: string;
  previewVersion: string;
  idempotencyKey: IdempotencyKey;
  /** Free-form domain command payload (dates, notes, etc). No security fields. */
  command?: unknown;
}

export interface ExecuteActionResponse {
  ok: boolean;
  result?: ActionResult;
  reasonCode?: ReasonCode;
}

/**
 * POST an execute request. HTTP status stays 200 on domain outcomes
 * (§39) — the ActionResult.status carries the actual result. Non-2xx
 * responses map to `{ ok: false, reasonCode }` for uniform error UX.
 */
export async function executeAction(
  actionType: string,
  body: ExecuteActionBody,
): Promise<ExecuteActionResponse> {
  const res = await apiRequest('POST', `/api/actions/${encodeURIComponent(actionType)}/execute`, body);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    return {
      ok: false,
      reasonCode: (data?.reasonCode as ReasonCode) ?? 'UNKNOWN',
    };
  }
  return { ok: true, result: data.result as ActionResult };
}

// ── Idempotency ───────────────────────────────────────────────────────

/**
 * Generate a per-user-intent idempotency key. Client keeps this stable
 * across retries — do NOT re-generate on retry (§8 discipline). Bind
 * one key to one intent (e.g. tap of a Confirm button); if the user
 * initiates a fresh intent, mint a new key.
 */
export function newIdempotencyKey(): IdempotencyKey {
  const now = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 1e9).toString(36);
  return { key: `${now}-${rand}`, scope: 'per-intent' };
}

// ── Result rendering aids ─────────────────────────────────────────────

/**
 * Should the UI show the result as a success screen (§81)?
 */
export function isTerminalSuccess(result: ActionResult): boolean {
  return result.status === 'SUCCEEDED';
}

/**
 * Should the UI keep the user on a "we're checking your payment" screen
 * (§82)? Never say failed until authoritative.
 */
export function isProcessing(result: ActionResult): boolean {
  return result.status === 'PROCESSING';
}

/**
 * §83: failure screens must offer next valid actions. This helper
 * returns whether we should render a failure card + retry / support
 * escape hatch.
 */
export function isRecoverableFailure(result: ActionResult): boolean {
  return result.status === 'FAILED' && result.userMessage.code !== 'PAYMENT_UNCERTAIN';
}

/**
 * §10 stale — refresh the preview and re-render the confirmation
 * screen with the updated numbers.
 */
export function isStale(result: ActionResult): boolean {
  return result.status === 'STALE';
}
