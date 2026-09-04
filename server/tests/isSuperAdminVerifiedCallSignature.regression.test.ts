/**
 * REGRESSION PIN — isSuperAdminVerified call-signature contract.
 *
 * `isSuperAdminVerified(req: Request): boolean` is SYNCHRONOUS and takes the
 * Express Request (it reads `req.firebaseUser.email_verified`). Two call sites
 * had drifted to `await isSuperAdminVerified(<email string>).catch(() => false)`:
 *
 *   - server/routes/walk-my-pet.ts  GET /walks/:bookingId
 *   - server/routes/thread-chat.ts  loadThreadForCaller()
 *
 * Calling `.catch()` on a plain boolean throws
 * `TypeError: isSuperAdminVerified(...).catch is not a function` on EVERY
 * request. In walk-my-pet the outer try/catch turned that into a blanket 500,
 * so the walk-booking detail read (polled every 5s by WalkTracking.tsx) was
 * dead for the owner and the walker alike. In thread-chat there is no
 * try/catch, so on Express 4 the rejection was never forwarded and the
 * request hung with no response.
 *
 * Pin the shape so the drift cannot come back.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');
/** Strip // and /* *\/ comments so prose about the bug isn't matched as code. */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('isSuperAdminVerified call-signature contract', () => {
  it('is declared synchronous and Request-taking', () => {
    expect(read('server/middleware/rbac.ts')).toMatch(
      /export function isSuperAdminVerified\(req: Request\): boolean/,
    );
  });

  const callers = [
    'server/routes/walk-my-pet.ts',
    'server/routes/thread-chat.ts',
  ];

  for (const file of callers) {
    it(`${file} never awaits it nor chains .catch() on its boolean`, () => {
      const src = code(file);
      expect(src).not.toMatch(/await\s+isSuperAdminVerified\s*\(/);
      expect(src).not.toMatch(/isSuperAdminVerified\s*\([^)]*\)\s*\.catch/);
    });

    it(`${file} passes the Request, never an email string`, () => {
      const src = code(file);
      for (const call of src.match(/isSuperAdminVerified\(([^)]*)\)/g) ?? []) {
        // permitted: isSuperAdminVerified(req) / (req as any) / (_req)
        expect(call).toMatch(/isSuperAdminVerified\(\s*_?req(\s+as\s+any)?\s*\)/);
      }
    });
  }
});
