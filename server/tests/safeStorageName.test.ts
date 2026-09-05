/**
 * safeStorageName — traversal / header-injection pins for user-supplied
 * filenames that reach storage object keys.
 *
 * Sinks this protects (all previously interpolated `file.originalname` raw):
 *   server/routes/messaging.ts        `${conversationId}/${attachmentId}-${originalname}`
 *   server/routes/careers.ts          `careers/${applicationId}/${type}_${ts}_${originalname}`
 *   server/services/HealthSafetyService.ts    `health-safety/${incidentId}/${ts}_${originalname}`
 *   server/services/FieldOperationsService.ts `field-updates/${id}/${ts}_${originalname}`
 */

import { describe, it, expect } from 'vitest';
import { sanitizeFilenameForStorage, safeContentDisposition } from '../lib/safeStorageName';

const SAFE_TOKEN = /^[A-Za-z0-9._-]+$/;

describe('sanitizeFilenameForStorage — output shape is always safe', () => {
  const inputs: unknown[] = [
    'photo.jpg',
    '../../../../etc/passwd',
    '..\\..\\..\\windows\\system32\\config\\sam',
    '/absolute/path/file.png',
    'C:\\Users\\victim\\secret.pdf',
    'a/b/c/d.jpg',
    '....//....//evil.png',
    'file\u0000.jpg',
    'file\r\nX-Injected: yes.jpg',
    'file";X-Injected: yes;".jpg',
    'שם-קובץ-בעברית.jpg',
    '🐶🐶🐶.png',
    '   .   ',
    '.',
    '..',
    '...',
    '.htaccess',
    '.env',
    '',
    'x'.repeat(500) + '.jpg',
    null,
    undefined,
    12345,
    {},
    [],
  ];

  for (const input of inputs) {
    it(`produces a safe token for ${JSON.stringify(input)}`, () => {
      const out = sanitizeFilenameForStorage(input);
      expect(out.length).toBeGreaterThan(0);
      expect(out.length).toBeLessThanOrEqual(80);
      expect(out).toMatch(SAFE_TOKEN);
      expect(out).not.toContain('/');
      expect(out).not.toContain('\\');
      expect(out).not.toContain('..');
      expect(out.startsWith('.')).toBe(false);
      // No control characters survived.
      // eslint-disable-next-line no-control-regex
      expect(/[\u0000-\u001F\u007F]/.test(out)).toBe(false);
    });
  }
});

describe('sanitizeFilenameForStorage — specific attacks', () => {
  it('strips POSIX traversal to the basename', () => {
    expect(sanitizeFilenameForStorage('../../../../etc/passwd')).toBe('passwd');
  });

  it('strips Windows traversal even on a POSIX host', () => {
    expect(sanitizeFilenameForStorage('..\\..\\evil.png')).toBe('evil.png');
  });

  it('re-parenting via a slash is impossible', () => {
    const out = sanitizeFilenameForStorage('x/../../../other-conversation/leak.jpg');
    expect(out).toBe('leak.jpg');
  });

  it('removes a null byte rather than truncating on it', () => {
    expect(sanitizeFilenameForStorage('evil.php\u0000.jpg')).not.toContain('\u0000');
  });

  it('removes CR/LF so a header cannot be split', () => {
    const out = sanitizeFilenameForStorage('a\r\nX-Evil: 1.jpg');
    expect(out).not.toMatch(/[\r\n]/);
  });

  it('removes the double quote that broke out of filename="…"', () => {
    expect(sanitizeFilenameForStorage('a";X-Evil: 1;"b.jpg')).not.toContain('"');
  });

  it('never emits a dotfile', () => {
    expect(sanitizeFilenameForStorage('.htaccess').startsWith('.')).toBe(false);
    expect(sanitizeFilenameForStorage('.env').startsWith('.')).toBe(false);
  });

  it('neutralises executable / markup extensions', () => {
    for (const bad of ['shell.php', 'x.jsp', 'x.aspx', 'a.html', 'a.svg', 'a.js', 'run.sh', 'p.exe']) {
      const out = sanitizeFilenameForStorage(bad);
      expect(out.endsWith('.txt'), `${bad} -> ${out}`).toBe(true);
    }
  });

  it('keeps a benign name readable', () => {
    expect(sanitizeFilenameForStorage('My Resume 2026.pdf')).toBe('My_Resume_2026.pdf');
    expect(sanitizeFilenameForStorage('dog-photo_01.jpeg')).toBe('dog-photo_01.jpeg');
  });

  it('caps an absurdly long name', () => {
    const out = sanitizeFilenameForStorage('a'.repeat(5000) + '.jpg');
    expect(out.length).toBeLessThanOrEqual(80);
    expect(out.endsWith('.jpg')).toBe(true);
  });
});

describe('safeContentDisposition — no header injection', () => {
  it('produces a well-formed header for a benign name', () => {
    expect(safeContentDisposition('inline', 'photo.jpg')).toBe(
      "inline; filename=\"photo.jpg\"; filename*=UTF-8''photo.jpg",
    );
  });

  it('cannot be broken out of with a quote', () => {
    const h = safeContentDisposition('attachment', 'a";X-Evil: 1;"b.jpg');
    // Exactly two quotes: the ones we opened and closed ourselves.
    expect((h.match(/"/g) || []).length).toBe(2);
  });

  it('cannot inject a newline', () => {
    const h = safeContentDisposition('attachment', 'a\r\nX-Evil: 1.jpg');
    expect(h).not.toMatch(/[\r\n]/);
  });

  it('cannot inject a semicolon parameter via the ascii name', () => {
    const h = safeContentDisposition('attachment', 'a;charset=evil.jpg');
    const asciiPart = h.slice(h.indexOf('filename="') + 10, h.indexOf('";'));
    expect(asciiPart).not.toContain(';');
  });

  it('percent-encodes a UTF-8 name rather than emitting it raw', () => {
    const h = safeContentDisposition('inline', 'קובץ.jpg');
    expect(h).toContain("filename*=UTF-8''");
    expect(h).not.toContain('קובץ');
  });
});
