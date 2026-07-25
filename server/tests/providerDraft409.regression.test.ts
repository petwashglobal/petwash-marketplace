/**
 * Regression pin — 2026-07-25.
 *
 * A provider who signs up through the post-login decider gets a `draft` row
 * auto-created in provider_applications. The onboarding apply-guard used to
 * count 'draft' as an existing application and 409'd every such provider on
 * their OWN draft, so they could never submit. This pins the fix:
 *   1. 'draft' is NOT in the blocking inArray list.
 *   2. Only genuinely-submitted statuses block a re-apply.
 *   3. The route deletes the auto-created draft before inserting the real one.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(
  join(__dirname, '..', 'routes', 'provider-onboarding.ts'),
  'utf8',
);

describe('provider-onboarding draft-409 regression', () => {
  it('does NOT list draft among the statuses that block a re-apply', () => {
    // Find the inArray(...) guard on the existing-application select.
    const m = src.match(/inArray\(\s*providerApplications\.status,\s*\[([^\]]*)\]/);
    expect(m, 'blocking inArray guard must exist').toBeTruthy();
    const list = m![1];
    expect(list).not.toMatch(/['"]draft['"]/);
  });

  it('still blocks genuinely-submitted statuses', () => {
    const m = src.match(/inArray\(\s*providerApplications\.status,\s*\[([^\]]*)\]/);
    const list = m![1];
    expect(list).toMatch(/['"]pending['"]/);
    expect(list).toMatch(/['"]under_review['"]/);
  });

  it('deletes the auto-created draft before inserting the real submission', () => {
    expect(src).toMatch(/db\s*\.delete\(providerApplications\)/);
    // The delete must be scoped to status='draft'.
    const delBlock = src.slice(src.indexOf('.delete(providerApplications)'));
    expect(delBlock.slice(0, 300)).toMatch(/status,\s*['"]draft['"]/);
  });
});
