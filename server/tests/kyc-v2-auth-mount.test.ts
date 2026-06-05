import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(__dirname, '..', '..');
const routesSource = readFileSync(resolve(ROOT, 'server/routes.ts'), 'utf8');

describe('KYC v2 Firebase auth mount', () => {
  it('loads a dedicated validateFirebaseToken alias before mounting /api/kyc/v2', () => {
    const mountIndex = routesSource.indexOf("app.use('/api/kyc/v2'");
    const importIndex = routesSource.indexOf('validateKycV2FirebaseToken');

    expect(importIndex).toBeGreaterThan(-1);
    expect(mountIndex).toBeGreaterThan(importIndex);
  });

  it('mounts /api/kyc/v2 behind Firebase auth before DPA and route handlers', () => {
    expect(routesSource).toMatch(
      /app\.use\(\s*['"]\/api\/kyc\/v2['"]\s*,\s*validateKycV2FirebaseToken\s*,\s*requireDpaAccepted\s*,\s*kyc2026Routes\s*\)/,
    );
  });

  it('does not leave the pre-fix DPA-only mount shape in place', () => {
    expect(routesSource).not.toMatch(
      /app\.use\(\s*['"]\/api\/kyc\/v2['"]\s*,\s*requireDpaAccepted\s*,\s*kyc2026Routes\s*\)/,
    );
  });
});
