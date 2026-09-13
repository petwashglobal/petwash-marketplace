import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const root = resolve(__dirname, '..', '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('messages route Firebase auth mount', () => {
  it('mounts private messages behind strict Firebase token validation', () => {
    const routes = read('server/routes.ts');

    expect(routes).toMatch(
      /app\.use\(\s*['"]\/api\/messages['"]\s*,\s*validateFirebaseToken\s*,\s*apiLimiter\s*,\s*messagesRoutes\s*\)/,
    );
    expect(routes).not.toMatch(
      /app\.use\(\s*['"]\/api\/messages['"]\s*,\s*optionalFirebaseToken\s*,\s*apiLimiter\s*,\s*messagesRoutes\s*\)/,
    );
  });

  it('keeps route handlers scoped to the authenticated Firebase user', () => {
    const messages = read('server/routes/messages.ts');

    expect(messages).toContain('const userId = req.firebaseUser?.uid;');
    expect(messages).toContain("return res.status(401).json({ error: 'Unauthorized' });");
    // 2026-09-13: the old pin asserted a senderId-vs-token COMPARISON. The code
    // is now stricter — the body cannot carry senderId at all; the sender is
    // resolved from the verified token. Pin that instead (rotted, not a regression).
    expect(messages).toMatch(/const sender = await resolveAuthoritativeSender\(req\);\s*if \(!sender\) return res\.status\(401\)/);
    expect(messages).toContain('senderId: sender.uid,');
    const schema = messages.slice(messages.indexOf('const sendSchema = z.object({'), messages.indexOf('});', messages.indexOf('const sendSchema = z.object({')));
    expect(schema).not.toMatch(/sender(Id|Email|Name)\s*:/);
  });
});
