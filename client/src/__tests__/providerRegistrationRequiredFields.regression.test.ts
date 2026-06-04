import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const src = readFileSync(
  path.resolve(process.cwd(), 'client/src/pages/forms/ProviderRegistrationForm.tsx'),
  'utf8',
);

describe('provider registration required field gate', () => {
  it('blocks step 1 until every field marked required in the UI has a value', () => {
    const gate = src.match(/if\s*\(\s*step === 1 &&[\s\S]*?\)\s*\{\s*toast/)?.[0] ?? '';

    expect(gate).toContain('!form.platform');
    expect(gate).toContain('!form.experienceYears');
    expect(gate).toContain('!form.firstName');
    expect(gate).toContain('!form.lastName');
    expect(gate).toContain('!form.email');
    expect(gate).toContain('!form.phone');
    expect(gate).toContain('!form.idNumber');
  });
});
