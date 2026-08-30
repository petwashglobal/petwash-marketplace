/**
 * MessageSafetyClassifier — Program 7 + 8.
 *
 * The doctrine's explicit expected outcomes appear in the CEO
 * program as concrete example sentences. Every one of them is a
 * test here.
 */
import { describe, it, expect } from 'vitest';
import { classifyMessage } from '../services/marketplace/MessageSafetyClassifier';

describe('MessageSafetyClassifier — doctrine examples', () => {
  it('"My dog is in heat." → ALLOW (pet health language)', () => {
    const r = classifyMessage({ text: 'My dog is in heat.' });
    expect(r.verdict).toBe('ALLOW');
    expect(r.reasonCodes).toContain('PET_HEALTH_LANGUAGE');
  });

  it('"My dog is not neutered." → ALLOW', () => {
    const r = classifyMessage({ text: 'My dog is not neutered.' });
    expect(r.verdict).toBe('ALLOW');
  });

  it('"Fuck, traffic is bad." → ALLOW_WITH_NOTICE (casual profanity, not directed)', () => {
    const r = classifyMessage({ text: 'Fuck, traffic is bad.' });
    expect(r.verdict).toBe('ALLOW_WITH_NOTICE');
    expect(r.reasonCodes).toContain('CASUAL_PROFANITY');
  });

  it('"You are a fucking idiot." → BLOCK (abuse directed at other party)', () => {
    const r = classifyMessage({ text: 'You are a fucking idiot.' });
    expect(r.verdict).toBe('BLOCK');
    expect(r.reasonCodes).toContain('ABUSE_DIRECTED');
  });

  it('"I\'ll come hurt you." → SAFETY_ESCALATION (physical threat)', () => {
    const r = classifyMessage({ text: "I'll come hurt you." });
    expect(r.verdict).toBe('SAFETY_ESCALATION');
    expect(r.reasonCodes).toContain('THREAT_PHYSICAL');
  });

  it('"Come over for sex." → BLOCK_AND_REVIEW (sexual solicitation)', () => {
    const r = classifyMessage({ text: 'Come over for sex.' });
    expect(r.verdict).toBe('BLOCK_AND_REVIEW');
    expect(r.reasonCodes).toContain('SEXUAL_SOLICITATION');
  });

  it('"Cancel PetWash and pay cash." → BLOCK_AND_REVIEW (marketplace circumvention)', () => {
    const r = classifyMessage({ text: 'Cancel PetWash and pay cash.' });
    expect(r.verdict).toBe('BLOCK_AND_REVIEW');
    expect(r.reasonCodes).toContain('CIRCUMVENTION_CASH');
  });
});

describe('MessageSafetyClassifier — circumvention nuances', () => {
  it('"Let\'s move to WhatsApp." → WARN', () => {
    const r = classifyMessage({ text: "Let's move to WhatsApp." });
    expect(r.verdict).toBe('WARN');
    expect(r.reasonCodes).toContain('CIRCUMVENTION_OFFPLATFORM');
  });

  it('sharing a phone number → WARN (contact sharing)', () => {
    const r = classifyMessage({ text: 'Call me on +972 50 123 4567 anytime.' });
    expect(r.verdict).toBe('WARN');
    expect(r.reasonCodes).toContain('CIRCUMVENTION_CONTACT_SHARING');
  });

  it('sharing an email → WARN', () => {
    const r = classifyMessage({ text: 'Email me at sarah@example.com.' });
    expect(r.verdict).toBe('WARN');
    expect(r.reasonCodes).toContain('CIRCUMVENTION_CONTACT_SHARING');
  });

  it('empty message → ALLOW (no reason codes)', () => {
    const r = classifyMessage({ text: '' });
    expect(r.verdict).toBe('ALLOW');
    expect(r.reasonCodes).toEqual([]);
  });

  it('routine benign message → ALLOW', () => {
    const r = classifyMessage({ text: 'Great, see you at 10!' });
    expect(r.verdict).toBe('ALLOW');
  });
});
