/**
 * Behavioral test — provider multi-service approval (#136-3, 2026-07-25).
 *
 * A provider who selects sitter + walker + trainer must be seeded for ALL three
 * on approval, not just the primary. The full set lives in internalNotes JSON;
 * resolveApplicationServiceTypes reads every real location.
 */
import { describe, it, expect } from 'vitest';
import { resolveApplicationServiceTypes } from '../services/providerServiceApproval';

describe('resolveApplicationServiceTypes (#136-3)', () => {
  it('reads the full array from internalNotes JSON', () => {
    const app = {
      providerType: 'sitter',
      internalNotes: JSON.stringify({ declarations: {}, providerTypes: ['sitter', 'walker', 'trainer'] }),
    };
    expect(resolveApplicationServiceTypes(app)).toEqual(['sitter', 'walker', 'trainer']);
  });

  it('prefers a real array column when present', () => {
    const app = { providerType: 'sitter', providerTypes: ['walker', 'trainer'] };
    expect(resolveApplicationServiceTypes(app)).toEqual(['walker', 'trainer']);
  });

  it('falls back to the primary column when nothing else is set', () => {
    expect(resolveApplicationServiceTypes({ providerType: 'walker' })).toEqual(['walker']);
  });

  it('never returns the primary-only fallback when internalNotes has the full set', () => {
    const app = { providerType: 'sitter', internalNotes: { providerTypes: ['sitter', 'walker'] } };
    expect(resolveApplicationServiceTypes(app)).toEqual(['sitter', 'walker']);
    expect(resolveApplicationServiceTypes(app)).not.toEqual(['sitter']);
  });

  it('survives malformed internalNotes → primary fallback', () => {
    expect(resolveApplicationServiceTypes({ providerType: 'trainer', internalNotes: '{bad json' })).toEqual(['trainer']);
  });

  it('empty application → empty array', () => {
    expect(resolveApplicationServiceTypes({})).toEqual([]);
  });
});
