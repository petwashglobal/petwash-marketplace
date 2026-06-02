/**
 * Maya WhatsApp responder — honesty + intent tests.
 * No DB, no network: pure reply logic. Guards the no-false-facts rule.
 */
import { describe, it, expect } from 'vitest';
import {
  classifyIntent,
  detectLocale,
  composeReply,
} from '../services/maya/whatsappResponder';
import { PETWASH_KNOWLEDGE } from '../services/maya/petwashKnowledge';

describe('Maya WhatsApp responder', () => {
  it('detects Hebrew vs English', () => {
    expect(detectLocale('היי, מתי אתם פתוחים?')).toBe('he');
    expect(detectLocale('Hi, what are your hours?')).toBe('en');
  });

  it('classifies the core intents (Hebrew + English)', () => {
    expect(classifyIntent('באיזה שעות אתם פתוחים')).toBe('hours');
    expect(classifyIntent('what hours are you open')).toBe('hours');
    expect(classifyIntent('כמה עולה שטיפה')).toBe('price');
    expect(classifyIntent('how much does it cost')).toBe('price');
    expect(classifyIntent('איפה אתם ממוקמים')).toBe('location');
    expect(classifyIntent('where are you located')).toBe('location');
    expect(classifyIntent('כלב גדול')).toBe('large_dog');
    expect(classifyIntent('שלום')).toBe('greeting');
    expect(classifyIntent('asdf qwer')).toBe('fallback');
  });

  it('NEVER invents a price while priceRange is unset (honesty rule)', () => {
    expect(PETWASH_KNOWLEDGE.priceRange).toBeNull();
    const { reply } = composeReply('כמה עולה לשטוף כלב גדול?');
    // no shekel amount fabricated
    expect(reply).not.toMatch(/₪\s*\d/);
    expect(reply).toMatch(/נסגר|לקראת הפתיחה/); // "finalized for launch"
  });

  it('always says opening-soon in Kfar Saba and asks to capture the lead', () => {
    const { reply, locale } = composeReply('היי, אשמח לדעת באיזה שעות אתם פתוחים');
    expect(locale).toBe('he');
    expect(reply).toContain('כפר סבא');                 // opening line
    expect(reply.toLowerCase()).toContain('petwash™'.toLowerCase());
    expect(reply).toMatch(/רשימת הפתיחה|שם ועיר/);      // capture ask
  });

  it('greets the sender by first name when WhatsApp profile name is present', () => {
    const { reply } = composeReply('Hi, where are you?', 'Liat Goldenberg');
    expect(reply.startsWith('Hi Liat,')).toBe(true);
    expect(reply).toContain('Kfar Saba');
  });

  it('large-dog question is answered warmly and honestly', () => {
    const { reply, intent } = composeReply('do you handle a big dog?');
    expect(intent).toBe('large_dog');
    expect(reply.toLowerCase()).toContain('large dog');
    expect(reply).not.toMatch(/₪\s*\d/);
  });
});
