/**
 * Provider declarations must be signable in production (2026-09-13).
 *
 * Live check as a signed-in user: GET /api/provider-declarations/status returned
 * signingConfigured:false because the flag was `!!DOCUSEAL_API_KEY` (unset in
 * prod, deliberately). The client marks every declaration "unavailable" on that
 * flag and disables the Sign button, although the in-app accept path needs no
 * DocuSeal. Result: no provider could sign any declaration, ever, in production.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const R = (p: string) => readFileSync(resolve(__dirname, '..', '..', p), 'utf8');

describe('provider declarations are signable without DocuSeal', () => {
  it('status reports signingConfigured:true independent of DOCUSEAL_API_KEY', () => {
    const src = R('server/services/providerDeclarationGate.ts');
    expect(src).toContain('signingConfigured: true,');
    expect(src).not.toContain('signingConfigured: !!process.env.DOCUSEAL_API_KEY');
  });
  it('the in-app accept route exists and does not touch DocuSeal', () => {
    const src = R('server/routes/provider-declarations.ts');
    const accept = src.slice(src.indexOf("router.post('/:key/accept'"));
    expect(accept).toContain('signingSessions');
    expect(accept).not.toContain('DOCUSEAL_API_KEY');
  });
  it('the client still gates on the flag (so the flag must be true)', () => {
    const src = R('client/src/pages/ProviderDeclarations.tsx');
    expect(src).toContain('const unavailable = !locked && !data.signingConfigured;');
  });
});
