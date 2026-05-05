/**
 * Tests for AI-chat customer-facing prices.
 *
 * The AI chat (server/ai-enhanced-chat.ts + server/gemini.ts) is one of
 * the busiest customer touch-points. Drift between the chat strings
 * and the live catalogue (server/utils.ts createWashPackageData) caused
 * customers to be quoted prices the cashier could not honour
 * (consumer-protection issue).
 *
 * This test pins the chat strings to the canonical sources of truth:
 *   • Wash package prices  ↔  createWashPackageData() seed
 *   • E-gift denominations ↔  EGIFT_ALLOWED_DENOMINATIONS
 *   • Single-wash price    ↔  WASH_PRICE_ILS_CENTS
 *
 * Any future price change must update both the catalogue AND the chat
 * strings; this test fails loudly otherwise.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';
import { createWashPackageData } from '../utils';
import { EGIFT_ALLOWED_DENOMINATIONS } from '../lib/egift-denominations';
import { WASH_PRICE_ILS_CENTS } from '../services/K9000RedemptionService';

const REPO = path.resolve(__dirname, '..', '..');
const AI_CHAT_FILE = path.join(REPO, 'server', 'ai-enhanced-chat.ts');
const GEMINI_FILE = path.join(REPO, 'server', 'gemini.ts');

const aiChatText = fs.readFileSync(AI_CHAT_FILE, 'utf8');
const geminiText = fs.readFileSync(GEMINI_FILE, 'utf8');

const seed = createWashPackageData();
const onePack = seed.find((p) => p.washCount === 1)!;
const threePack = seed.find((p) => p.washCount === 3)!;
const fivePack = seed.find((p) => p.washCount === 5)!;
const tenPack = seed.find((p) => p.washCount === 10)!;

const onePrice = parseFloat(onePack.price);     // 55
const threePrice = parseFloat(threePack.price); // 150
const fivePrice = parseFloat(fivePack.price);   // 220
const tenPrice = parseFloat(tenPack.price);     // 440

describe('AI chat package prices ↔ catalogue', () => {
  it('catalogue has all four packs (regression guard)', () => {
    expect(onePack).toBeDefined();
    expect(threePack).toBeDefined();
    expect(fivePack).toBeDefined();
    expect(tenPack).toBeDefined();
  });

  it('single-wash price in chat matches catalogue + WASH_PRICE_ILS_CENTS', () => {
    expect(onePrice * 100).toBe(WASH_PRICE_ILS_CENTS);
    // Both files quote the single-wash price
    expect(aiChatText).toContain(`₪${onePrice}`); // "₪55"
    expect(geminiText).toContain(`₪${onePrice}`);
  });

  it('3-wash pack price in chat matches catalogue (₪150)', () => {
    expect(threePrice).toBe(150);
    // Hebrew + English + Arabic + Russian + French + Spanish all quote ₪150
    expect(aiChatText).toContain(`₪${threePrice}`);
    expect(geminiText).toContain(`3-wash package: ₪${threePrice}`);
  });

  it('5-wash pack price in chat matches catalogue (₪220)', () => {
    expect(fivePrice).toBe(220);
    expect(aiChatText).toContain(`₪${fivePrice}`);
    expect(geminiText).toContain(`5-wash package: ₪${fivePrice}`);
  });

  it('10-wash pack price in chat matches catalogue (₪440)', () => {
    expect(tenPrice).toBe(440);
    expect(aiChatText).toContain(`₪${tenPrice}`);
    expect(geminiText).toContain(`10-wash package: ₪${tenPrice}`);
  });

  it('chat does NOT quote any of the OLD pre-PR-W9 prices', () => {
    // Old: 145, 225, 400. All three must be gone from package-pricing
    // strings.
    for (const oldPrice of ['₪145', '₪225', '₪400']) {
      expect(aiChatText).not.toContain(oldPrice);
      expect(geminiText).not.toContain(oldPrice);
    }
  });

  it('savings amounts are arithmetically correct', () => {
    const expectedSavings = {
      three: onePrice * 3 - threePrice,  // 55*3 - 150 = 15
      five:  onePrice * 5 - fivePrice,   // 55*5 - 220 = 55
      ten:   onePrice * 10 - tenPrice,   // 55*10 - 440 = 110
    };
    expect(expectedSavings.three).toBe(15);
    expect(expectedSavings.five).toBe(55);
    expect(expectedSavings.ten).toBe(110);

    // Strings appear at least once in the chat copy
    expect(aiChatText).toContain(`₪${expectedSavings.three}`);
    expect(aiChatText).toContain(`₪${expectedSavings.five}`);
    expect(aiChatText).toContain(`₪${expectedSavings.ten}`);
  });
});

describe('AI chat e-gift denominations ↔ allowlist', () => {
  it('every CEO-confirmed denomination appears in the chat copy', () => {
    for (const d of EGIFT_ALLOWED_DENOMINATIONS) {
      expect(aiChatText).toContain(`₪${d}`);
      expect(geminiText).toContain(`₪${d}`);
    }
  });

  it('chat does NOT advertise off-list denominations (₪50, ₪200)', () => {
    // The legacy chat copy listed ₪50 / ₪100 / ₪200 / ₪500 — those
    // disagreed with the actual purchase route's allowed list.
    // Bare "₪50" or "₪200" in an e-gift list would resurface the bug.
    // We accept ₪50 / ₪200 if used elsewhere (savings, etc.) but the
    // EXACT phrase "₪50, ₪100, ₪200, ₪500" must not reappear.
    expect(aiChatText).not.toContain('₪50, ₪100, ₪200, ₪500');
    expect(aiChatText).not.toContain('₪50،'); // Arabic variant
    expect(geminiText).not.toContain('₪50, ₪100, ₪200, ₪500');
  });
});
