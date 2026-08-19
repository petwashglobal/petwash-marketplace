import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const SVC = readFileSync(
  join(__dirname, '..', '..', 'server', 'services', 'PetIdentificationService.ts'),
  'utf8',
);
const ROUTE = readFileSync(
  join(__dirname, '..', '..', 'server', 'routes', 'paw-finder.ts'),
  'utf8',
);

// Regression pin for COMPETITIVE (WhatIDog gap, 2026-08-19): PawFinder upload
// now returns a Gemini-generated pet identification alongside the URL so the
// client can auto-fill the lost/found form. Fail-quiet when Gemini is not
// configured. Never blocks the upload.

describe('PawFinder AI identify (COMPETITIVE / WhatIDog gap)', () => {
  it('service exposes identifyFromBuffer with a fail-quiet contract', () => {
    expect(SVC).toMatch(/async identifyFromBuffer\(\s*imageBuffer: Buffer,\s*mimeType: string,?\s*\)/);
    expect(SVC).toMatch(/errorCode\?:\s*['"]no_gemini['"]\s*\|\s*['"]no_json['"]\s*\|\s*['"]gemini_error['"]\s*\|\s*['"]not_a_pet['"]/);
    expect(SVC).toMatch(/return\s*\{\s*ok:\s*true,\s*degraded:\s*true,\s*errorCode:\s*['"]no_gemini['"]\s*\}/);
  });

  it('service uses the shared Gemini stack (@google/genai + getVertexAIConfig)', () => {
    expect(SVC).toMatch(/from ['"]@google\/genai['"]/);
    expect(SVC).toMatch(/from ['"]\.\.\/lib\/gemini-client['"]/);
    // Model name — matches ContentModerationService for consistency.
    expect(SVC).toMatch(/model:\s*['"]gemini-2\.5-flash['"]/);
  });

  it('service coerces model output to the canonical 9-species enum', () => {
    for (const s of ['dog','cat','bird','rabbit','guinea_pig','hamster','reptile','fish','other']) {
      expect(SVC).toContain(`'${s}'`);
    }
    expect(SVC).toMatch(/function coerceSpecies\(raw: unknown\): PetSpecies \| undefined/);
  });

  it('service caps confidence at 0.9 so the UI never claims certainty', () => {
    expect(SVC).toMatch(/Math\.max\(0,\s*Math\.min\(0\.9,\s*rawConfidence\)\)/);
  });

  it('upload route wires the service in AFTER the duplicate check and BEFORE the JSON response', () => {
    // Fail-quiet import inside the handler.
    expect(ROUTE).toMatch(/import\(['"]\.\.\/services\/PetIdentificationService['"]\)/);
    expect(ROUTE).toMatch(/petIdentificationService\.identifyFromBuffer\(buffer,\s*mimeType\)/);
    // Response carries the identification field.
    expect(ROUTE).toMatch(/res\.json\(\{\s*filePath,\s*hash,\s*duplicate,\s*fileSize,\s*identification\s*\}\)/);
  });

  it('upload route SKIPS identification when the photo is a duplicate (save the model call)', () => {
    expect(ROUTE).toMatch(/if\s*\(!duplicate\)\s*\{/);
  });

  it('upload route never lets an identify error break the upload response', () => {
    expect(ROUTE).toMatch(/identifyFromBuffer failed \(non-fatal\)/);
    // A catch that falls back to degraded=true, not throw.
    expect(ROUTE).toMatch(/errorCode:\s*['"]gemini_error['"]/);
  });
});
