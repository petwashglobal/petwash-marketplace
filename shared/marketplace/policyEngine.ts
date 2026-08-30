/**
 * MarketplaceMessagePolicyEngine — CEO Deliverable B.
 *
 * Pure, deterministic-first evaluator for messages sent between a customer
 * and a provider inside PetWash. See:
 *   docs/architecture/petwash-marketplace-integrity-and-communications-2026.md
 *
 * Design rules:
 *   • Server is authority (integrity doctrine §6.1). This engine is used by
 *     the server before delivery; clients may run it for UX warnings, but
 *     never as the enforcement point.
 *   • Deterministic first (§11): links, contact patterns, payment
 *     identifiers, prohibited destinations, structured-field checks.
 *   • Classifier hook (§11): callers may inject additional category
 *     probabilities (e.g. from a moderation model). Policy version + threshold
 *     decides the action — never the classifier alone.
 *   • Contextual (§6.4): thread type + booking status + phase change the
 *     acceptable set. Vet phone in an active booking is legitimate; the same
 *     text pre-booking is not.
 *   • Explain-neutral to users (§6.10): reasons come back categorised, not
 *     as rule-match text. Callers translate to friendly copy.
 *
 * This module is dependency-free and can be imported from server (Node) and
 * client (Vite). Do not import runtime deps here.
 */

export type PolicyCategory =
  | 'OFF_PLATFORM_BOOKING'
  | 'OFF_PLATFORM_PAYMENT'
  | 'CONTACT_EXCHANGE'
  | 'EXTERNAL_MESSAGING_APP'
  | 'EXTERNAL_LINK'
  | 'SEXUAL_SOLICITATION'
  | 'SEXUAL_HARASSMENT'
  | 'ABUSIVE_LANGUAGE'
  | 'THREAT'
  | 'HATE_OR_SLUR'
  | 'SCAM_OR_FRAUD'
  | 'SPAM'
  | 'SENSITIVE_INFORMATION'
  | 'SELF_HARM_OR_DANGER'
  | 'PET_SAFETY_RISK';

export type PolicyOutcome =
  | 'ALLOW'
  | 'ALLOW_WITH_NOTICE'
  | 'WARN_BEFORE_SEND'
  | 'BLOCK'
  | 'BLOCK_AND_REVIEW'
  | 'SAFETY_ESCALATION';

export type ThreadType =
  | 'BOOKING'
  | 'MEET_AND_GREET'
  | 'SUPPORT'
  | 'K9000'
  | 'PAW_FINDER'
  | 'SHOP_ORDER'
  | 'GIFT'
  | 'PROVIDER_APPLICATION'
  | 'ADMIN';

export type BookingPhase =
  | 'PRE_REQUEST'
  | 'REQUESTED'
  | 'QUOTED'
  | 'ACCEPTED'
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'DISPUTED';

export type ParticipantRole = 'BOOKER' | 'PROVIDER' | 'STAFF' | 'SYSTEM';

/** Optional classifier hook — inject external categorisation. */
export type ClassifierScores = Partial<Record<PolicyCategory, number>>;

export interface MessageEvalInput {
  text: string;
  threadType: ThreadType;
  bookingPhase?: BookingPhase;
  senderRole: ParticipantRole;
  recipientRole: ParticipantRole;
  policyVersion: string;
  classifier?: ClassifierScores;
}

export interface PolicyMatch {
  category: PolicyCategory;
  confidence: number; // 0..1
  source: 'DETERMINISTIC' | 'CLASSIFIER';
}

export interface PolicyResult {
  outcome: PolicyOutcome;
  matches: PolicyMatch[];
  policyVersion: string;
  /**
   * Category the outcome is anchored on — used by the audit log so the
   * highest-severity match is discoverable without re-ranking on read.
   */
  primaryCategory?: PolicyCategory;
}

/** Latest published policy version — pin here so audits stamp deterministically. */
export const CURRENT_POLICY_VERSION = 'mpe-2026-08-29';

const RE_URL = /\bhttps?:\/\/[^\s]+/i;
const RE_EXTERNAL_APP = /\b(whatsapp|telegram|signal|imessage|viber|snapchat|instagram|facebook|tiktok|discord)\b/i;

// Basic IL phone matcher — very tolerant. Confidence stays modest so that
// contextual allow (vet phone in an active booking) is possible.
const RE_PHONE = /(?:\+?972[\s.-]?)?0?5[0-9][\s.-]?\d{3}[\s.-]?\d{4}\b/;
const RE_EMAIL = /\b[\w.%+-]+@[\w.-]+\.[a-zA-Z]{2,}\b/;

// Payment identifiers — bank account digits, IBAN-ish, wallet handles. This
// stays deliberately narrow: broader patterns hurt legitimate conversation.
const RE_IBAN = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/;
const RE_PAYMENT_HANDLE = /\b(paypal|paybox|bit\s?pay|revolut|paypa[l1]|venmo|wise|cash\s?app)\b/i;

// Off-platform booking / payment intent — meaning phrases, not one word.
const OFF_PLATFORM_INTENT: RegExp[] = [
  /\bcancel\b.*\b(pay|deal|do it)\b.*\b(cash|direct|private|outside|off)/i,
  /\b(pay|paying|payment)\b.*\b(cash|direct|outside|off\s?platform)/i,
  /\bnext time\b.*\b(don'?t use|without|off)\s?petwash/i,
  /\b(book|do this)\b.*\b(direct|privately|off)\b/i,
  /\btransfer\b.*\b(bank|account|iban)\b.*\b(me|my)/i,
];

// Sexual solicitation — high confidence phrases (never a keyword filter).
const SEXUAL_SOLICIT: RegExp[] = [
  /\b(come over|meet me).*(sex|hook\s?up)/i,
  /\b(want|do you want).*(sex|to sleep with)/i,
  /\bsend\b.*\b(nude|nudes|naked)/i,
];

// Threats — explicit "I will hurt you"-shaped phrases.
const THREATS: RegExp[] = [
  /\bi(?:'ll| will)\b.*(?:kill|hurt|hit|beat|find you|come after)/i,
  /\byou'?re dead\b/i,
];

// Structured-content whitelist — the LEGITIMATE contact / phone / medical
// contexts that a naive filter kills.
function isLegitimateContactPhase(input: MessageEvalInput): boolean {
  if (input.threadType !== 'BOOKING' && input.threadType !== 'MEET_AND_GREET') {
    return false;
  }
  return (
    input.bookingPhase === 'CONFIRMED' ||
    input.bookingPhase === 'IN_PROGRESS'
  );
}

function detectDeterministic(input: MessageEvalInput): PolicyMatch[] {
  const t = input.text;
  const matches: PolicyMatch[] = [];

  // Explicit off-platform intent — highest signal for anti-circumvention.
  for (const re of OFF_PLATFORM_INTENT) {
    if (re.test(t)) {
      matches.push({ category: 'OFF_PLATFORM_BOOKING', confidence: 0.9, source: 'DETERMINISTIC' });
      break;
    }
  }

  if (RE_IBAN.test(t) || RE_PAYMENT_HANDLE.test(t)) {
    matches.push({ category: 'OFF_PLATFORM_PAYMENT', confidence: 0.85, source: 'DETERMINISTIC' });
  }

  if (RE_EXTERNAL_APP.test(t)) {
    // Downgrade if it's a legitimate integration mention inside support.
    const conf = input.threadType === 'SUPPORT' ? 0.4 : 0.75;
    matches.push({ category: 'EXTERNAL_MESSAGING_APP', confidence: conf, source: 'DETERMINISTIC' });
  }

  if (RE_URL.test(t)) {
    matches.push({ category: 'EXTERNAL_LINK', confidence: 0.6, source: 'DETERMINISTIC' });
  }

  // Contact patterns — CONTEXT MATTERS. Legitimate contact phase downshifts
  // to ALLOW; other phases keep it as a strong signal (§6.8).
  const hasContact = RE_PHONE.test(t) || RE_EMAIL.test(t);
  if (hasContact && !isLegitimateContactPhase(input)) {
    matches.push({ category: 'CONTACT_EXCHANGE', confidence: 0.7, source: 'DETERMINISTIC' });
  }

  for (const re of SEXUAL_SOLICIT) {
    if (re.test(t)) {
      matches.push({ category: 'SEXUAL_SOLICITATION', confidence: 0.95, source: 'DETERMINISTIC' });
      break;
    }
  }

  for (const re of THREATS) {
    if (re.test(t)) {
      matches.push({ category: 'THREAT', confidence: 0.95, source: 'DETERMINISTIC' });
      break;
    }
  }

  return matches;
}

/**
 * Category → outcome mapping. This is the deterministic policy authority.
 * Classifier confidence can raise a match into a category but the mapping
 * here decides what to DO with the match (§11).
 */
function outcomeFor(category: PolicyCategory, confidence: number): PolicyOutcome {
  switch (category) {
    case 'SEXUAL_SOLICITATION':
    case 'SEXUAL_HARASSMENT':
      return 'BLOCK_AND_REVIEW';
    case 'THREAT':
    case 'HATE_OR_SLUR':
      return 'BLOCK_AND_REVIEW';
    case 'SELF_HARM_OR_DANGER':
      return 'SAFETY_ESCALATION';
    case 'OFF_PLATFORM_PAYMENT':
      return confidence >= 0.7 ? 'BLOCK' : 'WARN_BEFORE_SEND';
    case 'OFF_PLATFORM_BOOKING':
      return confidence >= 0.8 ? 'BLOCK' : 'WARN_BEFORE_SEND';
    case 'CONTACT_EXCHANGE':
      return confidence >= 0.7 ? 'BLOCK' : 'WARN_BEFORE_SEND';
    case 'EXTERNAL_MESSAGING_APP':
      return confidence >= 0.7 ? 'BLOCK' : 'WARN_BEFORE_SEND';
    case 'EXTERNAL_LINK':
      return 'ALLOW_WITH_NOTICE';
    case 'ABUSIVE_LANGUAGE':
      return confidence >= 0.7 ? 'BLOCK' : 'WARN_BEFORE_SEND';
    case 'SCAM_OR_FRAUD':
      return 'BLOCK_AND_REVIEW';
    case 'SPAM':
      return 'WARN_BEFORE_SEND';
    case 'SENSITIVE_INFORMATION':
      return 'WARN_BEFORE_SEND';
    case 'PET_SAFETY_RISK':
      return 'BLOCK_AND_REVIEW';
    default:
      return 'ALLOW';
  }
}

const SEVERITY: Record<PolicyOutcome, number> = {
  ALLOW: 0,
  ALLOW_WITH_NOTICE: 1,
  WARN_BEFORE_SEND: 2,
  BLOCK: 3,
  BLOCK_AND_REVIEW: 4,
  SAFETY_ESCALATION: 5,
};

/**
 * CEO DEEP-LOGIC §21 — runtime normalizer for the policy thread type.
 * The prior wire cast a DB string with `as PolicyThreadType`, which is
 * a compile-time hint that does nothing at runtime. Values the schema
 * carries but the policy vocabulary does NOT (INCIDENT, FRANCHISE)
 * would silently reach evaluateMessage() as unknown strings and the
 * outcome would depend on rule identity rather than a validated
 * threadType.
 *
 * This normalizer is a CLOSED switch. Anything unknown collapses to
 * SUPPORT — the most conservative policy context (§22 support/incident
 * moderation is stricter about generic phone numbers and looser about
 * vet/police contacts, but never LOOSER on off-platform payment).
 */
const KNOWN_POLICY_THREAD_TYPES = new Set<ThreadType>([
  'BOOKING',
  'MEET_AND_GREET',
  'SUPPORT',
  'K9000',
  'PAW_FINDER',
  'SHOP_ORDER',
  'GIFT',
  'PROVIDER_APPLICATION',
  'ADMIN',
]);
export function normalizePolicyThreadType(raw: unknown): ThreadType {
  if (typeof raw !== 'string') return 'SUPPORT';
  if (KNOWN_POLICY_THREAD_TYPES.has(raw as ThreadType)) return raw as ThreadType;
  // INCIDENT collapses to SUPPORT; FRANCHISE collapses to ADMIN. Every
  // other unknown string → SUPPORT (§22 conservative default).
  if (raw === 'INCIDENT') return 'SUPPORT';
  if (raw === 'FRANCHISE') return 'ADMIN';
  return 'SUPPORT';
}

/**
 * Evaluate a message. Pure — same input, same output. Callers persist the
 * result via a MessageModerationAudit row and decide UX.
 */
export function evaluateMessage(input: MessageEvalInput): PolicyResult {
  const detMatches = detectDeterministic(input);

  const clsMatches: PolicyMatch[] = [];
  const cls = input.classifier ?? {};
  for (const [k, conf] of Object.entries(cls)) {
    if (typeof conf !== 'number' || conf < 0.5) continue;
    clsMatches.push({
      category: k as PolicyCategory,
      confidence: Math.max(0, Math.min(1, conf)),
      source: 'CLASSIFIER',
    });
  }

  const matches = [...detMatches, ...clsMatches];

  let outcome: PolicyOutcome = 'ALLOW';
  let primary: PolicyCategory | undefined;
  for (const m of matches) {
    const cand = outcomeFor(m.category, m.confidence);
    if (SEVERITY[cand] > SEVERITY[outcome]) {
      outcome = cand;
      primary = m.category;
    }
  }

  return {
    outcome,
    matches,
    policyVersion: input.policyVersion,
    primaryCategory: primary,
  };
}
