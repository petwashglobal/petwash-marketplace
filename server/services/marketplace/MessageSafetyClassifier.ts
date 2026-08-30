/**
 * MessageSafetyClassifier — CEO PROGRAM 7 + PROGRAM 8.
 *
 * Pure evaluator. Given a chat message, returns:
 *   • a safety verdict (ALLOW / ALLOW_WITH_NOTICE / WARN / BLOCK /
 *     BLOCK_AND_REVIEW / SAFETY_ESCALATION),
 *   • the reason slug set that triggered the verdict.
 *
 * The doctrine (§ Program 7) is EXPLICIT: pet-health language
 * ("my dog is in heat", "not neutered") must ALLOW. Only
 * marketplace circumvention, abusive language, threats, sexual
 * solicitation, and safety escalations trigger blocks.
 *
 * The classifier is DELIBERATELY simple:
 *   • no ML model — deterministic string patterns,
 *   • Hebrew + English patterns supported,
 *   • conservative on ambiguity — WARN is preferred over BLOCK
 *     when confidence is low.
 *
 * Callers layer moderation, reporting, and audit on top of this
 * verdict — the classifier itself never mutates the thread.
 */

export type SafetyVerdict =
  | 'ALLOW'
  | 'ALLOW_WITH_NOTICE'
  | 'WARN'
  | 'BLOCK'
  | 'BLOCK_AND_REVIEW'
  | 'SAFETY_ESCALATION';

export type ReasonCode =
  | 'CIRCUMVENTION_CASH'
  | 'CIRCUMVENTION_OFFPLATFORM'
  | 'CIRCUMVENTION_CONTACT_SHARING'
  | 'CIRCUMVENTION_PLATFORM_MENTIONED'
  | 'CASUAL_PROFANITY'
  | 'ABUSE_DIRECTED'
  | 'THREAT_PHYSICAL'
  | 'SEXUAL_SOLICITATION'
  | 'PET_HEALTH_LANGUAGE';

export interface ClassificationOutcome {
  verdict: SafetyVerdict;
  reasonCodes: ReasonCode[];
}

// ── Pattern packs ─────────────────────────────────────────────────

// Pet-health language that MUST NOT be blocked (§ Program 7 explicit).
const PET_HEALTH_PATTERNS: RegExp[] = [
  /\bin heat\b/i,
  /\bnot neutered\b/i,
  /\bnot spayed\b/i,
  /\bfleas?\b/i,
  /\btick(s)?\b/i,
  /\bvaccin(e|ation)/i,
  /\bmedication\b/i,
  /\bvet(erinary)?\b/i,
  /בכלב(י|תי)? יש/i,          // "my dog has (…)" Hebrew stem
  /לא סטרילית/i,             // "not spayed" Hebrew
  /לא מסורס/i,               // "not neutered" Hebrew
];

// Marketplace circumvention — cash, off-platform, direct contact.
const CIRCUMVENTION_CASH: RegExp[] = [
  /\bpay(ing)? (in )?cash\b/i,
  /\bcash only\b/i,
  /\bcancel\b.{0,40}\b(pay|charge)\b.{0,40}\b(less|cheap|cash)\b/i,
  /לשלם במזומן/i,
  /בטל(י)? .{0,40}?ואשלם/i,
];

const CIRCUMVENTION_OFFPLATFORM: RegExp[] = [
  /\bwhats?app\b/i,
  /\btelegram\b/i,
  /\binstagram\b/i,
  /\bnext time\b.{0,30}\boutside\b/i,
  /\bnext time\b.{0,30}\bwithout\b.{0,30}\b(petwash|the app)\b/i,
  /וואטסאפ/i,
  /טלגרם/i,
  /אינסטגרם/i,
];

const CIRCUMVENTION_CONTACT_SHARING: RegExp[] = [
  // Any phone-looking string: 8+ digits, tolerates spaces/dashes.
  /\+?\d[\d\s\-]{8,}\d/,
  // Email addresses.
  /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/i,
];

const CASUAL_PROFANITY: RegExp[] = [
  /\bf+u+c+k+\b/i,
  /\bshit\b/i,
  /\bdamn\b/i,
];

const ABUSE_DIRECTED: RegExp[] = [
  /\byou (are|'re)\s+(a\s+)?(fucking\s+)?(idiot|stupid|moron|dumb|asshole)\b/i,
  /\bshut\s+up\b/i,
  /אידיוט/i,
  /מטומטם/i,
];

const THREAT_PHYSICAL: RegExp[] = [
  /\bi(?:'| a)?ll (come|find you|hurt|kill|beat)\b/i,
  /\bi will (hurt|kill|beat|come find you)\b/i,
  /לפגוע ב(ך|כם)/i,
  /אני אבוא/i,
];

const SEXUAL_SOLICITATION: RegExp[] = [
  /\bcome over for (sex|hookup|nsa)\b/i,
  /\blet('|)s hookup\b/i,
  /\bsend nudes\b/i,
];

function anyMatch(text: string, patterns: RegExp[]): boolean {
  return patterns.some((r) => r.test(text));
}

export function classifyMessage(input: { text: string }): ClassificationOutcome {
  const text = (input.text ?? '').trim();
  if (!text) return { verdict: 'ALLOW', reasonCodes: [] };

  const reasons = new Set<ReasonCode>();

  const petHealth = anyMatch(text, PET_HEALTH_PATTERNS);
  if (petHealth) reasons.add('PET_HEALTH_LANGUAGE');

  if (anyMatch(text, THREAT_PHYSICAL)) {
    reasons.add('THREAT_PHYSICAL');
    return { verdict: 'SAFETY_ESCALATION', reasonCodes: Array.from(reasons) };
  }
  if (anyMatch(text, SEXUAL_SOLICITATION)) {
    reasons.add('SEXUAL_SOLICITATION');
    return { verdict: 'BLOCK_AND_REVIEW', reasonCodes: Array.from(reasons) };
  }
  if (anyMatch(text, ABUSE_DIRECTED)) {
    reasons.add('ABUSE_DIRECTED');
    return { verdict: 'BLOCK', reasonCodes: Array.from(reasons) };
  }

  if (anyMatch(text, CIRCUMVENTION_CASH)) {
    reasons.add('CIRCUMVENTION_CASH');
    return { verdict: 'BLOCK_AND_REVIEW', reasonCodes: Array.from(reasons) };
  }
  if (anyMatch(text, CIRCUMVENTION_OFFPLATFORM)) {
    reasons.add('CIRCUMVENTION_OFFPLATFORM');
    return { verdict: 'WARN', reasonCodes: Array.from(reasons) };
  }
  if (anyMatch(text, CIRCUMVENTION_CONTACT_SHARING)) {
    reasons.add('CIRCUMVENTION_CONTACT_SHARING');
    return { verdict: 'WARN', reasonCodes: Array.from(reasons) };
  }

  // Casual profanity that is NOT directed at the other party is
  // ALLOW_WITH_NOTICE — the doctrine explicitly says "Possible allow/
  // notice" for "Fuck, traffic is bad."
  if (anyMatch(text, CASUAL_PROFANITY)) {
    reasons.add('CASUAL_PROFANITY');
    return { verdict: 'ALLOW_WITH_NOTICE', reasonCodes: Array.from(reasons) };
  }

  // Pet-health-only messages are ALLOW.
  return { verdict: 'ALLOW', reasonCodes: Array.from(reasons) };
}
