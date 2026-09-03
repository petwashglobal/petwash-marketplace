/**
 * Post-release 2026-09-03 (backlog P1): provider requestedService
 * preservation. Behaviour tests for client/src/lib/requestedProviderService.ts
 * plus a source-anchored pin on ProviderOnboarding.tsx to guarantee
 * the wire stays in place.
 *
 * The lib runs client-side but is pure JS with no React deps — we can
 * exercise it here directly.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  CANONICAL_PROVIDER_SERVICES,
  clearRequestedProviderServices,
  initialRequestedServices,
  normaliseServiceAlias,
  readRequestedServiceFromSearch,
  setRequestedProviderServices,
} from '../../client/src/lib/requestedProviderService';

function read(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8');
}

// Minimal in-memory sessionStorage shim so the lib's persistence path
// runs under Node without a jsdom environment.
class MemorySessionStorage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(k: string) {
    return this.store.has(k) ? this.store.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.store.set(k, String(v));
  }
  removeItem(k: string) {
    this.store.delete(k);
  }
  key(i: number) {
    return Array.from(this.store.keys())[i] ?? null;
  }
}

const originalSession = (globalThis as any).sessionStorage;
beforeEach(() => {
  (globalThis as any).sessionStorage = new MemorySessionStorage();
});
afterEach(() => {
  (globalThis as any).sessionStorage = originalSession;
});

describe('requestedProviderService · normaliseServiceAlias', () => {
  it('accepts canonical values verbatim', () => {
    for (const c of CANONICAL_PROVIDER_SERVICES) {
      expect(normaliseServiceAlias(c)).toBe(c);
    }
  });

  it('maps CEO canonical vocabulary (pet_sitting / dog_walking / …)', () => {
    expect(normaliseServiceAlias('pet_sitting')).toBe('sitter');
    expect(normaliseServiceAlias('dog_walking')).toBe('walker');
    expect(normaliseServiceAlias('pet_transport')).toBe('driver');
    expect(normaliseServiceAlias('training')).toBe('trainer');
  });

  it('accepts marketing shorthand and case-insensitive input', () => {
    expect(normaliseServiceAlias('SITTER')).toBe('sitter');
    expect(normaliseServiceAlias('Walkers')).toBe('walker');
    expect(normaliseServiceAlias('  petsitter  ')).toBe('sitter');
    expect(normaliseServiceAlias('K9000_operator')).toBe('station_operator');
  });

  it('rejects unknown strings, null, non-strings', () => {
    expect(normaliseServiceAlias('admin')).toBeNull();
    expect(normaliseServiceAlias('')).toBeNull();
    expect(normaliseServiceAlias(null as any)).toBeNull();
    expect(normaliseServiceAlias(42 as any)).toBeNull();
  });
});

describe('requestedProviderService · URL parsing', () => {
  it('reads ?requestedService first, then ?type, then ?role', () => {
    expect(readRequestedServiceFromSearch('?requestedService=pet_sitting')).toEqual(['sitter']);
    expect(readRequestedServiceFromSearch('?type=walker')).toEqual(['walker']);
    expect(readRequestedServiceFromSearch('?role=trainer')).toEqual(['trainer']);
  });

  it('dedupes across sources in first-seen order', () => {
    const s = readRequestedServiceFromSearch(
      '?requestedService=pet_sitting&type=sitter&role=walker',
    );
    expect(s).toEqual(['sitter', 'walker']);
  });

  it('accepts comma-separated multi-value in a single param', () => {
    expect(readRequestedServiceFromSearch('?type=sitter,walker,trainer')).toEqual([
      'sitter',
      'walker',
      'trainer',
    ]);
  });

  it('ignores unknown values silently', () => {
    expect(readRequestedServiceFromSearch('?type=admin&role=root')).toEqual([]);
  });
});

describe('requestedProviderService · session union', () => {
  it('initialRequestedServices unions URL and prior session', () => {
    setRequestedProviderServices(['walker']);
    expect(initialRequestedServices('?type=sitter')).toEqual(['sitter', 'walker']);
  });

  it('setRequestedProviderServices never demotes an existing pick', () => {
    setRequestedProviderServices(['walker']);
    setRequestedProviderServices(['sitter']);
    // Both survive
    expect(initialRequestedServices('')).toEqual(['walker', 'sitter']);
  });

  it('clearRequestedProviderServices empties session (next-visit hygiene)', () => {
    setRequestedProviderServices(['walker']);
    clearRequestedProviderServices();
    expect(initialRequestedServices('')).toEqual([]);
  });

  it('session-write is best-effort — a throwing storage never throws to caller', () => {
    (globalThis as any).sessionStorage = {
      getItem() {
        throw new Error('locked');
      },
      setItem() {
        throw new Error('locked');
      },
      removeItem() {
        throw new Error('locked');
      },
    };
    expect(() => setRequestedProviderServices(['walker'])).not.toThrow();
    expect(() => clearRequestedProviderServices()).not.toThrow();
    expect(initialRequestedServices('?type=sitter')).toEqual(['sitter']);
  });
});

describe('requestedProviderService · ProviderOnboarding wire', () => {
  it('ProviderOnboarding.tsx imports the lib and hydrates initial state', () => {
    const src = read('client/src/pages/ProviderOnboarding.tsx');
    expect(src).toMatch(/from ['"]@\/lib\/requestedProviderService['"]/);
    expect(src).toMatch(/useState[\s\S]{0,120}initialRequestedServices\(\)/);
  });

  it('ProviderOnboarding.tsx persists selections and clears on submit', () => {
    const src = read('client/src/pages/ProviderOnboarding.tsx');
    expect(src).toMatch(/setRequestedProviderServices\(next\)/);
    expect(src).toMatch(/clearRequestedProviderServices\(\)/);
  });
});
