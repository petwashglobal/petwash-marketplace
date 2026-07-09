/**
 * Google Services init wired at boot — regression pin (2026-07-09).
 *
 * From the #148 backlog (address / places bugs): initializeGoogleServices() —
 * which calls initializeGoogleMapsPlaces(GOOGLE_MAPS_API_KEY) to create the
 * Places singleton — was fully built in server/config/google-services.ts but was
 * NEVER invoked at server boot (same class of bug as the 2026-06-18 Sentry
 * "built-but-never-initialized" fix). So the singleton stayed null and every
 * place-details lookup threw "Google Maps Places service not initialized"
 * (server/services/googleMapsPlaces.ts:235). Now called at startup next to
 * initSentry().
 *
 * Note: address AUTOCOMPLETE is a separate path that uses the key directly — it
 * fails because the Google Maps API key is currently EXPIRED ("API key expired.
 * Please renew the API key."), which is an ops credential renewal, not code.
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const INDEX = fs.readFileSync(path.resolve(__dirname, '..', 'index.ts'), 'utf8');
const CONFIG = fs.readFileSync(path.resolve(__dirname, '..', 'config', 'google-services.ts'), 'utf8');

describe('Google Services initialized at boot (2026-07-09)', () => {
  it('server/index.ts imports initializeGoogleServices', () => {
    expect(INDEX).toMatch(/import \{ initializeGoogleServices \} from "\.\/config\/google-services"/);
  });

  it('and actually calls it at startup (guarded, like initSentry)', () => {
    expect(INDEX).toMatch(/try \{\s*\n\s*initializeGoogleServices\(\);\s*\n\s*\} catch/);
  });

  it('the config still wires the Places singleton from the key', () => {
    expect(CONFIG).toMatch(/initializeGoogleMapsPlaces\(mapsApiKey\)/);
  });
});
