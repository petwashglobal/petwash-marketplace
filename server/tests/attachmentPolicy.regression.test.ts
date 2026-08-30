/**
 * attachmentPolicy — regression pin.
 *
 * CEO DEEP-LOGIC §19. Chat attachments must reference PetWash-owned
 * objects; external URLs are the moderation bypass path (WhatsApp QR
 * screenshot, phone-number image, bank-transfer screenshot, imgur
 * link). This module is the gate.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  classifyAttachmentUrl,
  sanitiseAttachmentName,
} from '../services/marketplace/attachmentPolicy';

beforeEach(() => {
  delete process.env.PETWASH_ASSET_ORIGINS;
});

describe('classifyAttachmentUrl — allowed origins', () => {
  it.each([
    'https://petwash.co.il/uploads/a.jpg',
    'https://app.petwash.co.il/receipts/42.pdf',
    'https://storage.googleapis.com/petwash-prod-assets/pet/xyz.jpg',
    'https://firebasestorage.googleapis.com/v0/b/petwash-prod.appspot.com/o/x.jpg',
  ])('accepts %s', (url) => {
    expect(classifyAttachmentUrl(url)).toBe('ok');
  });
});

describe('classifyAttachmentUrl — rejects external origins', () => {
  it.each([
    'https://imgur.com/xyz.png',
    'https://drive.google.com/file/d/abc',
    'http://petwash.co.il/uploads/x.jpg',                 // wrong scheme
    'https://storage.googleapis.com/some-other-bucket/x', // GCS shared host, non-petwash bucket
    'https://firebasestorage.googleapis.com/v0/b/other-project.appspot.com/o/x.jpg',
    'https://petwash.co.il.attacker.com/x.png',           // subdomain attack
    'https://petwash-fake.com/x.jpg',
    'https://wa.me/972501234567',
  ])('rejects %s → not_petwash_owned', (url) => {
    expect(classifyAttachmentUrl(url)).toBe('not_petwash_owned');
  });

  it('malformed URLs → malformed (never throws)', () => {
    expect(classifyAttachmentUrl('not a url')).toBe('malformed');
    expect(classifyAttachmentUrl('')).toBe('malformed');
  });
});

describe('classifyAttachmentUrl — PETWASH_ASSET_ORIGINS env allowlist extension', () => {
  it('adds custom origins from the env var', () => {
    process.env.PETWASH_ASSET_ORIGINS = 'https://uploads.internal.petwash';
    expect(classifyAttachmentUrl('https://uploads.internal.petwash/x.jpg')).toBe('ok');
    expect(classifyAttachmentUrl('https://uploads.internal.petwash.attacker.com/x'))
      .toBe('not_petwash_owned');
  });
});

describe('sanitiseAttachmentName — strips PII-shaped runs', () => {
  it('redacts phone-number runs', () => {
    expect(sanitiseAttachmentName('call me at 050-1234567.png')).toBe(
      'call me at [redacted].png',
    );
    // Israeli mobile with +972
    expect(sanitiseAttachmentName('+972501234567.jpg')).toBe('[redacted].jpg');
  });

  it('redacts @handles', () => {
    expect(sanitiseAttachmentName('@nir_offplatform.png')).toBe('[redacted].png');
  });

  it('trims to 200 chars', () => {
    expect(sanitiseAttachmentName('x'.repeat(500)).length).toBe(200);
  });

  it('empty / null / undefined → empty string, never crashes', () => {
    expect(sanitiseAttachmentName(undefined)).toBe('');
    expect(sanitiseAttachmentName(null)).toBe('');
    expect(sanitiseAttachmentName('')).toBe('');
  });
});
