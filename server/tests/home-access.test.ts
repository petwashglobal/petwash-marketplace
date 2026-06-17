/**
 * Home-access subsystem tests: the booking gate (no signed authority → no
 * booking), the AES-256-GCM access-detail encryption round-trip + fail-closed,
 * and source-introspection that the service refuses early access and logs views.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { resolveHomeBookingGate, isHomeService } from '../../shared/home-service-gate';

const ROOT = resolve(__dirname, '..', '..');
const src = (rel: string) => readFileSync(resolve(ROOT, rel), 'utf8');

const allSigned = {
  propertyAuthoritySigned: true, propertyFormComplete: true, petCareComplete: true,
  insuranceNoticeAccepted: true, providerHomeAccessAgreementSigned: true,
};

describe('home-service booking gate', () => {
  it('classifies the home services', () => {
    expect(isHomeService('pet_sitting')).toBe(true);
    expect(isHomeService('dog_walking')).toBe(false);
  });
  it('all prerequisites signed → bookable', () => {
    expect(resolveHomeBookingGate(allSigned)).toMatchObject({ bookable: true, status: 'ready' });
  });
  it('no authority declaration → blocked (authority first)', () => {
    const r = resolveHomeBookingGate({ ...allSigned, propertyAuthoritySigned: false });
    expect(r.bookable).toBe(false);
    expect(r.status).toBe('property_authority_missing');
    expect(r.missing).toContain('property_authority_declaration');
  });
  it('missing provider agreement → provider_acceptance_pending', () => {
    expect(resolveHomeBookingGate({ ...allSigned, providerHomeAccessAgreementSigned: false }).status)
      .toBe('provider_acceptance_pending');
  });
  it('missing insurance notice is reported', () => {
    expect(resolveHomeBookingGate({ ...allSigned, insuranceNoticeAccepted: false }).missing)
      .toContain('insurance_no_cover_notice');
  });
});

describe('access-detail encryption (AES-256-GCM)', () => {
  beforeAll(() => { process.env.HOME_ACCESS_ENC_KEY = 'a'.repeat(64); }); // 32-byte hex test key
  it('round-trips ciphertext back to plaintext', async () => {
    const { encryptAccess, decryptAccess, isHomeAccessEncryptionReady } = await import('../lib/homeAccessCrypto');
    expect(isHomeAccessEncryptionReady()).toBe(true);
    const secret = 'Door code 4827#, key under 2nd pot';
    const blob = encryptAccess(secret);
    expect(blob).not.toContain(secret);            // not plaintext
    expect(decryptAccess(blob)).toBe(secret);      // reversible
  });
  it('fails closed when no key is configured (never stores plaintext)', async () => {
    const saved = process.env.HOME_ACCESS_ENC_KEY;
    delete process.env.HOME_ACCESS_ENC_KEY;
    const { encryptAccess } = await import('../lib/homeAccessCrypto');
    expect(() => encryptAccess('secret')).toThrow();
    process.env.HOME_ACCESS_ENC_KEY = saved;
  });
});

describe('service enforces access rules (source-introspection)', () => {
  const svc = src('server/services/homeAccessService.ts');
  it('refuses to release access before booking confirmed', () => {
    expect(svc).toMatch(/bookingConfirmed/);
    expect(svc).toMatch(/BOOKING_NOT_CONFIRMED/);
  });
  it('logs every view to home_access_logs before returning the secret', () => {
    const insertIdx = svc.indexOf('homeAccessLogs');
    const returnIdx = svc.indexOf('decryptAccess(prop.addressEncrypted');
    expect(insertIdx).toBeGreaterThan(-1);
    expect(returnIdx).toBeGreaterThan(insertIdx); // audit insert precedes the secret return
  });
});

describe('migration creates the home-access tables', () => {
  const mig = src('migrations/0054_home_access_subsystem.sql');
  it('creates customer_properties, property_authority_declarations, home_access_logs', () => {
    expect(mig).toMatch(/CREATE TABLE IF NOT EXISTS customer_properties/);
    expect(mig).toMatch(/CREATE TABLE IF NOT EXISTS property_authority_declarations/);
    expect(mig).toMatch(/CREATE TABLE IF NOT EXISTS home_access_logs/);
  });
  it('stores access details encrypted', () => {
    expect(mig).toMatch(/access_instructions_encrypted/);
    expect(mig).toMatch(/address_encrypted/);
  });
});
