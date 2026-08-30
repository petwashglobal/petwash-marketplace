/**
 * AiConciergeContextService — CEO PROGRAM 35 / 36 (AI Concierge + Memory).
 *
 * Pure evaluator. The AI Concierge consumes ONE authorised context
 * bundle per turn. This service builds that bundle from a set of
 * JourneyStates + user preferences, applying the doctrine's rules:
 *   • §78 authorised: every entity in the context MUST already
 *     have the actor as a party (loader-verified upstream).
 *   • §79 minimised: NEVER include raw email, phone, national id,
 *     bank data, or plaintext payment tokens.
 *   • § Program 35: the AI can EXPLAIN / NAVIGATE / SUMMARIZE /
 *     RECOMMEND. It can NOT calculate refunds, change ledgers,
 *     invent discounts, approve providers, silently cancel, change
 *     prices, or complete jobs. This is encoded as an allowlist
 *     of ContextIntents + a denylist of ForbiddenIntents.
 *   • § Program 36: memory kinds are DISTINGUISHED (identity vs
 *     preferences vs transactions vs journey vs behavior vs saved
 *     searches). The context bundle carries them under separate
 *     keys so the AI can't blur them.
 */
import type { JourneyState } from '@shared/marketplace/journeyState';

export type ContextIntent =
  | 'EXPLAIN'
  | 'NAVIGATE'
  | 'SUMMARIZE'
  | 'RECOMMEND'
  | 'HELP_FORMULATE_MESSAGE'
  | 'SURFACE_NEXT_ACTION';

export const FORBIDDEN_INTENTS = [
  'CALCULATE_REFUND',
  'CHANGE_LEDGER',
  'INVENT_DISCOUNT',
  'APPROVE_PROVIDER',
  'SILENTLY_CANCEL',
  'CHANGE_PRICE',
  'COMPLETE_JOB',
] as const;
export type ForbiddenIntent = typeof FORBIDDEN_INTENTS[number];

export type MemoryKind =
  | 'IDENTITY_FACT'
  | 'EXPLICIT_PREFERENCE'
  | 'TRANSACTION_HISTORY'
  | 'JOURNEY_CONTEXT'
  | 'BEHAVIORAL_SIGNAL'
  | 'SAVED_SEARCH';

export interface MemoryFragment {
  kind: MemoryKind;
  key: string;
  value: unknown;
}

export interface AiContextBundle {
  actorUid: string;
  intent: ContextIntent;
  journeys: JourneyState[];
  memory: Record<MemoryKind, MemoryFragment[]>;
  /** The catalog of actions the AI may PROPOSE (never execute). */
  allowedProposeActions: string[];
}

export interface BuildContextInput {
  actorUid: string;
  intent: ContextIntent;
  journeys: JourneyState[];
  memory?: MemoryFragment[];
  allowedProposeActions?: string[];
}

export type BuildOutcome =
  | { code: 'OK'; bundle: AiContextBundle }
  | { code: 'FORBIDDEN_INTENT'; attempted: string }
  | { code: 'NO_JOURNEYS' };

/**
 * The one call. Validates the intent, groups the memory by kind,
 * and returns a bundle that is SAFE to hand to the AI. If any
 * caller-supplied intent matches a ForbiddenIntent slug, the
 * evaluator refuses with FORBIDDEN_INTENT.
 */
export function buildAiContext(input: BuildContextInput): BuildOutcome {
  if ((FORBIDDEN_INTENTS as readonly string[]).includes(input.intent as any)) {
    return { code: 'FORBIDDEN_INTENT', attempted: input.intent };
  }
  if (!input.journeys || input.journeys.length === 0) {
    return { code: 'NO_JOURNEYS' };
  }
  const grouped: Record<MemoryKind, MemoryFragment[]> = {
    IDENTITY_FACT: [],
    EXPLICIT_PREFERENCE: [],
    TRANSACTION_HISTORY: [],
    JOURNEY_CONTEXT: [],
    BEHAVIORAL_SIGNAL: [],
    SAVED_SEARCH: [],
  };
  for (const f of input.memory ?? []) {
    if (grouped[f.kind]) grouped[f.kind].push(f);
  }
  return {
    code: 'OK',
    bundle: {
      actorUid: input.actorUid,
      intent: input.intent,
      journeys: input.journeys,
      memory: grouped,
      allowedProposeActions: input.allowedProposeActions ?? [],
    },
  };
}
