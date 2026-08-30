/**
 * MarketplaceServiceIndex — every entry must map to a real file.
 *
 * This regression pin catches:
 *   • a service deleted without pruning the index,
 *   • the index typoing a path,
 *   • an accidental duplicate in the catalog.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { MARKETPLACE_SERVICE_INDEX } from '../services/marketplace/MarketplaceServiceIndex';

const MARKETPLACE_DIR = path.resolve(__dirname, '../services/marketplace');

describe('MarketplaceServiceIndex', () => {
  it('every catalog path resolves to a file that exists on disk', () => {
    for (const entry of MARKETPLACE_SERVICE_INDEX) {
      const full = path.resolve(MARKETPLACE_DIR, entry.path);
      expect(fs.existsSync(full), `Missing file for catalog entry: ${entry.path}`).toBe(true);
    }
  });

  it('no duplicate paths (each service listed exactly once)', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const entry of MARKETPLACE_SERVICE_INDEX) {
      if (seen.has(entry.path)) dupes.push(entry.path);
      seen.add(entry.path);
    }
    expect(dupes).toEqual([]);
  });

  it('every entry has a non-empty programCode + summary', () => {
    for (const entry of MARKETPLACE_SERVICE_INDEX) {
      expect(entry.programCode.length).toBeGreaterThan(0);
      expect(entry.summary.length).toBeGreaterThan(3);
    }
  });

  it('has at least one entry for the five most-critical doctrine anchors', () => {
    const codes = new Set(MARKETPLACE_SERVICE_INDEX.map((e) => e.programCode));
    for (const anchor of ['DOCTRINE_84', 'DOCTRINE_12', 'PROGRAM_5', 'PROGRAM_18', 'PROGRAM_34']) {
      expect(codes.has(anchor), `Missing catalog entry for ${anchor}`).toBe(true);
    }
  });
});
