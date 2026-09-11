import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * NAYAX FEED WATCHDOG (2026-09-11)
 *
 * The 5+1 punch card is computed from the Nayax transaction webhook rather than
 * Nayax's Campaign module (absent from our operator account). The feed is
 * therefore load-bearing and had no alarm on it: a payload change makes the
 * handler answer 400 and punches stop SILENTLY.
 *
 * These are BEHAVIOURAL tests — the module is driven with a fake clock and a
 * stubbed database, and the assertions are on what it DOES. A source pin would
 * not catch the failures that actually matter here (alerting at 4am, alerting
 * every hour forever, or mistaking a database outage for silence).
 */

const sendSecurityAlert = vi.fn(async () => {});
let lastAt: string | null = null;
let dbThrows = false;

vi.mock('../services/alerts', () => ({ sendSecurityAlert: (...a: any[]) => sendSecurityAlert(...a) }));
vi.mock('../db', () => ({
  db: {
    execute: async () => {
      if (dbThrows) throw new Error('connection terminated');
      return { rows: [{ last_at: lastAt }] };
    },
  },
}));
vi.mock('../lib/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
}));

const load = async () => await import('../services/NayaxFeedWatchdog');

/** 14:00 Israel time — squarely inside operating hours. */
const midday = (isoDay: string) => new Date(`${isoDay}T11:00:00.000Z`);
const hoursAgo = (from: Date, h: number) => new Date(from.getTime() - h * 3_600_000).toISOString();

beforeEach(async () => {
  sendSecurityAlert.mockClear();
  dbThrows = false;
  lastAt = null;
  const m = await load();
  m.__resetFeedWatchdogLatch();
});

describe('Nayax feed watchdog', () => {
  it('stays silent when the feed is fresh', async () => {
    const now = midday('2026-09-11');
    lastAt = hoursAgo(now, 2);
    const { checkNayaxFeedFreshness } = await load();
    const r = await checkNayaxFeedFreshness(now);
    expect(r.alerted).toBe(false);
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });

  it('alerts once the feed has been silent past the threshold', async () => {
    const now = midday('2026-09-11');
    lastAt = hoursAgo(now, 30);
    const { checkNayaxFeedFreshness } = await load();
    const r = await checkNayaxFeedFreshness(now);
    expect(r.alerted).toBe(true);
    expect(sendSecurityAlert).toHaveBeenCalledTimes(1);
    // The alert must name the real cause the CEO needs to act on.
    const [subject, body] = sendSecurityAlert.mock.calls[0] as unknown as [string, string];
    expect(subject).toMatch(/silent/i);
    expect(body).toMatch(/punch/i);
    expect(body).toMatch(/Wallyx/);
  });

  it('does NOT alert overnight — nobody washes a dog at 04:00', async () => {
    // An alert that cries wolf trains everyone to ignore the one that matters.
    const night = new Date('2026-09-11T01:00:00.000Z'); // 04:00 Israel
    lastAt = hoursAgo(night, 30);
    const { checkNayaxFeedFreshness } = await load();
    const r = await checkNayaxFeedFreshness(night);
    expect(r.checked).toBe(false);
    expect(r.reason).toBe('quiet_hours');
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });

  it('alerts only ONCE per silent stretch, not every hour', async () => {
    const now = midday('2026-09-11');
    lastAt = hoursAgo(now, 30);
    const { checkNayaxFeedFreshness } = await load();
    await checkNayaxFeedFreshness(now);
    await checkNayaxFeedFreshness(new Date(now.getTime() + 3_600_000));
    await checkNayaxFeedFreshness(new Date(now.getTime() + 7_200_000));
    expect(sendSecurityAlert).toHaveBeenCalledTimes(1);
  });

  it('re-arms after the feed recovers, so a SECOND outage still alerts', async () => {
    const now = midday('2026-09-11');
    lastAt = hoursAgo(now, 30);
    const { checkNayaxFeedFreshness } = await load();
    await checkNayaxFeedFreshness(now);
    expect(sendSecurityAlert).toHaveBeenCalledTimes(1);

    lastAt = hoursAgo(now, 1);              // feed comes back
    await checkNayaxFeedFreshness(now);

    lastAt = hoursAgo(now, 40);             // and dies again
    await checkNayaxFeedFreshness(now);
    expect(sendSecurityAlert).toHaveBeenCalledTimes(2);
  });

  it('a database outage is NOT reported as feed staleness', async () => {
    // Reporting it as staleness sends the wrong person to the wrong system.
    dbThrows = true;
    const { checkNayaxFeedFreshness } = await load();
    const r = await checkNayaxFeedFreshness(midday('2026-09-11'));
    expect(r.checked).toBe(false);
    expect(r.reason).toBe('db_unavailable');
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });

  it('an empty table never alerts — that is a fresh environment, not an incident', async () => {
    lastAt = null;
    const { checkNayaxFeedFreshness } = await load();
    const r = await checkNayaxFeedFreshness(midday('2026-09-11'));
    expect(r.reason).toBe('no_events_ever');
    expect(sendSecurityAlert).not.toHaveBeenCalled();
  });
});
