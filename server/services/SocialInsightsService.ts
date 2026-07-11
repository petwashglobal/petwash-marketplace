/**
 * SocialInsightsService — in-house social growth analytics for PetWash's OWN
 * accounts (@petwashltd on Instagram / TikTok / Facebook).
 *
 * DARK UNTIL WIRED (mirrors SumitClient / LynxClient): every platform is a safe
 * no-op until its API token is set, so the admin panel renders a clean "connect
 * your account" state instead of crashing or showing fake numbers. The moment a
 * token exists, snapshotPlatform() pulls real metrics into social_metric_snapshots
 * and getOverview() surfaces week-over-week trend.
 *
 * Tokens (Cloud Run env / Secret Manager), all default-unset = dark:
 *   META_GRAPH_TOKEN + IG_BUSINESS_ACCOUNT_ID   → Instagram (Meta Graph API)
 *   META_GRAPH_TOKEN + FB_PAGE_ID               → Facebook Page (Meta Graph API)
 *   TIKTOK_ACCESS_TOKEN                          → TikTok (Business/Display API)
 *
 * Read-only analytics — no PII, no consumer data, no writes to any social platform.
 */
import { db } from '../db';
import { socialMetricSnapshots, type SocialMetricSnapshot } from '@shared/schema';
import { desc, eq } from 'drizzle-orm';
import { logger } from '../lib/logger';

export type SocialPlatform = 'instagram' | 'tiktok' | 'facebook';
export const SOCIAL_PLATFORMS: SocialPlatform[] = ['instagram', 'tiktok', 'facebook'];

/** The public @handle for each platform (display only). */
export const SOCIAL_HANDLES: Record<SocialPlatform, string> = {
  instagram: 'petwashltd',
  tiktok: 'petwashltd',
  facebook: 'petwashltd',
};

const META_GRAPH = 'https://graph.facebook.com/v20.0';

/** True only when the platform has the credentials it needs to pull metrics. */
export function isPlatformWired(platform: SocialPlatform): boolean {
  const meta = (process.env.META_GRAPH_TOKEN || '').trim();
  switch (platform) {
    case 'instagram':
      return Boolean(meta && (process.env.IG_BUSINESS_ACCOUNT_ID || '').trim());
    case 'facebook':
      return Boolean(meta && (process.env.FB_PAGE_ID || '').trim());
    case 'tiktok':
      return Boolean((process.env.TIKTOK_ACCESS_TOKEN || '').trim());
    default:
      return false;
  }
}

// ── PURE: trend maths (unit-testable, no I/O) ────────────────────────────────
export interface PlatformOverview {
  platform: SocialPlatform;
  handle: string;
  connected: boolean;
  latest: SocialMetricSnapshot | null;
  followers: number | null;
  /** Follower change vs the snapshot closest to 7 days before the latest one. */
  followersDelta7d: number | null;
  engagement: number | null;
  lastSyncedAt: string | null;
}

/** From newest→oldest snapshots, pick the latest and the one closest to 7d prior. */
export function computeDelta(
  snapshots: SocialMetricSnapshot[],
): { latest: SocialMetricSnapshot | null; followersDelta7d: number | null } {
  if (!snapshots.length) return { latest: null, followersDelta7d: null };
  const latest = snapshots[0];
  const latestMs = new Date(latest.capturedAt as unknown as string).getTime();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  // The oldest snapshot at least ~5 days back (tolerant window) is our baseline.
  let baseline: SocialMetricSnapshot | null = null;
  for (const s of snapshots.slice(1)) {
    const ageMs = latestMs - new Date(s.capturedAt as unknown as string).getTime();
    if (ageMs >= 5 * 24 * 60 * 60 * 1000) { baseline = s; if (ageMs >= WEEK) break; }
  }
  const followersDelta7d =
    baseline != null && latest.followers != null && baseline.followers != null
      ? latest.followers - baseline.followers
      : null;
  return { latest, followersDelta7d };
}

// ── READ: overview for the admin panel ───────────────────────────────────────
export async function getOverview(): Promise<{ platforms: PlatformOverview[]; anyConnected: boolean }> {
  const platforms: PlatformOverview[] = [];
  for (const platform of SOCIAL_PLATFORMS) {
    let snapshots: SocialMetricSnapshot[] = [];
    try {
      snapshots = await db
        .select()
        .from(socialMetricSnapshots)
        .where(eq(socialMetricSnapshots.platform, platform))
        .orderBy(desc(socialMetricSnapshots.capturedAt))
        .limit(30);
    } catch (err: any) {
      // Table not yet migrated / DB hiccup → treat as no data, never throw.
      logger.warn('[SocialInsights] snapshot read failed', { platform, err: err?.message });
    }
    const { latest, followersDelta7d } = computeDelta(snapshots);
    platforms.push({
      platform,
      handle: SOCIAL_HANDLES[platform],
      connected: isPlatformWired(platform),
      latest,
      followers: latest?.followers ?? null,
      followersDelta7d,
      engagement: latest?.engagement ?? null,
      lastSyncedAt: latest ? String(latest.capturedAt) : null,
    });
  }
  return { platforms, anyConnected: platforms.some((p) => p.connected) };
}

// ── WRITE: pull live metrics and store a snapshot (only when wired) ──────────
export interface SnapshotResult {
  ok: boolean;
  platform: SocialPlatform;
  wired: boolean;
  reason?: string;
  followers?: number;
}

/** Pull one platform's current metrics from its API and persist a snapshot.
 *  No-op (ok:false, wired:false) when the platform is dark. Never throws. */
export async function snapshotPlatform(platform: SocialPlatform): Promise<SnapshotResult> {
  if (!isPlatformWired(platform)) {
    return { ok: false, platform, wired: false, reason: 'not_wired' };
  }
  try {
    const metrics = await fetchPlatformMetrics(platform);
    if (!metrics) return { ok: false, platform, wired: true, reason: 'fetch_failed' };
    await db.insert(socialMetricSnapshots).values({
      platform,
      handle: SOCIAL_HANDLES[platform],
      followers: metrics.followers ?? null,
      posts: metrics.posts ?? null,
      reach: metrics.reach ?? null,
      impressions: metrics.impressions ?? null,
      engagement: metrics.engagement ?? null,
      profileViews: metrics.profileViews ?? null,
      source: 'api',
    });
    return { ok: true, platform, wired: true, followers: metrics.followers };
  } catch (err: any) {
    logger.error('[SocialInsights] snapshot failed', { platform, err: err?.message });
    return { ok: false, platform, wired: true, reason: 'exception' };
  }
}

interface RawMetrics {
  followers?: number;
  posts?: number;
  reach?: number;
  impressions?: number;
  engagement?: number;
  profileViews?: number;
}

/** Platform API adapters. Each fires only when wired (guarded by caller). */
async function fetchPlatformMetrics(platform: SocialPlatform): Promise<RawMetrics | null> {
  if (platform === 'instagram') {
    // Meta Graph API — IG Business account fields + a lifetime/period insights read.
    const igId = (process.env.IG_BUSINESS_ACCOUNT_ID || '').trim();
    const token = (process.env.META_GRAPH_TOKEN || '').trim();
    const url = `${META_GRAPH}/${igId}?fields=followers_count,media_count&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
    return { followers: j?.followers_count, posts: j?.media_count };
  }
  if (platform === 'facebook') {
    const pageId = (process.env.FB_PAGE_ID || '').trim();
    const token = (process.env.META_GRAPH_TOKEN || '').trim();
    const url = `${META_GRAPH}/${pageId}?fields=followers_count,fan_count&access_token=${encodeURIComponent(token)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const j: any = await res.json();
    return { followers: j?.followers_count ?? j?.fan_count };
  }
  if (platform === 'tiktok') {
    // TikTok Business API — user/info. Token scope must include the account.
    const token = (process.env.TIKTOK_ACCESS_TOKEN || '').trim();
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/user/info/', {
      headers: { 'Access-Token': token },
    });
    if (!res.ok) return null;
    const j: any = await res.json();
    const d = j?.data ?? {};
    return { followers: d?.follower_count, engagement: d?.likes_count };
  }
  return null;
}
