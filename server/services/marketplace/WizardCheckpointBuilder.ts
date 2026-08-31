/**
 * WizardCheckpointBuilder — CEO Journey Brain Phase 2 (task #150).
 *
 * Doctrine: "The wizard writes a checkpoint at every meaningful
 * step so the user can resume on any device where they left off.
 * The checkpoint payload MUST match the shape the wizard expects
 * to restore — a fuzzy Record<string, unknown> is not enough."
 *
 * JourneyCheckpointService (already shipped) accepts any
 * `payload: Record<string, unknown>` — that means today a wizard
 * could persist a shape the RESUME path cannot safely restore.
 * This file adds:
 *
 *   • Per-CheckpointKind Zod schemas — one for each of the 7 wizard
 *     families (SIGNUP, PET_PROFILE, PROVIDER_APPLICATION,
 *     BOOKING_REQUEST, CHECKOUT, SHOP_CART, EGIFT_PURCHASE, REFUND,
 *     DOCUMENT_ACTION).
 *   • buildWizardCheckpoint({kind, ownerUid, step, payload, now}) —
 *     pure evaluator that VALIDATES the payload against the kind's
 *     schema before returning a well-formed JourneyCheckpoint. If
 *     validation fails the caller gets a typed REJECTED outcome so
 *     the wizard shows a real error rather than silently persisting
 *     junk.
 *   • parseWizardCheckpoint(cp) — RESUME-side counterpart. Given a
 *     JourneyCheckpoint (from evaluateResume), returns the
 *     narrowly-typed payload for the caller kind or a typed
 *     PAYLOAD_INVALID outcome so the wizard doesn't try to restore
 *     a payload that has since drifted from the schema.
 *
 * Pure — no DB, no I/O. The runtime store consumes the built
 * checkpoint; this file only shapes and validates.
 */

import { z } from 'zod';
import type {
  CheckpointKind,
  JourneyCheckpoint,
} from './JourneyCheckpointService';

/* ------------------------------------------------------------------
 * Per-kind payload schemas
 * ------------------------------------------------------------------ */

/**
 * Common shape across most payloads: the wizard's current
 * user-visible slug (mirrors JourneyCheckpoint.step) plus any
 * user-supplied form values the wizard needs to restore. Individual
 * kinds extend this as they need.
 */
const commonWizardShape = {
  formValues: z.record(z.string(), z.unknown()).default({}),
};

const signupPayload = z.object({
  ...commonWizardShape,
  email: z.string().email().optional(),
  mobileE164: z.string().regex(/^\+\d{6,15}$/).optional(),
  requestedRole: z.enum(['customer', 'provider']).optional(),
  requestedService: z.string().optional(),
});

const petProfilePayload = z.object({
  ...commonWizardShape,
  petId: z.string().optional(),
  petName: z.string().max(80).optional(),
  species: z.enum(['dog', 'cat', 'other']).optional(),
});

const providerApplicationPayload = z.object({
  ...commonWizardShape,
  applicationId: z.string().optional(),
  serviceOfferSlug: z.string().optional(),
});

const bookingRequestPayload = z.object({
  ...commonWizardShape,
  providerId: z.string().optional(),
  serviceSlug: z.string().optional(),
  petIds: z.array(z.string()).default([]),
  startAt: z.string().datetime({ offset: true }).optional(),
});

const checkoutPayload = z.object({
  ...commonWizardShape,
  entityRef: z.object({ kind: z.string(), id: z.string() }),
  amountMinor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

const shopCartPayload = z.object({
  ...commonWizardShape,
  items: z.array(z.object({
    sku: z.string(),
    qty: z.number().int().positive(),
  })).default([]),
});

const egiftPurchasePayload = z.object({
  ...commonWizardShape,
  recipientEmail: z.string().email().optional(),
  amountMinor: z.number().int().nonnegative().optional(),
  currency: z.string().length(3).optional(),
});

const refundPayload = z.object({
  ...commonWizardShape,
  transactionId: z.string(),
  reasonSlug: z.string().optional(),
});

const documentActionPayload = z.object({
  ...commonWizardShape,
  documentId: z.string(),
  actionSlug: z.string(),
});

export const CHECKPOINT_PAYLOAD_SCHEMAS: Record<CheckpointKind, z.ZodTypeAny> = {
  SIGNUP: signupPayload,
  PET_PROFILE: petProfilePayload,
  PROVIDER_APPLICATION: providerApplicationPayload,
  BOOKING_REQUEST: bookingRequestPayload,
  CHECKOUT: checkoutPayload,
  SHOP_CART: shopCartPayload,
  EGIFT_PURCHASE: egiftPurchasePayload,
  REFUND: refundPayload,
  DOCUMENT_ACTION: documentActionPayload,
};

/* ------------------------------------------------------------------
 * Build side
 * ------------------------------------------------------------------ */

export interface BuildInput {
  kind: CheckpointKind;
  ownerUid: string;
  step: string;
  payload: Record<string, unknown>;
  now: Date;
}

export type BuildOutcome =
  | { code: 'OK'; checkpoint: JourneyCheckpoint }
  | { code: 'REJECTED'; reasonCode:
      | 'NO_OWNER'
      | 'EMPTY_STEP'
      | 'PAYLOAD_INVALID'; issues?: readonly string[] };

export function buildWizardCheckpoint(input: BuildInput): BuildOutcome {
  if (!input.ownerUid.trim()) return { code: 'REJECTED', reasonCode: 'NO_OWNER' };
  if (!input.step.trim()) return { code: 'REJECTED', reasonCode: 'EMPTY_STEP' };
  const schema = CHECKPOINT_PAYLOAD_SCHEMAS[input.kind];
  const parsed = schema.safeParse(input.payload);
  if (!parsed.success) {
    return {
      code: 'REJECTED',
      reasonCode: 'PAYLOAD_INVALID',
      issues: parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`),
    };
  }
  return {
    code: 'OK',
    checkpoint: {
      kind: input.kind,
      ownerUid: input.ownerUid,
      step: input.step,
      payload: parsed.data,
      updatedAt: input.now.toISOString(),
    },
  };
}

/* ------------------------------------------------------------------
 * Parse side (RESUME)
 * ------------------------------------------------------------------ */

export type ParseOutcome<TPayload> =
  | { code: 'OK'; payload: TPayload }
  | { code: 'REJECTED'; reasonCode: 'KIND_MISMATCH' | 'PAYLOAD_INVALID'; issues?: readonly string[] };

/**
 * Restore a typed payload from a persisted JourneyCheckpoint.
 * The caller passes the KIND it expects; we refuse if the stored
 * checkpoint's kind does not match (defensive against dispatch bugs).
 */
export function parseWizardCheckpoint<K extends CheckpointKind>(
  cp: JourneyCheckpoint,
  expectedKind: K,
): ParseOutcome<z.infer<(typeof CHECKPOINT_PAYLOAD_SCHEMAS)[K]>> {
  if (cp.kind !== expectedKind) {
    return { code: 'REJECTED', reasonCode: 'KIND_MISMATCH' };
  }
  const parsed = CHECKPOINT_PAYLOAD_SCHEMAS[expectedKind].safeParse(cp.payload);
  if (!parsed.success) {
    return {
      code: 'REJECTED',
      reasonCode: 'PAYLOAD_INVALID',
      issues: parsed.error.issues.map((i) => `${i.path.join('.') || '<root>'}: ${i.message}`),
    };
  }
  return { code: 'OK', payload: parsed.data as z.infer<(typeof CHECKPOINT_PAYLOAD_SCHEMAS)[K]> };
}
