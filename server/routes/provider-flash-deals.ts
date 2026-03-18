/**
 * Provider Flash Deals — Limited-time discount offers
 * Inspired by Airbnb/dynamic pricing model
 * Providers set a % discount valid for a configurable window (hours/days)
 * with slot limits per pet type (dog/cat/both)
 */

import express, { type Router } from 'express';
import { logger } from '../lib/logger';
import { z } from 'zod';
import { validateFirebaseToken } from '../middleware/firebase-auth';

const router: Router = express.Router();

// ── In-memory store (no new schema — avoids drizzle-kit push hang) ────────────
// In production this would live in Redis. For now it's process-scoped but
// works perfectly for a single Cloud Run instance.
interface FlashDeal {
  id: string;
  providerId: string;
  providerName: string;
  serviceType: 'grooming' | 'walking' | 'daycare' | 'k9000' | 'all';
  petTypes: ('dog' | 'cat' | 'all')[];
  discountPercent: number;   // 5–40
  originalPrice: number;     // ILS
  slotsTotal: number;        // max bookings
  slotsRemaining: number;
  validFrom: Date;
  validUntil: Date;
  headline: string;          // e.g. "Flash — 20% off grooming this week"
  headlineHe: string;
  location: string;          // City
  isActive: boolean;
  createdAt: Date;
}

const DEALS_STORE = new Map<string, FlashDeal>();

function generateDealId(): string {
  return `DEAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
}

function isDealActive(deal: FlashDeal): boolean {
  const now = new Date();
  return deal.isActive && deal.slotsRemaining > 0 && deal.validUntil > now && deal.validFrom <= now;
}

// ── Seed realistic demo deals for a full week ─────────────────────────────────
function seedDemoDeals() {
  if (DEALS_STORE.size > 0) return;
  const now = new Date();
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const demos: Omit<FlashDeal, 'id' | 'createdAt'>[] = [
    {
      providerId: 'demo-p1',
      providerName: 'Salon du Chien — Tel Aviv',
      serviceType: 'grooming',
      petTypes: ['dog'],
      discountPercent: 20,
      originalPrice: 280,
      slotsTotal: 5,
      slotsRemaining: 3,
      validFrom: now,
      validUntil: weekEnd,
      headline: 'Flash — 20% off premium grooming this week',
      headlineHe: 'פלאש — 20% הנחה על טיפוח פרימיום השבוע',
      location: 'Tel Aviv',
      isActive: true,
    },
    {
      providerId: 'demo-p2',
      providerName: 'Tal Ben-David — Dog Walker',
      serviceType: 'walking',
      petTypes: ['dog'],
      discountPercent: 15,
      originalPrice: 120,
      slotsTotal: 8,
      slotsRemaining: 6,
      validFrom: now,
      validUntil: weekEnd,
      headline: 'Book 5 walks, save 15% — limited slots',
      headlineHe: 'הזמן 5 הליכות, חסוך 15% — מקומות מוגבלים',
      location: 'Tel Aviv',
      isActive: true,
    },
    {
      providerId: 'demo-p3',
      providerName: 'Meow & Woof Daycare — Ramat Gan',
      serviceType: 'daycare',
      petTypes: ['dog', 'cat'],
      discountPercent: 25,
      originalPrice: 180,
      slotsTotal: 4,
      slotsRemaining: 2,
      validFrom: now,
      validUntil: weekEnd,
      headline: 'Daycare flash — 25% off, 2 slots left',
      headlineHe: 'פלאש בית יום — 25% הנחה, 2 מקומות נותרו',
      location: 'Ramat Gan',
      isActive: true,
    },
    {
      providerId: 'demo-p4',
      providerName: 'Luxury Cat Hotel — Herzliya',
      serviceType: 'daycare',
      petTypes: ['cat'],
      discountPercent: 30,
      originalPrice: 150,
      slotsTotal: 3,
      slotsRemaining: 3,
      validFrom: now,
      validUntil: weekEnd,
      headline: 'Cat boarding flash — 30% off this week only',
      headlineHe: 'פלאש אירוח חתולים — 30% הנחה השבוע בלבד',
      location: 'Herzliya',
      isActive: true,
    },
    {
      providerId: 'demo-p5',
      providerName: 'K9000 — Dizengoff Square',
      serviceType: 'k9000',
      petTypes: ['dog'],
      discountPercent: 10,
      originalPrice: 60,
      slotsTotal: 20,
      slotsRemaining: 14,
      validFrom: now,
      validUntil: weekEnd,
      headline: 'Self-wash flash — 10% off, unlimited passes',
      headlineHe: 'פלאש רחצה עצמית — 10% הנחה',
      location: 'Tel Aviv',
      isActive: true,
    },
    {
      providerId: 'demo-p6',
      providerName: 'Happy Paws — Petah Tikva',
      serviceType: 'grooming',
      petTypes: ['cat', 'dog'],
      discountPercent: 35,
      originalPrice: 220,
      slotsTotal: 2,
      slotsRemaining: 1,
      validFrom: now,
      validUntil: weekEnd,
      headline: 'LAST SLOT — 35% off full groom + nail trim',
      headlineHe: 'מקום אחרון נותר — 35% הנחה על טיפוח מלא',
      location: 'Petah Tikva',
      isActive: true,
    },
    // Two dog bookings + one cat (as requested in user message)
    {
      providerId: 'demo-p7',
      providerName: 'The Dog House — Givatayim',
      serviceType: 'daycare',
      petTypes: ['dog'],
      discountPercent: 20,
      originalPrice: 160,
      slotsTotal: 7,
      slotsRemaining: 5,
      validFrom: now,
      validUntil: weekEnd,
      headline: 'Weekly daycare package — 2 dogs welcome, 20% off',
      headlineHe: 'חבילת שבוע — 2 כלבים ברוכים, 20% הנחה',
      location: 'Givatayim',
      isActive: true,
    },
    {
      providerId: 'demo-p8',
      providerName: 'Feline Dreams — Modi\'in',
      serviceType: 'daycare',
      petTypes: ['cat'],
      discountPercent: 18,
      originalPrice: 140,
      slotsTotal: 4,
      slotsRemaining: 4,
      validFrom: now,
      validUntil: weekEnd,
      headline: 'Cat weekly stay — 18% flash discount',
      headlineHe: 'שהייה שבועית לחתולים — 18% הנחת פלאש',
      location: "Modi'in",
      isActive: true,
    },
    {
      providerId: 'demo-p9',
      providerName: 'All Pets Care — Rishon LeZion',
      serviceType: 'all',
      petTypes: ['all'],
      discountPercent: 12,
      originalPrice: 200,
      slotsTotal: 9,
      slotsRemaining: 7,
      validFrom: now,
      validUntil: weekEnd,
      headline: 'Any service, any pet — 12% off all week',
      headlineHe: 'כל שירות, כל חיה — 12% הנחה כל השבוע',
      location: 'Rishon LeZion',
      isActive: true,
    },
  ];

  for (const d of demos) {
    const id = generateDealId();
    DEALS_STORE.set(id, { ...d, id, createdAt: new Date() });
  }
  logger.info(`[FlashDeals] Seeded ${DEALS_STORE.size} demo deals`);
}

seedDemoDeals();

// ── GET /api/flash-deals — list active deals ──────────────────────────────────
router.get('/', (req, res) => {
  const { serviceType, petType, location } = req.query;

  let deals = Array.from(DEALS_STORE.values()).filter(isDealActive);

  if (serviceType && serviceType !== 'all') {
    deals = deals.filter(d => d.serviceType === serviceType || d.serviceType === 'all');
  }
  if (petType && petType !== 'all') {
    deals = deals.filter(d => d.petTypes.includes(petType as 'dog' | 'cat') || d.petTypes.includes('all'));
  }
  if (location) {
    deals = deals.filter(d => d.location.toLowerCase().includes((location as string).toLowerCase()));
  }

  const enriched = deals.map(d => ({
    ...d,
    discountedPrice: Math.round(d.originalPrice * (1 - d.discountPercent / 100)),
    savingsAmount: Math.round(d.originalPrice * (d.discountPercent / 100)),
    urgencyLevel: d.slotsRemaining <= 2 ? 'critical' : d.slotsRemaining <= 5 ? 'high' : 'normal',
    hoursLeft: Math.max(0, Math.floor((d.validUntil.getTime() - Date.now()) / 3600000)),
    fillPercent: Math.round(((d.slotsTotal - d.slotsRemaining) / d.slotsTotal) * 100),
  }));

  // Sort by urgency + discount
  enriched.sort((a, b) => {
    const urgencyScore = { critical: 3, high: 2, normal: 1 };
    const uA = urgencyScore[a.urgencyLevel];
    const uB = urgencyScore[b.urgencyLevel];
    if (uA !== uB) return uB - uA;
    return b.discountPercent - a.discountPercent;
  });

  res.json({ success: true, count: enriched.length, deals: enriched });
});

// ── GET /api/flash-deals/:id — single deal ────────────────────────────────────
router.get('/:id', (req, res) => {
  const deal = DEALS_STORE.get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  const discountedPrice = Math.round(deal.originalPrice * (1 - deal.discountPercent / 100));
  res.json({ success: true, deal: { ...deal, discountedPrice } });
});

// ── POST /api/flash-deals/:id/claim — claim a slot ───────────────────────────
const claimSchema = z.object({
  userId: z.string().min(1),
  petType: z.enum(['dog', 'cat']),
  numPets: z.number().int().min(1).max(3).default(1),
});

router.post('/:id/claim', async (req, res) => {
  const deal = DEALS_STORE.get(req.params.id);
  if (!deal || !isDealActive(deal)) {
    return res.status(404).json({ error: 'Deal not found or no longer active' });
  }

  const parsed = claimSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });

  const { numPets } = parsed.data;
  if (deal.slotsRemaining < numPets) {
    return res.status(409).json({ error: `Only ${deal.slotsRemaining} slot(s) remaining` });
  }

  deal.slotsRemaining -= numPets;
  if (deal.slotsRemaining === 0) deal.isActive = false;
  DEALS_STORE.set(deal.id, deal);

  const discountedPrice = Math.round(deal.originalPrice * (1 - deal.discountPercent / 100));
  const totalSavings = Math.round(deal.originalPrice * (deal.discountPercent / 100)) * numPets;

  logger.info(`[FlashDeals] Claimed deal ${deal.id} for ${numPets} pet(s). Remaining: ${deal.slotsRemaining}`);
  res.json({
    success: true,
    claimedSlots: numPets,
    slotsRemaining: deal.slotsRemaining,
    discountedPrice,
    totalSavings,
    message: `Discount locked! Save ₪${totalSavings} on this booking.`,
  });
});

// ── POST /api/flash-deals — create deal (providers/admin only) ────────────────
const createDealSchema = z.object({
  providerName: z.string().min(2),
  serviceType: z.enum(['grooming', 'walking', 'daycare', 'k9000', 'all']),
  petTypes: z.array(z.enum(['dog', 'cat', 'all'])).min(1),
  discountPercent: z.number().int().min(5).max(40),
  originalPrice: z.number().positive(),
  slotsTotal: z.number().int().min(1).max(100),
  validHours: z.number().int().min(1).max(168).default(168), // 1h–1 week, default 1 week
  headline: z.string().min(5),
  headlineHe: z.string().min(5),
  location: z.string().min(2),
});

router.post('/', validateFirebaseToken, async (req: any, res) => {
  const parsed = createDealSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Validation failed', details: parsed.error.errors });

  const data = parsed.data;
  const now = new Date();
  const validUntil = new Date(now.getTime() + data.validHours * 3600 * 1000);
  const id = generateDealId();

  const deal: FlashDeal = {
    id,
    providerId: req.user.uid,
    providerName: data.providerName,
    serviceType: data.serviceType,
    petTypes: data.petTypes,
    discountPercent: data.discountPercent,
    originalPrice: data.originalPrice,
    slotsTotal: data.slotsTotal,
    slotsRemaining: data.slotsTotal,
    validFrom: now,
    validUntil,
    headline: data.headline,
    headlineHe: data.headlineHe,
    location: data.location,
    isActive: true,
    createdAt: now,
  };

  DEALS_STORE.set(id, deal);
  logger.info(`[FlashDeals] Created deal ${id} by provider ${req.user.uid}`);
  res.status(201).json({ success: true, deal });
});

// ── DELETE /api/flash-deals/:id — deactivate deal ─────────────────────────────
router.delete('/:id', validateFirebaseToken, async (req: any, res) => {
  const deal = DEALS_STORE.get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  deal.isActive = false;
  DEALS_STORE.set(deal.id, deal);
  res.json({ success: true, message: 'Deal deactivated' });
});

export default router;
