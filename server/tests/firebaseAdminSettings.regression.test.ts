import { describe, it, expect } from 'vitest';

/**
 * PR-WALLET-FIXES — Firestore settings() guard.
 *
 * firestore.settings() may be called at most once per underlying instance.
 * The instance is a persistent singleton that survives module re-imports
 * (Vitest re-evaluating modules between test files), so repeated entry through
 * getFirestore() — or a re-imported module — must NOT throw
 * "settings() can only be called once".
 */
describe('firebase-admin Firestore settings() guard', () => {
  it('exports db and applies settings() at most once across repeated getFirestore() calls', async () => {
    const mod = await import('../lib/firebase-admin');
    expect(mod.db).toBeDefined();
    expect(() => {
      mod.getFirestore();
      mod.getFirestore();
      mod.getFirestore();
    }).not.toThrow();
  });

  it('survives a re-import of the module without throwing', async () => {
    await import('../lib/firebase-admin');
    const reimported = await import('../lib/firebase-admin');
    expect(() => reimported.getFirestore()).not.toThrow();
  });
});
