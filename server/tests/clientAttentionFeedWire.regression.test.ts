/**
 * Regression pin — client Attention feed hook + list.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CLIENT_ROOT = path.resolve(__dirname, '../../client/src');
const HOOK = fs.readFileSync(path.join(CLIENT_ROOT, 'hooks/useAttentionCandidates.ts'), 'utf8');
const LIST = fs.readFileSync(path.join(CLIENT_ROOT, 'components/marketplace/AttentionFeedList.tsx'), 'utf8');

describe('client Attention feed wire', () => {
  it('hook exports useAttentionCandidates and applies useMemo (deterministic order)', () => {
    expect(HOOK).toMatch(/export function useAttentionCandidates\(/);
    expect(HOOK).toMatch(/useMemo\(/);
  });

  it('hook enforces the 30-item ceiling', () => {
    expect(HOOK).toMatch(/MAX_ITEMS = 30/);
  });

  it('hook §75 discipline: marketing capped to INFO when a REQUIRED obligation exists', () => {
    expect(HOOK).toMatch(/domain === 'MARKETING' && requiredExists/);
  });

  it('list shows NO_ATTENTION_ITEMS placeholder when empty', () => {
    expect(LIST).toContain('NO_ATTENTION_ITEMS');
    expect(LIST).toContain('attention-feed-empty');
  });

  it('list carries data-priority + data-domain + data-required per item', () => {
    expect(LIST).toContain('data-priority={it.priority}');
    expect(LIST).toContain('data-domain={it.domain}');
    expect(LIST).toContain("data-required={it.isRequired ? '1' : '0'}");
  });

  it('list renders priority as slug (never invented copy)', () => {
    expect(LIST).toMatch(/\{it\.priority\}/);
    expect(LIST).toMatch(/\{it\.domain\}/);
    expect(LIST).toMatch(/\{it\.reasonCode\}/);
  });
});
