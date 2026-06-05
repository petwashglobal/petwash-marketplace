import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

describe('Sign in with Apple account deletion revocation guardrails', () => {
  it('uses Apple REST token revocation without exposing user tokens in summaries', () => {
    const service = read('server/services/appleSignInRevocation.ts');

    expect(service).toContain('https://appleid.apple.com/auth/revoke');
    expect(service).toContain("token_type_hint: selectedToken.tokenTypeHint");
    expect(service).toContain("algorithm: 'ES256'");
    expect(service).toContain("aud: 'https://appleid.apple.com'");
    expect(service).toContain('APPLE_SIGN_IN_CLIENT_ID');
    expect(service).toContain('APPLE_SIGN_IN_PRIVATE_KEY');
    expect(service).toContain('manualRevocationRequired');

    const summaryStart = service.indexOf('export function summarizeAppleSignInRevocation');
    const summaryEnd = service.indexOf('export async function revokeAppleSignInForAccountDeletion');
    const summary = service.slice(summaryStart, summaryEnd);
    expect(summary).not.toContain('token:');
    expect(summary).not.toContain('client_secret');
  });

  it('removes stored Apple token fields after a successful revoke', () => {
    const service = read('server/services/appleSignInRevocation.ts');

    expect(service).toContain("revocationStatus: 'revoked'");
    expect(service).toContain('refreshToken: deleteField');
    expect(service).toContain('refresh_token: deleteField');
    expect(service).toContain('accessToken: deleteField');
    expect(service).toContain('access_token: deleteField');
  });

  it('wires Apple revocation into both account deletion route families', () => {
    const accountManagement = read('server/routes/account-management.ts');
    const accountDeletion = read('server/routes/account-deletion.ts');

    for (const src of [accountManagement, accountDeletion]) {
      expect(src).toContain('revokeAppleSignInForAccountDeletion');
      expect(src).toContain('summarizeAppleSignInRevocation');
      expect(src).toContain('appleSignInRevocation');
    }
  });
});
