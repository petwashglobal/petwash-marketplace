/**
 * CEO AUTH MASTER §P0-1 (2026-08-29) — provider requestedService
 * intent MUST survive from Sitter / Walk My Pet / Academy CTA all
 * the way to the ProviderOnboarding wizard.
 *
 * Two pins:
 *   1. the canonical lib normalises every alias to the 5-string
 *      legacy vocabulary the wizard + backend already speak
 *   2. ProviderOnboarding calls initialRequestedServices() (which
 *      merges URL + sessionStorage) — NOT `useState([])` any more —
 *      and the draft-restore path UNIONs with the current selection
 *      rather than demoting to a single stored role
 *
 * This suite is source-anchored; the runtime behaviour is exercised
 * separately by the Playwright canary. A refactor that quietly drops
 * either pin trips CI here first.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

// Live tests against the library.
import {
  normaliseServiceAlias,
  readRequestedServiceFromSearch,
  readPreservedRequestedServices,
  setRequestedProviderServices,
  addRequestedProviderServiceIntent,
  replaceProviderServiceSelection,
  clearRequestedProviderServices,
  initialRequestedServices,
  CANONICAL_SERVICES,
  REQUESTED_SERVICE_SS_KEY,
} from '../../client/src/lib/requestedProviderService';

const ONBOARDING = fs.readFileSync(
  path.resolve(__dirname, '..', '..', 'client', 'src', 'pages', 'ProviderOnboarding.tsx'),
  'utf8',
);

describe('requestedProviderService — alias normalisation', () => {
  it('maps every CTA vocabulary to CANONICAL_SERVICES', () => {
    // Legacy `type=` / `role=` labels the CTAs currently emit.
    expect(normaliseServiceAlias('walker')).toBe('walker');
    expect(normaliseServiceAlias('sitter')).toBe('sitter');
    expect(normaliseServiceAlias('trainer')).toBe('trainer');
    expect(normaliseServiceAlias('driver')).toBe('driver');
    expect(normaliseServiceAlias('station_operator')).toBe('station_operator');
    // CEO-directed canonical vocabulary (map back to legacy labels).
    expect(normaliseServiceAlias('dog_walking')).toBe('walker');
    expect(normaliseServiceAlias('pet_sitting')).toBe('sitter');
    expect(normaliseServiceAlias('training')).toBe('trainer');
    expect(normaliseServiceAlias('pet_transport')).toBe('driver');
    expect(normaliseServiceAlias('pet_trek')).toBe('driver');
    // Marketing shorthand a landing page might send.
    expect(normaliseServiceAlias('walk')).toBe('walker');
    expect(normaliseServiceAlias('sit')).toBe('sitter');
    expect(normaliseServiceAlias('train')).toBe('trainer');
  });

  it('drops unknown / hostile values silently — never throws, never returns garbage', () => {
    for (const bad of [null, undefined, '', 'admin', 'provider', 'customer', 'super_admin', '<script>']) {
      expect(normaliseServiceAlias(bad as any)).toBeNull();
    }
  });

  it('case-insensitive + trims whitespace', () => {
    expect(normaliseServiceAlias('  SITTER  ')).toBe('sitter');
    expect(normaliseServiceAlias('WALKER')).toBe('walker');
  });
});

describe('requestedProviderService — URL reader', () => {
  it('accepts the canonical key requestedService first', () => {
    expect(readRequestedServiceFromSearch('?requestedService=sitter')).toBe('sitter');
    expect(readRequestedServiceFromSearch('?requestedService=pet_sitting')).toBe('sitter');
  });

  it('accepts legacy type= second', () => {
    expect(readRequestedServiceFromSearch('?type=walker')).toBe('walker');
    expect(readRequestedServiceFromSearch('?type=dog_walking')).toBe('walker');
  });

  it('accepts legacy role= third', () => {
    expect(readRequestedServiceFromSearch('?role=trainer')).toBe('trainer');
    expect(readRequestedServiceFromSearch('?role=training')).toBe('trainer');
  });

  it('URLSearchParams instance also accepted', () => {
    const p = new URLSearchParams();
    p.set('type', 'sitter');
    expect(readRequestedServiceFromSearch(p)).toBe('sitter');
  });

  it('returns null when nothing is set', () => {
    expect(readRequestedServiceFromSearch('?other=1')).toBeNull();
    expect(readRequestedServiceFromSearch('')).toBeNull();
    expect(readRequestedServiceFromSearch(null)).toBeNull();
  });
});

describe('requestedProviderService — sessionStorage preservation', () => {
  const backing: Record<string, string> = {};
  const fakeStorage: Storage = {
    get length() { return Object.keys(backing).length; },
    clear: () => { for (const k of Object.keys(backing)) delete backing[k]; },
    getItem: (k) => (k in backing ? backing[k] : null),
    key: (i) => Object.keys(backing)[i] ?? null,
    removeItem: (k) => { delete backing[k]; },
    setItem: (k, v) => { backing[k] = v; },
  };
  beforeAll(() => {
    (globalThis as any).window = { sessionStorage: fakeStorage, location: { search: '' } };
  });
  beforeEach(() => { fakeStorage.clear(); });

  it('addRequestedProviderServiceIntent unions duplicates dedup — CTA seed path', () => {
    addRequestedProviderServiceIntent('sitter');
    addRequestedProviderServiceIntent(['walker', 'sitter']); // duplicate must dedupe
    expect(readPreservedRequestedServices().sort()).toEqual(['sitter', 'walker']);
    expect(backing[REQUESTED_SERVICE_SS_KEY]).toBeDefined();
  });

  it('addRequestedProviderServiceIntent drops non-canonical values silently', () => {
    addRequestedProviderServiceIntent(['sitter', 'admin' as any, 'walker']);
    expect(readPreservedRequestedServices().sort()).toEqual(['sitter', 'walker']);
  });

  it('clear() removes the entry', () => {
    addRequestedProviderServiceIntent('sitter');
    clearRequestedProviderServices();
    expect(readPreservedRequestedServices()).toEqual([]);
  });

  it('CEO §7 §8 — replaceProviderServiceSelection is EXACT, never a union', () => {
    // Seed the intent (as if a CTA had done it).
    addRequestedProviderServiceIntent(['sitter', 'walker']);
    expect(readPreservedRequestedServices().sort()).toEqual(['sitter', 'walker']);
    // User deselects sitter in the picker.
    replaceProviderServiceSelection(['walker']);
    // Sitter MUST be gone from storage. A subsequent reload must not
    // resurrect it. This is the exact CEO §7 regression pin.
    expect(readPreservedRequestedServices()).toEqual(['walker']);
  });

  it('CEO §7 §8 — deselecting the last service leaves an empty array', () => {
    replaceProviderServiceSelection(['sitter']);
    replaceProviderServiceSelection([]);
    // Empty array means "user actively picked nothing" — the entry
    // still exists (empty JSON array), so the seed cannot re-inject
    // itself. The submit / abandon path uses
    // clearRequestedProviderServices() to remove the key entirely.
    expect(readPreservedRequestedServices()).toEqual([]);
    expect(backing[REQUESTED_SERVICE_SS_KEY]).toBe('[]');
  });

  it('CEO §7 §8 — replace also strips non-canonical values', () => {
    replaceProviderServiceSelection(['walker', 'admin' as any, 'sitter']);
    expect(readPreservedRequestedServices().sort()).toEqual(['sitter', 'walker']);
  });

  it('legacy setRequestedProviderServices remains an alias to intent-add (union)', () => {
    // Kept for one release to avoid breaking external callers; the
    // codebase itself should use the two named functions.
    setRequestedProviderServices(['sitter']);
    setRequestedProviderServices(['walker']);
    expect(readPreservedRequestedServices().sort()).toEqual(['sitter', 'walker']);
    // Clean up the shared backing so the next describe's tests do not
    // see leftover state via the fake storage.
    clearRequestedProviderServices();
  });
});

describe('requestedProviderService — initialRequestedServices', () => {
  it('URL comes first (that is the latest tap)', () => {
    expect(initialRequestedServices('?type=trainer')).toEqual(['trainer']);
  });

  it('URL + session dedupe + preserve order', () => {
    (globalThis as any).window ??= { sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, location: { search: '' } };
    (globalThis as any).window.sessionStorage.getItem = (k: string) =>
      k === REQUESTED_SERVICE_SS_KEY ? JSON.stringify(['sitter', 'walker']) : null;
    expect(initialRequestedServices('?type=sitter')).toEqual(['sitter', 'walker']);
    (globalThis as any).window.sessionStorage.getItem = () => null;
  });

  it('returns [] when neither URL nor session has anything', () => {
    (globalThis as any).window ??= { sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }, location: { search: '' } };
    (globalThis as any).window.sessionStorage.getItem = () => null;
    expect(initialRequestedServices('')).toEqual([]);
  });
});

describe('ProviderOnboarding.tsx — consumes the intent (P0-1 wire)', () => {
  it('imports initialRequestedServices + both add/replace helpers + clearRequestedProviderServices + CanonicalService', () => {
    expect(ONBOARDING).toMatch(/initialRequestedServices,\s*\n\s*addRequestedProviderServiceIntent,\s*\n\s*replaceProviderServiceSelection,\s*\n\s*clearRequestedProviderServices,\s*\n\s*type CanonicalService,\s*\n\} from '@\/lib\/requestedProviderService';/);
    // The old ambiguous name must not be called anywhere in this file.
    expect(ONBOARDING).not.toMatch(/setRequestedProviderServices\s*\(/);
  });

  it('initialises providerTypes FROM initialRequestedServices — no more useState([])', () => {
    // The exact regression the CEO named — the old
    // `useState([])` swallowed every CTA intent.
    expect(ONBOARDING).toMatch(/useState<Array<CanonicalService>>\(\(\) =>\s*\n\s*initialRequestedServices\(\)/);
    expect(ONBOARDING).not.toMatch(/const \[providerTypes, setProviderTypes\] = useState<Array<[^>]+>>\(\[\]\)/);
  });

  it('CEO §7 §8 — picker toggle uses EXACT REPLACE (never a union)', () => {
    // Every user tap of a service card writes the CURRENT selection
    // back to sessionStorage. A union would resurrect a deselected
    // service on reload — the exact bug §7 caught.
    expect(ONBOARDING).toMatch(/if \(next\.length > 0\) replaceProviderServiceSelection\(next\);/);
    expect(ONBOARDING).toMatch(/else clearRequestedProviderServices\(\);/);
    // Belt-and-braces: the picker path must not accidentally call the
    // intent (union) helper.
    const togglePathMatch = ONBOARDING.match(/const toggleProviderType[\s\S]*?\n {2}\};/);
    expect(togglePathMatch).not.toBeNull();
    expect(togglePathMatch![0]).not.toMatch(/addRequestedProviderServiceIntent/);
  });

  it('draft-restore path uses intent-add (union with existing selection — never demotes)', () => {
    // A returning applicant who tapped Sitter this session keeps
    // Sitter even if their older draft was walker-only.
    expect(ONBOARDING).toMatch(/UNION with the URL\/session\s*\n\s*\/\/ intent so a returning applicant/);
    expect(ONBOARDING).toMatch(/for \(const t of s2\.providerTypes as CanonicalService\[\]\) \{[\s\S]*?if \(!merged\.includes\(t\)\) merged\.push\(t\);/);
    // Draft-restore is intent territory, not picker replacement.
    expect(ONBOARDING).toMatch(/addRequestedProviderServiceIntent\(merged\)/);
  });

  it('successful /apply submit clears the sessionStorage entry', () => {
    // A revisit after a successful submit does NOT re-inject the
    // consumed service into a fresh application.
    expect(ONBOARDING).toMatch(/setApplicationSubmitted\(true\);[\s\S]*?clearRequestedProviderServices\(\);/);
  });
});

describe('CANONICAL_SERVICES — the alphabet the backend already speaks', () => {
  it('carries exactly the 5-string legacy vocabulary the wizard + provider_services rows use', () => {
    expect([...CANONICAL_SERVICES].sort()).toEqual(
      ['driver', 'sitter', 'station_operator', 'trainer', 'walker'].sort(),
    );
  });
});
