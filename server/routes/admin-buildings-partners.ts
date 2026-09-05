/**
 * Building / Resident Program (§8) + Partner Report Automation (§28)
 * — READ-ONLY admin operations intelligence.
 *
 * CEO "Business OS" spec. Pure SELECT aggregation over tables that ALREADY
 * exist. NO schema change, NO money math change, NO K9000/Nayax/Tranzila
 * runtime touch, NO new dependency. Every number is a real COUNT/SUM/MAX over
 * a real column; any metric we cannot back with a real, joinable column is
 * returned as `null` WITH a `note`, never fabricated (platform skill §2 — no
 * fake data).
 *
 * ── Data-model reality (verified against shared/schema*.ts, 2026-06-20) ──────
 * There are TWO station registries and they are NOT bridged by a shared key:
 *
 *   1. `stations` (serial integer id) — the marketplace / franchise / partner
 *      registry. This is where ownership and revenue-share live:
 *        - stations.franchiseId  → franchise_owners.id   (operating owner)
 *        - partner_agreements.stationId → stations.id     (partner ↔ station)
 *        - partners.id ← partner_agreements.partnerId     (location partner)
 *        - settlements.partnerId → partners.id            (monthly revenue share)
 *        - grooming_feedback.stationId → stations.id       (customer ratings)
 *      Real per-station columns: totalWashes, totalRevenue, status,
 *      lastHeartbeat, ownershipType.
 *
 *   2. `kiosk_machines` (kioskId varchar) — the K9000 hardware registry. The
 *      live per-wash tables `bay_sessions` and `bay_faults` attach here via a
 *      varchar stationId == kiosk_machines.kioskId. kiosk_machines has NO
 *      franchise/partner/franchise_owner foreign key.
 *
 * CONSEQUENCE: live bay-level washes/faults/uptime CANNOT be reliably
 * attributed to a partner- or franchise-owned `stations` row, because there is
 * no column bridging `stations` ↔ `kiosk_machines`. So this module sources
 * partner/station performance from the `stations` registry (totalWashes,
 * totalRevenue, status, lastHeartbeat) and `settlements` (the authoritative
 * monthly revenue-share figures), and returns bay-fault/live-uptime metrics as
 * `null` with an explanatory note. We do NOT invent a join.
 *
 * Endpoints (both mounted under /api/admin/* so they inherit the full admin
 * security stack — validateFirebaseToken + adminLimiter + requireRole — and a
 * second inline requireAdmin gate is applied here for defence-in-depth):
 *
 *   GET /api/admin/partner-report
 *     Per location-partner (partners) a metrics card:
 *       - stations they own       : via partner_agreements → stations (real)
 *       - washes                  : SUM(stations.totalWashes) over their stations (real)
 *       - revenue                 : latest settlement grossRevenue + partnerShare (real)
 *                                   plus SUM(stations.totalRevenue) lifetime (real)
 *       - uptime                  : share of their stations currently "operational"
 *                                   AND with a fresh heartbeat (real, station-level)
 *       - faults                  : null + note (not attributable — see above)
 *       - customer growth         : grooming_feedback count over their stations,
 *                                   last 30d vs prior 30d (real)
 *       - support issues          : flagged grooming_feedback over their stations
 *                                   (real proxy; no station-linked ticket table exists)
 *     Also returns franchise-owner aggregates (franchise_owners → stations) as a
 *     second list, since some stations are franchise-operated rather than
 *     partner-hosted.
 *
 *   GET /api/admin/buildings
 *     Building / Resident program view. The `partners.type` enum has NO
 *     building/tower/residence value (it is municipality | shopping_center |
 *     pet_store_chain | gas_station_chain | franchise | other). So there is no
 *     building-type column to filter on. This endpoint therefore returns
 *     `hasBuildingType: false` with a note, and lists ALL station-hosting
 *     partners generically, each with: their stations, per-station performance
 *     (washes/revenue/status/heartbeat — real), and a `residentCode`
 *     PLACEHOLDER (there is no resident-code column in the schema yet; it is
 *     explicitly marked placeholder, never presented as real data).
 *
 * Money note: revenue figures are ILS for display only. No balance, escrow,
 * payout, refund, or settlement state is performed or mutated. Reads only.
 */
import { Router, type Request, type Response } from 'express';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { db } from '../db';
import { requireAdmin } from '../adminAuth';
import {
  partners,
  partnerAgreements,
  settlements,
  stations,
  franchiseOwners,
  groomingFeedback,
} from '@shared/schema';
import { logger } from '../lib/logger';
import { sendSanitizedError } from '../lib/sanitizeErrorResponse';

const router = Router();

// ── helpers ───────────────────────────────────────────────────────────────────
const HEARTBEAT_FRESH_MS = 15 * 60 * 1000; // station considered "live" if seen within 15 min
const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};
const isFreshHeartbeat = (hb: Date | string | null): boolean => {
  if (!hb) return false;
  const t = new Date(hb).getTime();
  return Number.isFinite(t) && Date.now() - t <= HEARTBEAT_FRESH_MS;
};

interface StationLite {
  id: number;
  stationCode: string;
  name: string;
  nameHe: string | null;
  status: string | null;
  ownershipType: string | null;
  totalWashes: number;
  totalRevenueIls: number;
  lastHeartbeat: string | null;
  isLive: boolean;
}

function toStationLite(s: any): StationLite {
  return {
    id: s.id,
    stationCode: s.stationCode,
    name: s.name,
    nameHe: s.nameHe ?? null,
    status: s.status ?? null,
    ownershipType: s.ownershipType ?? null,
    totalWashes: num(s.totalWashes),
    totalRevenueIls: num(s.totalRevenue),
    lastHeartbeat: s.lastHeartbeat ? new Date(s.lastHeartbeat).toISOString() : null,
    isLive: isFreshHeartbeat(s.lastHeartbeat),
  };
}

// The single honest note attached everywhere bay-level live data would be
// expected but cannot be partner-attributed.
const FAULTS_NOTE_EN =
  'Bay-level faults/live washes live in the K9000 kiosk registry (kiosk_machines / bay_faults), which has no partner or franchise link, so they cannot be attributed to this partner. Shown figures are from the stations registry and settlements only.';
const FAULTS_NOTE_HE =
  'תקלות ושטיפות חיות ברמת התא נמצאות במרשם עמדות ה-K9000 (kiosk_machines / bay_faults) ללא קישור לשותף, ולכן לא ניתן לשייך אותן לשותף זה. הנתונים המוצגים מבוססים על מרשם העמדות וההתחשבנויות בלבד.';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/partner-report — §28 Partner Report Automation
// ─────────────────────────────────────────────────────────────────────────────
router.get('/partner-report', requireAdmin, async (_req: Request, res: Response) => {
  const errors: string[] = [];
  const now = Date.now();
  const start30 = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const start60 = new Date(now - 60 * 24 * 60 * 60 * 1000);

  try {
    // 1. All location partners.
    const partnerRows = await db
      .select({
        id: partners.id,
        name: partners.name,
        type: partners.type,
        contactEmail: partners.contactEmail,
        contactPhone: partners.contactPhone,
        revenueSharePercent: partners.revenueSharePercent,
        isActive: partners.isActive,
        contractStart: partners.contractStart,
        contractEnd: partners.contractEnd,
      })
      .from(partners)
      .orderBy(partners.name);

    // 2. partner ↔ station links (via agreements) joined to the station row.
    const agreementRows = await db
      .select({
        partnerId: partnerAgreements.partnerId,
        agreementActive: partnerAgreements.isActive,
        stationId: stations.id,
        stationCode: stations.stationCode,
        name: stations.name,
        nameHe: stations.nameHe,
        status: stations.status,
        ownershipType: stations.ownershipType,
        totalWashes: stations.totalWashes,
        totalRevenue: stations.totalRevenue,
        lastHeartbeat: stations.lastHeartbeat,
      })
      .from(partnerAgreements)
      .innerJoin(stations, eq(partnerAgreements.stationId, stations.id));

    const stationsByPartner = new Map<number, StationLite[]>();
    for (const a of agreementRows) {
      if (!a.partnerId) continue;
      const list = stationsByPartner.get(a.partnerId) ?? [];
      list.push(toStationLite(a));
      stationsByPartner.set(a.partnerId, list);
    }

    // 3. Latest settlement per partner (authoritative monthly revenue share).
    const settlementRows = await db
      .select({
        partnerId: settlements.partnerId,
        periodStart: settlements.periodStart,
        periodEnd: settlements.periodEnd,
        grossRevenue: settlements.grossRevenue,
        partnerShare: settlements.partnerShare,
        petwashShare: settlements.petwashShare,
        status: settlements.status,
      })
      .from(settlements)
      .orderBy(desc(settlements.periodEnd));
    const latestSettlementByPartner = new Map<number, (typeof settlementRows)[number]>();
    for (const s of settlementRows) {
      if (s.partnerId == null) continue;
      if (!latestSettlementByPartner.has(s.partnerId)) latestSettlementByPartner.set(s.partnerId, s);
    }

    // 4. Customer-activity + support proxy from grooming_feedback over each
    //    partner's stations (real join: grooming_feedback.stationId → stations.id).
    const stationToPartner = new Map<number, number>();
    for (const [pid, list] of stationsByPartner) for (const st of list) stationToPartner.set(st.id, pid);
    const allStationIds = Array.from(stationToPartner.keys());

    const fbByPartner = new Map<number, { last30: number; prev30: number; flagged: number }>();
    if (allStationIds.length > 0) {
      const fbRows = await db
        .select({
          stationId: groomingFeedback.stationId,
          createdAt: groomingFeedback.createdAt,
          isFlagged: groomingFeedback.isFlagged,
        })
        .from(groomingFeedback)
        .where(and(inArray(groomingFeedback.stationId, allStationIds), gte(groomingFeedback.createdAt, start60)));
      for (const f of fbRows) {
        const pid = f.stationId != null ? stationToPartner.get(f.stationId) : undefined;
        if (pid == null) continue;
        const bucket = fbByPartner.get(pid) ?? { last30: 0, prev30: 0, flagged: 0 };
        const created = f.createdAt ? new Date(f.createdAt) : null;
        if (created && created >= start30) bucket.last30 += 1;
        else if (created && created >= start60) bucket.prev30 += 1;
        if (f.isFlagged) bucket.flagged += 1;
        fbByPartner.set(pid, bucket);
      }
    }

    // 5. Assemble per-partner cards.
    const partnerCards = partnerRows.map((p) => {
      const sts = stationsByPartner.get(p.id) ?? [];
      const liveCount = sts.filter((s) => s.isLive).length;
      const operationalCount = sts.filter((s) => (s.status ?? '').toLowerCase() === 'operational').length;
      const washes = sts.reduce((acc, s) => acc + s.totalWashes, 0);
      const lifetimeRevenueIls = sts.reduce((acc, s) => acc + s.totalRevenueIls, 0);
      const settlement = latestSettlementByPartner.get(p.id) ?? null;
      const fb = fbByPartner.get(p.id) ?? { last30: 0, prev30: 0, flagged: 0 };
      const growthPct =
        fb.prev30 > 0 ? Math.round(((fb.last30 - fb.prev30) / fb.prev30) * 1000) / 10 : null;

      return {
        partnerId: p.id,
        name: p.name,
        type: p.type,
        contactEmail: p.contactEmail ?? null,
        contactPhone: p.contactPhone ?? null,
        revenueSharePercent: p.revenueSharePercent != null ? num(p.revenueSharePercent) : null,
        isActive: p.isActive ?? null,
        contractStart: p.contractStart ? new Date(p.contractStart).toISOString() : null,
        contractEnd: p.contractEnd ? new Date(p.contractEnd).toISOString() : null,
        stationCount: sts.length,
        stations: sts,
        metrics: {
          washes,
          lifetimeRevenueIls,
          // Latest monthly settlement (authoritative revenue share). null when
          // no settlement has been generated for this partner yet.
          latestSettlement: settlement
            ? {
                periodStart: settlement.periodStart ? new Date(settlement.periodStart).toISOString() : null,
                periodEnd: settlement.periodEnd ? new Date(settlement.periodEnd).toISOString() : null,
                grossRevenueIls: num(settlement.grossRevenue),
                partnerShareIls: num(settlement.partnerShare),
                petwashShareIls: num(settlement.petwashShare),
                status: settlement.status ?? null,
              }
            : null,
          settlementNote: settlement ? null : 'No settlement generated for this partner yet',
          uptime: {
            stations: sts.length,
            operational: operationalCount,
            liveHeartbeat: liveCount,
            operationalPct: sts.length > 0 ? Math.round((operationalCount / sts.length) * 1000) / 10 : null,
            note:
              sts.length === 0
                ? 'No stations linked to this partner'
                : 'Station-level availability (stations.status + heartbeat freshness). Not bay-level.',
          },
          faults: null as number | null, // not attributable — see notes
          faultsNote: FAULTS_NOTE_EN,
          faultsNoteHe: FAULTS_NOTE_HE,
          customerGrowth: {
            feedbackLast30: fb.last30,
            feedbackPrev30: fb.prev30,
            growthPct,
            note: 'Customer activity proxied by grooming_feedback volume over linked stations (real join). growthPct null when no prior-period baseline.',
          },
          supportIssues: {
            flaggedFeedback: fb.flagged,
            note: 'No station-linked support-ticket table exists; flagged grooming_feedback is used as the support-signal proxy.',
          },
        },
      };
    });

    // 6. Franchise-owner aggregates (stations.franchiseId → franchise_owners.id).
    const ownerRows = await db
      .select({
        id: franchiseOwners.id,
        businessName: franchiseOwners.businessName,
        status: franchiseOwners.status,
        contractStart: franchiseOwners.contractStart,
        contractEnd: franchiseOwners.contractEnd,
      })
      .from(franchiseOwners)
      .orderBy(franchiseOwners.businessName);

    const ownedStationRows = await db
      .select({
        id: stations.id,
        stationCode: stations.stationCode,
        name: stations.name,
        nameHe: stations.nameHe,
        status: stations.status,
        ownershipType: stations.ownershipType,
        totalWashes: stations.totalWashes,
        totalRevenue: stations.totalRevenue,
        lastHeartbeat: stations.lastHeartbeat,
        franchiseId: stations.franchiseId,
      })
      .from(stations)
      .where(sql`${stations.franchiseId} is not null`);

    const stationsByOwner = new Map<number, StationLite[]>();
    for (const s of ownedStationRows) {
      if (s.franchiseId == null) continue;
      const list = stationsByOwner.get(s.franchiseId) ?? [];
      list.push(toStationLite(s));
      stationsByOwner.set(s.franchiseId, list);
    }

    const franchiseCards = ownerRows.map((o) => {
      const sts = stationsByOwner.get(o.id) ?? [];
      const operationalCount = sts.filter((s) => (s.status ?? '').toLowerCase() === 'operational').length;
      return {
        franchiseOwnerId: o.id,
        businessName: o.businessName,
        status: o.status ?? null,
        contractStart: o.contractStart ? new Date(o.contractStart).toISOString() : null,
        contractEnd: o.contractEnd ? new Date(o.contractEnd).toISOString() : null,
        stationCount: sts.length,
        stations: sts,
        metrics: {
          washes: sts.reduce((acc, s) => acc + s.totalWashes, 0),
          lifetimeRevenueIls: sts.reduce((acc, s) => acc + s.totalRevenueIls, 0),
          operational: operationalCount,
          operationalPct: sts.length > 0 ? Math.round((operationalCount / sts.length) * 1000) / 10 : null,
          faults: null as number | null,
          faultsNote: FAULTS_NOTE_EN,
        },
      };
    });

    return res.json({
      wired: true,
      generatedAt: new Date().toISOString(),
      partnerCount: partnerCards.length,
      partners: partnerCards,
      franchiseOwnerCount: franchiseCards.length,
      franchiseOwners: franchiseCards,
      dataModelNote:
        'Partner revenue/share is authoritative from settlements; station washes/revenue/status are from the stations registry. Bay-level faults/live washes (K9000 kiosk registry) are not partner-attributable and are returned null.',
      errors: errors.length ? errors : undefined,
    });
  } catch (err: any) {
    logger.error('[admin-buildings-partners] partner-report failed', { error: err?.message });
    return sendSanitizedError(res, err, 'partner_report_failed', { logContext: { op: 'partner-report' } });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/admin/buildings — §8 Building / Resident Program
// ─────────────────────────────────────────────────────────────────────────────
router.get('/buildings', requireAdmin, async (_req: Request, res: Response) => {
  try {
    // There is NO building/tower/residence value in partners.type, and no
    // resident-code column anywhere in the schema. Be explicit about both.
    const BUILDING_TYPES = ['building', 'tower', 'residence', 'apartment', 'residential'];

    const partnerRows = await db
      .select({
        id: partners.id,
        name: partners.name,
        type: partners.type,
        contactEmail: partners.contactEmail,
        isActive: partners.isActive,
        billingAddress: partners.billingAddress,
      })
      .from(partners)
      .orderBy(partners.name);

    // Did any partner happen to be typed as a building variant? (Future-proof:
    // if the enum is ever extended we surface those first.)
    const hasBuildingType = partnerRows.some((p) => BUILDING_TYPES.includes((p.type ?? '').toLowerCase()));

    // Station links per partner (same join as the partner report).
    const agreementRows = await db
      .select({
        partnerId: partnerAgreements.partnerId,
        stationId: stations.id,
        stationCode: stations.stationCode,
        name: stations.name,
        nameHe: stations.nameHe,
        status: stations.status,
        ownershipType: stations.ownershipType,
        totalWashes: stations.totalWashes,
        totalRevenue: stations.totalRevenue,
        lastHeartbeat: stations.lastHeartbeat,
      })
      .from(partnerAgreements)
      .innerJoin(stations, eq(partnerAgreements.stationId, stations.id));

    const stationsByPartner = new Map<number, StationLite[]>();
    for (const a of agreementRows) {
      if (!a.partnerId) continue;
      const list = stationsByPartner.get(a.partnerId) ?? [];
      list.push(toStationLite(a));
      stationsByPartner.set(a.partnerId, list);
    }

    // The building/resident program is about places that host a station. If no
    // partner is typed as a building, list all partners generically.
    const source = hasBuildingType
      ? partnerRows.filter((p) => BUILDING_TYPES.includes((p.type ?? '').toLowerCase()))
      : partnerRows;

    const buildings = source.map((p) => {
      const sts = stationsByPartner.get(p.id) ?? [];
      const operationalCount = sts.filter((s) => (s.status ?? '').toLowerCase() === 'operational').length;
      return {
        partnerId: p.id,
        name: p.name,
        type: p.type,
        isActive: p.isActive ?? null,
        billingAddress: p.billingAddress ?? null,
        // PLACEHOLDER — there is no resident-code column in the schema. This is
        // deterministic and clearly labelled, never presented as real data.
        residentCode: `RES-${String(p.id).padStart(4, '0')}`,
        residentCodeIsPlaceholder: true,
        stationCount: sts.length,
        stations: sts,
        performance: {
          washes: sts.reduce((acc, s) => acc + s.totalWashes, 0),
          lifetimeRevenueIls: sts.reduce((acc, s) => acc + s.totalRevenueIls, 0),
          operational: operationalCount,
          operationalPct: sts.length > 0 ? Math.round((operationalCount / sts.length) * 1000) / 10 : null,
          liveHeartbeat: sts.filter((s) => s.isLive).length,
        },
      };
    });

    return res.json({
      wired: true,
      generatedAt: new Date().toISOString(),
      hasBuildingType,
      buildingTypeNote: hasBuildingType
        ? 'One or more partners are typed as a building/tower/residence variant.'
        : 'No building/tower/residence partner type exists (partners.type enum is municipality | shopping_center | pet_store_chain | gas_station_chain | franchise | other). Listing all station-hosting partners generically.',
      residentCodeNote:
        'residentCode is a deterministic PLACEHOLDER (RES-<padded partner id>). There is no resident-code column in the schema yet.',
      buildingCount: buildings.length,
      buildings,
    });
  } catch (err: any) {
    logger.error('[admin-buildings-partners] buildings failed', { error: err?.message });
    return sendSanitizedError(res, err, 'buildings_failed', { logContext: { op: 'buildings' } });
  }
});

export default router;
