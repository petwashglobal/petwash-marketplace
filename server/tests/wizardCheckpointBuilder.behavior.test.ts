/**
 * WizardCheckpointBuilder — task #150 (CEO Journey Brain Phase 2).
 *
 * Pins per-kind payload validation on write and safe restore on read.
 */
import { describe, it, expect } from 'vitest';
import {
  buildWizardCheckpoint,
  parseWizardCheckpoint,
  CHECKPOINT_PAYLOAD_SCHEMAS,
} from '../services/marketplace/WizardCheckpointBuilder';
import type { CheckpointKind, JourneyCheckpoint } from '../services/marketplace/JourneyCheckpointService';

const NOW = new Date('2026-08-31T12:00:00Z');

describe('WizardCheckpointBuilder', () => {
  describe('coverage', () => {
    it('has a schema for every CheckpointKind', () => {
      const kinds: CheckpointKind[] = [
        'SIGNUP', 'PET_PROFILE', 'PROVIDER_APPLICATION', 'BOOKING_REQUEST',
        'CHECKOUT', 'SHOP_CART', 'EGIFT_PURCHASE', 'REFUND', 'DOCUMENT_ACTION',
      ];
      for (const k of kinds) {
        expect(CHECKPOINT_PAYLOAD_SCHEMAS[k]).toBeDefined();
      }
    });
  });

  describe('buildWizardCheckpoint — validation', () => {
    it('OK on a minimal valid payload; injects updatedAt=now as ISO', () => {
      const v = buildWizardCheckpoint({
        kind: 'SIGNUP', ownerUid: 'uid-1', step: 'phone', payload: {}, now: NOW,
      });
      expect(v.code).toBe('OK');
      if (v.code !== 'OK') throw new Error();
      expect(v.checkpoint.kind).toBe('SIGNUP');
      expect(v.checkpoint.updatedAt).toBe('2026-08-31T12:00:00.000Z');
      expect(v.checkpoint.payload).toEqual({ formValues: {} });
    });

    it('REJECTED(NO_OWNER) on blank ownerUid', () => {
      const v = buildWizardCheckpoint({
        kind: 'SIGNUP', ownerUid: '   ', step: 'phone', payload: {}, now: NOW,
      });
      expect(v.code).toBe('REJECTED');
      if (v.code !== 'REJECTED') throw new Error();
      expect(v.reasonCode).toBe('NO_OWNER');
    });

    it('REJECTED(EMPTY_STEP) on blank step', () => {
      const v = buildWizardCheckpoint({
        kind: 'SIGNUP', ownerUid: 'u', step: '  ', payload: {}, now: NOW,
      });
      expect(v.code).toBe('REJECTED');
      if (v.code !== 'REJECTED') throw new Error();
      expect(v.reasonCode).toBe('EMPTY_STEP');
    });

    it('REJECTED(PAYLOAD_INVALID) when a field fails the kind schema; issues are surfaced', () => {
      const v = buildWizardCheckpoint({
        kind: 'SIGNUP',
        ownerUid: 'u',
        step: 'phone',
        payload: { email: 'not-an-email' },
        now: NOW,
      });
      expect(v.code).toBe('REJECTED');
      if (v.code !== 'REJECTED') throw new Error();
      expect(v.reasonCode).toBe('PAYLOAD_INVALID');
      expect(v.issues?.some((i) => i.startsWith('email:'))).toBe(true);
    });

    it('CHECKOUT requires entityRef — missing entityRef is REJECTED', () => {
      const v = buildWizardCheckpoint({
        kind: 'CHECKOUT', ownerUid: 'u', step: 'summary', payload: {}, now: NOW,
      });
      expect(v.code).toBe('REJECTED');
      if (v.code !== 'REJECTED') throw new Error();
      expect(v.reasonCode).toBe('PAYLOAD_INVALID');
    });

    it('REFUND requires transactionId — missing is REJECTED', () => {
      const v = buildWizardCheckpoint({
        kind: 'REFUND', ownerUid: 'u', step: 'reason', payload: {}, now: NOW,
      });
      expect(v.code).toBe('REJECTED');
      if (v.code !== 'REJECTED') throw new Error();
      expect(v.reasonCode).toBe('PAYLOAD_INVALID');
    });

    it('DOCUMENT_ACTION requires documentId + actionSlug', () => {
      const missingBoth = buildWizardCheckpoint({
        kind: 'DOCUMENT_ACTION', ownerUid: 'u', step: 's', payload: {}, now: NOW,
      });
      expect(missingBoth.code).toBe('REJECTED');
      const missingAction = buildWizardCheckpoint({
        kind: 'DOCUMENT_ACTION', ownerUid: 'u', step: 's', payload: { documentId: 'D' }, now: NOW,
      });
      expect(missingAction.code).toBe('REJECTED');
      const complete = buildWizardCheckpoint({
        kind: 'DOCUMENT_ACTION', ownerUid: 'u', step: 's',
        payload: { documentId: 'D', actionSlug: 'sign' }, now: NOW,
      });
      expect(complete.code).toBe('OK');
    });

    it('SHOP_CART accepts a valid items array; rejects a zero-qty item', () => {
      const ok = buildWizardCheckpoint({
        kind: 'SHOP_CART', ownerUid: 'u', step: 'cart',
        payload: { items: [{ sku: 'X', qty: 2 }] }, now: NOW,
      });
      expect(ok.code).toBe('OK');
      const bad = buildWizardCheckpoint({
        kind: 'SHOP_CART', ownerUid: 'u', step: 'cart',
        payload: { items: [{ sku: 'X', qty: 0 }] }, now: NOW,
      });
      expect(bad.code).toBe('REJECTED');
    });
  });

  describe('parseWizardCheckpoint — RESUME side', () => {
    it('OK — restores a typed payload the wizard can consume', () => {
      const built = buildWizardCheckpoint({
        kind: 'BOOKING_REQUEST',
        ownerUid: 'u',
        step: 'confirm',
        payload: { providerId: 'P-1', petIds: ['pet-1'] },
        now: NOW,
      });
      if (built.code !== 'OK') throw new Error();
      const parsed = parseWizardCheckpoint(built.checkpoint, 'BOOKING_REQUEST');
      expect(parsed.code).toBe('OK');
      if (parsed.code !== 'OK') throw new Error();
      expect(parsed.payload.providerId).toBe('P-1');
      expect(parsed.payload.petIds).toEqual(['pet-1']);
    });

    it('REJECTED(KIND_MISMATCH) when the caller asks for the wrong kind', () => {
      const built = buildWizardCheckpoint({
        kind: 'SIGNUP', ownerUid: 'u', step: 'phone', payload: {}, now: NOW,
      });
      if (built.code !== 'OK') throw new Error();
      const parsed = parseWizardCheckpoint(built.checkpoint, 'BOOKING_REQUEST');
      expect(parsed.code).toBe('REJECTED');
      if (parsed.code !== 'REJECTED') throw new Error();
      expect(parsed.reasonCode).toBe('KIND_MISMATCH');
    });

    it('REJECTED(PAYLOAD_INVALID) when a stored payload has drifted from the schema', () => {
      // Simulate a legacy row in the store with a payload that no
      // longer matches the current schema (e.g. required field
      // dropped in a stale migration).
      const stale: JourneyCheckpoint = {
        kind: 'CHECKOUT',
        ownerUid: 'u',
        step: 'summary',
        payload: { formValues: {} }, // entityRef missing
        updatedAt: NOW.toISOString(),
      };
      const parsed = parseWizardCheckpoint(stale, 'CHECKOUT');
      expect(parsed.code).toBe('REJECTED');
      if (parsed.code !== 'REJECTED') throw new Error();
      expect(parsed.reasonCode).toBe('PAYLOAD_INVALID');
    });
  });
});
