/**
 * Regression pin — NayaxFiscalDocumentGuard wired into K9000 fiscal composer.
 *
 * Task follow-up on #168: the guard shipped as a pure evaluator but
 * had ZERO callers. This pin refuses any state where the K9000
 * composer's Nayax public-card branch omits the guard call — i.e.
 * silently claims a fiscal document was auto-issued when the
 * eReceipt module is OFF and the fiscal engine is UNDECIDED per
 * the CEO 2026-08-30 audit.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  resolveMachineId,
  PETWASH_NAYAX_MACHINES,
} from '@shared/nayax/merchantConfigSpec';

const COMPOSER = fs.readFileSync(
  path.join(__dirname, '..', 'services', 'fiscalPassport', 'composer.ts'),
  'utf8',
);

describe('NayaxFiscalDocumentGuard × K9000 composer wire', () => {
  it('composer imports guardFiscalDocument from the NayaxFiscalDocumentGuard', () => {
    expect(COMPOSER).toMatch(
      /import\s*\{\s*guardFiscalDocument\s*\}\s+from\s+['"]\.\.\/marketplace\/NayaxFiscalDocumentGuard['"]/,
    );
  });

  it('composer imports resolveMachineId from merchantConfigSpec', () => {
    expect(COMPOSER).toMatch(
      /import\s*\{\s*resolveMachineId\s*\}\s+from\s+['"]@shared\/nayax\/merchantConfigSpec['"]/,
    );
  });

  it('K9000 fiscalDocument state routes through the guard for public-card paid events', () => {
    // The fix uses the pattern:
    //   isPublicCard
    //     ? (guardFiscalDocument({ machineId: resolveMachineId(event.nayaxTerminalId) ?? '' }).code === 'ASSUME_ISSUED'
    //         ? 'PENDING'
    //         : 'RECONCILIATION_REQUIRED')
    //     : 'PENDING'
    // Pin on the two anchor substrings that make the wire non-optional.
    expect(COMPOSER).toContain("guardFiscalDocument({ machineId: resolveMachineId(event.nayaxTerminalId) ?? '' })");
    expect(COMPOSER).toContain("'RECONCILIATION_REQUIRED'");
  });
});

describe('resolveMachineId — accept both machineId and deviceId forms', () => {
  it('returns the canonical machineId when the input is a machineId', () => {
    expect(resolveMachineId('182374')).toBe('182374');
    expect(resolveMachineId('182462')).toBe('182462');
  });

  it('returns the canonical machineId when the input is a deviceId', () => {
    expect(resolveMachineId('854470209')).toBe('182374');  // Kfar Saba Park 80 Green Left
    expect(resolveMachineId('188843334')).toBe('182462');  // Kfar Saba Park Ward Left
  });

  it('trims surrounding whitespace', () => {
    expect(resolveMachineId('  182374  ')).toBe('182374');
  });

  it('returns undefined for unknown identifiers, empty, null, or undefined', () => {
    expect(resolveMachineId('999999')).toBeUndefined();
    expect(resolveMachineId('')).toBeUndefined();
    expect(resolveMachineId('   ')).toBeUndefined();
    expect(resolveMachineId(null)).toBeUndefined();
    expect(resolveMachineId(undefined)).toBeUndefined();
  });

  it('covers every audited machine (4 entries)', () => {
    expect(PETWASH_NAYAX_MACHINES.length).toBe(4);
    for (const m of PETWASH_NAYAX_MACHINES) {
      expect(resolveMachineId(m.machineId)).toBe(m.machineId);
      expect(resolveMachineId(m.deviceId)).toBe(m.machineId);
    }
  });
});
