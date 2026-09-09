/**
 * Kenzo chat (chatWithPetWashAI) — every request to Gemini is bounded.
 *
 * Before: the user turn, the client-supplied history and the reply length
 * all reached Gemini unbounded, so one well-crafted long thread could drain
 * the AI budget in a single call. Pins the caps by capturing the actual
 * generateContent request.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  generateContent: vi.fn(async () => ({ candidates: [{ content: { parts: [{ text: 'Woof! 🐾' }] } }], usageMetadata: {} })),
}));

vi.mock('@google/genai', () => ({ GoogleGenAI: class { models = { generateContent: h.generateContent }; } }));
vi.mock('../lib/gemini-client', () => ({ getVertexAIConfig: () => ({}) }));
vi.mock('../middleware/aiSecurity', () => ({
  checkPromptInjection: () => ({ blocked: false }),
  redactOutboundPII: (text: string) => ({ text }),
  logAITokenUsage: async () => {},
  incrementGeminiError: () => {},
}));
vi.mock('../lib/logger', () => ({ logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

import { chatWithPetWashAI } from '../gemini';

const lastRequest = () => (h.generateContent.mock.calls.at(-1) as any[])[0];

describe('Kenzo chat bounds', () => {
  beforeEach(() => h.generateContent.mockClear());

  it('caps the reply with maxOutputTokens', async () => {
    await chatWithPetWashAI('hi', 'en');
    expect(lastRequest().config.maxOutputTokens).toBe(800);
  });

  it('truncates an oversized user turn instead of rejecting it', async () => {
    const reply = await chatWithPetWashAI('x'.repeat(5000), 'en');
    expect(reply).toContain('Woof');
    const userTurn = lastRequest().contents.at(-1);
    expect(userTurn.role).toBe('user');
    expect(userTurn.parts[0].text.length).toBe(2000);
  });

  it('keeps only the last 20 history turns, and bounds each one', async () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ role: (i % 2 ? 'model' : 'user') as 'user' | 'model', text: `turn-${i} ` + 'y'.repeat(3000) }));
    await chatWithPetWashAI('now', 'en', history);
    const contents = lastRequest().contents;
    expect(contents).toHaveLength(21);                       // 20 history + the live turn
    expect(contents[0].parts[0].text.startsWith('turn-10')).toBe(true);   // oldest 10 dropped whole
    for (const c of contents.slice(0, 20)) expect(c.parts[0].text.length).toBe(2000);
  });

  it('a short thread passes through untouched', async () => {
    const history = [{ role: 'user' as const, text: 'hello' }, { role: 'model' as const, text: 'hi!' }];
    await chatWithPetWashAI('thanks', 'he', history);
    const contents = lastRequest().contents;
    expect(contents.map((c: any) => c.parts[0].text)).toEqual(['hello', 'hi!', 'thanks']);
  });
});
