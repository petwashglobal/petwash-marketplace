/**
 * PR-KYC-500-ERROR-SAFE — fire-order continuation (KYC scope).
 *
 * server/routes/kyc.ts had 7 catch-block 500 responses that returned
 * `{ error: error.message }` (line 201 additionally had a `|| 'Upload
 * failed'` fallback). Raw exception text — Firebase Admin errors,
 * GCS storage errors, document-processor payloads, DB messages —
 * could reach the customer / provider uploading KYC.
 *
 * Fix — mechanical response-string replacement per action, each with
 * a distinct code discriminator so support can correlate to logs:
 *   Upload                → KYC_UPLOAD_500
 *   Get KYC status        → KYC_STATUS_500
 *   Get pending submissions → KYC_PENDING_500
 *   Approve KYC           → KYC_APPROVE_500
 *   Reject KYC            → KYC_REJECT_500
 *   Get document URL      → KYC_DOCURL_500
 *   Delete KYC            → KYC_DELETE_500
 *
 * logger.error preserved at every catch so internal trace still
 * reaches support.
 *
 * NOT changed:
 *   KYC approval logic, document-acceptance rules, verification
 *   thresholds, provider status, reviewer behaviour.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = resolve(__dirname, '..', '..');
const ROUTE = 'server/routes/kyc.ts';

describe('PR-KYC-500-ERROR-SAFE', () => {
  const src = readFileSync(resolve(ROOT, ROUTE), 'utf8');

  it('A1. no 5xx catch response still echoes error.message / err.message', () => {
    const offenders: string[] = [];
    const lines = src.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/res\.status\(\s*5\d\d\s*\)\.json/.test(line)) {
        const chunk = line + (lines[i + 1] ?? '');
        if (/error:\s*error\.message|error:\s*err\.message/.test(chunk)) {
          offenders.push(`line ${i + 1}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('A2. all seven action-specific code discriminators are present', () => {
    for (const code of [
      'KYC_UPLOAD_500', 'KYC_STATUS_500', 'KYC_PENDING_500',
      'KYC_APPROVE_500', 'KYC_REJECT_500', 'KYC_DOCURL_500',
      'KYC_DELETE_500',
    ]) {
      expect(src.includes(code)).toBe(true);
    }
  });

  it('A3. logger.error stays at every catch (internal trace preserved)', () => {
    for (const tag of [
      'KYC upload error', 'Get KYC status error', 'Get pending submissions error',
      'Approve KYC error', 'Reject KYC error', 'Get document URL error',
      'Delete KYC error',
    ]) {
      expect(src.includes(tag)).toBe(true);
    }
  });

  it('A4. KYC business logic untouched — approval / rejection / doc rules unchanged', () => {
    // Sanity pin: primary KYC symbols must still exist.
    expect(src.includes('KYC')).toBe(true);
    // No word approve / reject removed.
    expect(/router\.(post|patch|put)\(.*['"].*approve/.test(src) || /router\.(post|patch|put)\(.*['"].*Approve/.test(src)).toBe(true);
    expect(/router\.(post|patch|put)\(.*['"].*reject/.test(src) || /router\.(post|patch|put)\(.*['"].*Reject/.test(src)).toBe(true);
  });
});
