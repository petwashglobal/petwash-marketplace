/**
 * Magic-number upload validation: the spoofable Content-Type header must not be
 * the security gate — the real bytes decide. See server/lib/fileMagicValidation.ts.
 */
import { describe, it, expect } from 'vitest';
import {
  detectFileKind,
  validateFileContent,
  requireValidFileContent,
} from '../lib/fileMagicValidation';

const IMAGES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const IMAGES_PDF = [...IMAGES, 'application/pdf'];

// Minimal real headers padded to >=12 bytes.
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
const pdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3]);
const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0x24, 0, 0, 0]), Buffer.from('WEBP')]);
const heic = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftyp'), Buffer.from('heic')]);
// Attacks: HTML page + SVG-with-script, both will be claimed as image/png.
const html = Buffer.from('<!DOCTYPE html><script>alert(1)</script>            ');
const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>');

describe('detectFileKind', () => {
  it('sniffs real image/pdf headers', () => {
    expect(detectFileKind(jpeg)).toBe('jpeg');
    expect(detectFileKind(png)).toBe('png');
    expect(detectFileKind(pdf)).toBe('pdf');
    expect(detectFileKind(webp)).toBe('webp');
    expect(detectFileKind(heic)).toBe('heic');
  });
  it('returns null for HTML / SVG / junk', () => {
    expect(detectFileKind(html)).toBeNull();
    expect(detectFileKind(svg)).toBeNull();
    expect(detectFileKind(Buffer.from([0x4d, 0x5a, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull(); // MZ exe
  });
});

describe('validateFileContent', () => {
  it('accepts a real PNG even if claimed mime is weird, and rejects spoofed HTML', () => {
    expect(validateFileContent(png, IMAGES, 'application/octet-stream').ok).toBe(true);
    // HTML claiming to be a PNG — the attack the old mimetype-only filter allowed.
    const spoof = validateFileContent(html, IMAGES, 'image/png');
    expect(spoof.ok).toBe(false);
    expect(spoof.detectedMime).toBeNull();
  });
  it('rejects a real PDF where only images are allowed', () => {
    expect(validateFileContent(pdf, IMAGES).ok).toBe(false);
    expect(validateFileContent(pdf, IMAGES_PDF).ok).toBe(true);
  });
});

describe('requireValidFileContent middleware', () => {
  function run(reqFiles: any, allowed = IMAGES_PDF): Promise<{ status: number; body: any; passed: boolean }> {
    return new Promise((resolve) => {
      const req: any = { files: reqFiles };
      const res: any = {
        statusCode: 200,
        status(c: number) { this.statusCode = c; return this; },
        json(b: any) { resolve({ status: this.statusCode, body: b, passed: false }); return this; },
      };
      requireValidFileContent(allowed)(req, res, () => resolve({ status: 200, body: null, passed: true }));
    });
  }

  it('calls next() when every file is a real allowed type', async () => {
    const r = await run({ selfie: [{ fieldname: 'selfie', mimetype: 'image/png', buffer: png }] });
    expect(r.passed).toBe(true);
  });

  it('rejects 400 when a file is HTML masquerading as an image', async () => {
    const r = await run({ idFront: [{ fieldname: 'idFront', mimetype: 'image/png', buffer: html }] });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('FILE_CONTENT_REJECTED');
    expect(r.body.field).toBe('idFront');
  });
});
