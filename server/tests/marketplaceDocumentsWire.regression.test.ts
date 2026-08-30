/**
 * Regression pin — /api/marketplace/documents/:id wiring + client badge.
 *
 * Catches accidental unmount, permission drop, or the badge being
 * accidentally removed from the Pet Parent home.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROUTES = fs.readFileSync(path.join(__dirname, '../routes.ts'), 'utf8');
const ROUTER = fs.readFileSync(path.join(__dirname, '../routes/marketplace-documents.ts'), 'utf8');
const PRESTIGE_HOME = fs.readFileSync(path.resolve(__dirname, '../../client/src/pages/PrestigeHome.tsx'), 'utf8');
const REGISTER = fs.readFileSync(path.join(__dirname, '../services/marketplace/registerJourneyLoaders.ts'), 'utf8');

describe('MarketplaceDocuments — mount + wiring', () => {
  it('imports the documents router', () => {
    expect(ROUTES).toMatch(/import\s+marketplaceDocumentsRoutes\s+from\s+["']\.\/routes\/marketplace-documents["']/);
  });

  it('mounts documents router under /api/marketplace with auth + rate limit', () => {
    expect(ROUTES).toMatch(/app\.use\(\s*['"]\/api\/marketplace['"]\s*,\s*validateFirebaseToken\s*,\s*apiLimiter\s*,\s*marketplaceDocumentsRoutes\s*\)/);
  });

  it('router defines GET /documents/:id', () => {
    expect(ROUTER).toMatch(/router\.get\(\s*['"]\/documents\/:id['"]/);
  });

  it('router maps every DocumentDetailOutcome code', () => {
    for (const code of ['OK', 'NOT_FOUND', 'NOT_A_PARTY']) {
      expect(ROUTER).toContain(`'${code}'`);
    }
  });
});

describe('JourneyLoaders — the four live registrations', () => {
  it('registers prestige_member, refund, pet, support_case', () => {
    for (const kind of ['prestige_member', 'refund', 'pet', 'support_case']) {
      expect(REGISTER).toContain(`'${kind}'`);
    }
  });
});

describe('Prestige home — JourneyStateBadge live wire', () => {
  it('imports JourneyStateBadge', () => {
    expect(PRESTIGE_HOME).toMatch(/import\s*\{\s*JourneyStateBadge\s*\}\s*from\s*['"]@\/components\/marketplace\/JourneyStateBadge['"]/);
  });

  it('renders the badge with kind="prestige_member" and id="me"', () => {
    expect(PRESTIGE_HOME).toMatch(/<JourneyStateBadge\s+kind=["']prestige_member["']\s+id=["']me["']/);
  });

  it('lives inside a testid slot so QA can target it (prestige-journey-badge-slot)', () => {
    expect(PRESTIGE_HOME).toContain('prestige-journey-badge-slot');
  });
});
