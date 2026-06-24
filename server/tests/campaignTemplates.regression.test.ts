/**
 * Campaign template registry — push/SMS/email copy, bilingual, code-interpolated.
 * Real unit test (pure functions, no DB).
 */
import { describe, it, expect } from 'vitest';
import { CAMPAIGN_TEMPLATES, renderCampaign, campaignDeepLink, type CampaignKey } from '../services/campaignTemplates';

describe('campaignTemplates', () => {
  const keys = Object.keys(CAMPAIGN_TEMPLATES) as CampaignKey[];

  it('covers the CEO campaign set', () => {
    for (const k of ['birthday', 'new_year', 'black_friday', 'comeback', 'first_time', 'vip'] as CampaignKey[]) {
      expect(keys).toContain(k);
    }
  });

  it('renders bilingual push/sms/email with the per-user code interpolated', () => {
    const en = renderCampaign('black_friday', 'en', { firstName: 'Daniel', code: 'BLACK-7F3A9K' });
    expect(en.push.title).toMatch(/Black Friday/i);
    expect(en.push.body).toContain('BLACK-7F3A9K');
    expect(en.push.data.code).toBe('BLACK-7F3A9K');
    expect(en.sms).toContain(en.deepLink);
    expect(en.email.subject.length).toBeGreaterThan(0);

    const he = renderCampaign('birthday', 'he', { code: 'BDAY-XY12ZЗ'.replace('З','Z') });
    expect(he.push.title).toMatch(/יום הולדת/);
  });

  it('deep-link carries the campaign + url-encoded code (Phase 3 auto-apply)', () => {
    const link = campaignDeepLink('comeback', 'COME BACK/1');
    expect(link).toContain('campaign=comeback');
    expect(link).toContain('code=COME%20BACK%2F1');
  });

  it('leaves no unfilled {{placeholders}} after render', () => {
    for (const k of keys) {
      const r = renderCampaign(k, 'en', { firstName: 'Sam', code: 'X-ABC123', discount: 25, expiry: 'today' });
      expect(r.push.title + r.push.body + r.sms + r.email.subject + r.email.body).not.toMatch(/\{\{\w+\}\}/);
    }
  });

  it('unknown key falls back to seasonal (never throws)', () => {
    const r = renderCampaign('nope' as any, 'en', { code: 'X-1' });
    expect(r.push.title.length).toBeGreaterThan(0);
  });
});
