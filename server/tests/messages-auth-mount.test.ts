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
    expect(messages).toContain('if (validated.senderId !== userId)');
  });
});
