import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SRC = readFileSync(join(__dirname, 'Pets.tsx'), 'utf8');

describe('Pets.tsx createMutation response parsing (agent finding #7)', () => {
  it('createMutation parses the Response body before returning', () => {
    // The apiRequest helper returns a Promise<Response>. If the mutation
    // returns the raw Response, `response?.pet` in onSuccess is always
    // undefined and the trackPetAdded analytics call never fires.
    expect(SRC).toMatch(/const\s+res\s*=\s*await\s+apiRequest\(['"]\/api\/pets['"]/);
    expect(SRC).toMatch(/return\s+await\s+res\.json\(\);?/);
  });

  it('onSuccess reads pet id from parsed JSON body with fallback', () => {
    expect(SRC).toMatch(/response\?\.pet\?\.id\s*\?\?\s*response\?\.id/);
  });

  it('does not reintroduce the raw Response.pet read that silently dropped analytics', () => {
    const stripped = SRC.replace(/\/\/[^\n]*/g, '');
    expect(stripped).not.toMatch(/if\s*\(user\s*&&\s*response\?\.pet\)\s*\{/);
  });
});
