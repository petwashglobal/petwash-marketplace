/**
 * PetWash Quote Engine v1.0.0
 *
 * Single source of truth for all booking pricing.
 * Frontend MUST NOT perform any final price calculations — only render what this returns.
 *
 * Apply order (per brief):
 * 1. Provider base pricing per service
 * 2. Per-pet adjustments (species, size, surcharges)
 * 3. Add-ons
 * 4. Booking subtotal
 * 5. Promo / coupon discount
 * 6. Gift card application
 * 7. Wallet credit application
 * 8. Tax (VAT 18% where applicable — 0 for service bookings per Israeli VAT rules for exempt categories)
 * 9. Final payable total
 *
 * Rules:
 * - No negative totals
 * - All amounts in agorot (integer cents)
 * - Every response carries pricingVersion
 */

import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  providerRateCards,
  walletAccounts,
  bookingRequests,
  bookingRequestPets,
  bookingRequestAddons,
  quoteEngineLogs,
} from "@shared/schema";

export const QUOTE_ENGINE_VERSION = "v1.0.0";

// ── System-level addon catalog ─────────────────────────────────────────────────
// Used as fallback when a provider has no rate card or their catalog is missing.
// This mirrors the frontend ADDON_CATALOG so addons always price correctly.
const SYSTEM_ADDON_CATALOG: Record<string, { name: string; scope: "booking" | "pet"; unit_price_cents: number }> = {
  nail_clip:        { name: "Nail Trim",                   scope: "pet",     unit_price_cents: 3000 },
  ear_clean:        { name: "Ear Cleaning",                scope: "pet",     unit_price_cents: 2000 },
  deshed:           { name: "De-shedding Treatment",       scope: "pet",     unit_price_cents: 5000 },
  teeth_brush:      { name: "Teeth Brushing",              scope: "pet",     unit_price_cents: 2500 },
  bandana:          { name: "Bandana / Bow",               scope: "pet",     unit_price_cents: 1000 },
  blueberry_facial: { name: "Blueberry Facial",            scope: "pet",     unit_price_cents: 2000 },
  extra_30min:      { name: "Extra 30 Minutes",            scope: "booking", unit_price_cents: 3000 },
  dog_park:         { name: "Dog Park Visit",              scope: "booking", unit_price_cents: 1500 },
  photo_report:     { name: "Photo Report",                scope: "booking", unit_price_cents:  500 },
  treat_pack:       { name: "Treat Pack",                  scope: "pet",     unit_price_cents: 1200 },
  medication_admin: { name: "Medication Administration",   scope: "pet",     unit_price_cents: 2000 },
  daily_photos:     { name: "Daily Photo Updates",         scope: "booking", unit_price_cents: 1000 },
  grooming_light:   { name: "Light Grooming",              scope: "pet",     unit_price_cents: 3000 },
  vet_pickup:       { name: "Vet Pickup/Drop-off",         scope: "booking", unit_price_cents: 5000 },
  mail_handling:    { name: "Mail Collection",             scope: "booking", unit_price_cents:  500 },
  plant_watering:   { name: "Plant Watering",              scope: "booking", unit_price_cents:  500 },
  training_report:  { name: "Training Report",             scope: "booking", unit_price_cents: 1500 },
  training_kit:     { name: "Training Kit",                scope: "booking", unit_price_cents: 3000 },
  video_recap:      { name: "Video Recap",                 scope: "booking", unit_price_cents: 2000 },
  special_meal:     { name: "Special Meal Prep",           scope: "pet",     unit_price_cents: 2000 },
  extra_care:       { name: "Extra Attention",             scope: "pet",     unit_price_cents: 2500 },
  // K9000 Wash addons
  blow_dry:         { name: "Blow Dry",                    scope: "pet",     unit_price_cents: 2500 },
  cologne_spray:    { name: "Cologne Spray",               scope: "pet",     unit_price_cents: 1500 },
  flea_treatment:   { name: "Flea Treatment",              scope: "pet",     unit_price_cents: 4000 },
  paw_balm:         { name: "Paw Balm",                    scope: "pet",     unit_price_cents: 1500 },
  // PetTrek (taxi) addons
  carrier_rental:   { name: "Carrier Rental",              scope: "booking", unit_price_cents: 2000 },
  extra_stop:       { name: "Extra Stop",                  scope: "booking", unit_price_cents: 3000 },
  // Sitter Suite addons
  report_card:      { name: "Daily Report Card",           scope: "booking", unit_price_cents:  800 },
};

// ── Types ──────────────────────────────────────────────────────────────────────

export interface QuotePetInput {
  clientRef: string; // "0", "1", "2" — positional index from frontend
  petId?: string | null;
  petName: string;
  petType: "dog" | "cat" | "other";
  breed?: string | null;
  sizeCategory?: "small" | "medium" | "large" | "giant" | null;
  ageYears?: number | null;
  weightKg?: number | null;
  gender?: string | null;
  requiresMedication?: boolean;
  hasBehaviorFlag?: boolean;
  hasSpecialNeeds?: boolean;
  quantity?: number;
}

export interface QuoteAddonInput {
  addonCode: string;
  scope: "booking" | "pet";
  petRef?: string | null; // clientRef of the pet this addon belongs to
  quantity?: number;
}

export interface QuoteRequest {
  providerId: string;
  serviceType: string;
  currency?: string;
  bookingWindow: {
    startAt: string; // ISO
    endAt: string;   // ISO
  };
  pets: QuotePetInput[];
  addons?: QuoteAddonInput[];
  promoCode?: string | null;
  giftCardCode?: string | null;
  useWalletCredit?: boolean;
  userId?: string | null;
  bookingRequestId?: number | null; // set when repricing an existing booking
}

// ── Pricing rule shape stored in provider_rate_cards.pricing_rules ────────────
interface PricingRules {
  base_price_cents?: number;
  additional_pet_price_cents?: number;
  pet_type_rules?: Record<string, number>; // multipliers: { dog: 1.0, cat: 0.9 }
  size_rules?: Record<string, number>;     // multipliers: { small: 1.0, large: 1.25 }
  special_needs_surcharge_cents?: number;
  medication_surcharge_cents?: number;
  behavior_flag_surcharge_cents?: number;
}

interface AddonCatalogEntry {
  code: string;
  name: string;
  scope: "booking" | "pet";
  unit_price_cents: number;
}

// ── Quote response types (matches API contract in brief) ──────────────────────

export interface QuotePetLineItem {
  clientRef: string;
  petId: string | null;
  petName: string;
  label: string; // "First dog", "Additional dog", etc.
  basePriceCents: number;
  adjustmentPriceCents: number;
  subtotalPriceCents: number;
  pricingSnapshot: Record<string, unknown>;
}

export interface QuoteAddonLineItem {
  addonCode: string;
  addonName: string;
  scope: "booking" | "pet";
  petRef: string | null;
  quantity: number;
  unitPriceCents: number;
  subtotalPriceCents: number;
}

export interface AppliedAdjustment {
  type: "promo_code" | "wallet_credit" | "gift_card";
  code?: string;
  amountCents: number;
}

export interface QuoteResponse {
  success: true;
  pricingVersion: string;
  quotedAt: string; // ISO timestamp — used for stale-quote detection on submit
  currency: string;
  serviceType: string;
  providerId: string;
  durationUnits: number; // nights or hours or sessions
  durationLabel: string;
  lineItems: {
    pets: QuotePetLineItem[];
    addons: QuoteAddonLineItem[];
  };
  totals: {
    subtotalCents: number;
    discountCents: number;
    giftCardAppliedCents: number;
    walletCreditAppliedCents: number;
    taxCents: number;
    totalCents: number;
  };
  appliedAdjustments: AppliedAdjustment[];
  warnings: string[];
}

export interface QuoteError {
  success: false;
  error: string;
  warnings: string[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function clampAboveZero(n: number): number {
  return Math.max(0, Math.round(n));
}

function durationUnits(
  serviceType: string,
  startAt: Date,
  endAt: Date
): { units: number; label: string } {
  const msPerHour = 1000 * 60 * 60;
  const msPerDay = msPerHour * 24;
  const diff = endAt.getTime() - startAt.getTime();

  const overnightServices = ["pet_sitting", "house_sitting", "doggy_daycare_overnight"];
  const hourlyServices = ["dog_walking", "dog_training", "training"];
  const perTripServices = ["pet_taxi"];

  if (overnightServices.includes(serviceType)) {
    const nights = Math.max(1, Math.round(diff / msPerDay));
    return { units: nights, label: nights === 1 ? "1 night" : `${nights} nights` };
  }
  if (perTripServices.includes(serviceType)) {
    return { units: 1, label: "1 trip" };
  }
  if (hourlyServices.includes(serviceType)) {
    const hours = Math.max(1, Math.ceil(diff / msPerHour));
    return { units: hours, label: hours === 1 ? "1 hour" : `${hours} hours` };
  }
  // Grooming, daycare, wash: sessions or days
  const days = Math.max(1, Math.round(diff / msPerDay));
  return { units: days, label: days === 1 ? "1 day" : `${days} days` };
}

function petLabel(index: number, petType: string): string {
  if (index === 0) {
    return petType === "cat" ? "First cat" : petType === "other" ? "First pet" : "First dog";
  }
  return petType === "cat" ? "Additional cat" : petType === "other" ? "Additional pet" : "Additional dog";
}

// ── Core quote calculator ──────────────────────────────────────────────────────

export async function calculateQuote(
  req: QuoteRequest
): Promise<QuoteResponse | QuoteError> {
  const warnings: string[] = [];

  // 1. Load provider rate card
  const rateCards = await db
    .select()
    .from(providerRateCards)
    .where(
      and(
        eq(providerRateCards.providerId, req.providerId),
        eq(providerRateCards.serviceType, req.serviceType),
        eq(providerRateCards.isActive, true)
      )
    )
    .limit(1);

  let rules: PricingRules = {};
  let addonCatalog: AddonCatalogEntry[] = [];

  if (rateCards.length > 0) {
    const card = rateCards[0];
    rules = (card.pricingRules as PricingRules) ?? {};
    addonCatalog = (card.addonsCatalog as AddonCatalogEntry[]) ?? [];

    // Merge legacy fields if structured rules are empty
    if (!rules.base_price_cents) {
      const legacy =
        card.baseRatePerNightCents ??
        card.baseRatePerHourCents ??
        card.baseRatePerVisitCents ??
        0;
      rules.base_price_cents = legacy;
    }
    if (!rules.additional_pet_price_cents && card.additionalPetSurchargeCents) {
      rules.additional_pet_price_cents = card.additionalPetSurchargeCents;
    }

    // Check max pets capacity
    const maxPets = card.maxPets ?? 10;
    if (req.pets.length > maxPets) {
      warnings.push(
        `Provider accepts a maximum of ${maxPets} pets per booking. You selected ${req.pets.length}.`
      );
    }
  } else {
    warnings.push("No rate card found for this provider and service type. Using ₪0 base price.");
  }

  // 2. Duration
  const startAt = new Date(req.bookingWindow.startAt);
  const endAt = new Date(req.bookingWindow.endAt);
  const { units: durationUnitsCount, label: durationLabel } = durationUnits(
    req.serviceType,
    startAt,
    endAt
  );

  const basePriceCents = rules.base_price_cents ?? 0;
  const additionalPetCents = rules.additional_pet_price_cents ?? Math.round(basePriceCents * 0.5);

  const petTypeMultipliers: Record<string, number> = rules.pet_type_rules ?? {
    dog: 1.0,
    cat: 0.9,
    other: 0.8,
  };
  const sizeMultipliers: Record<string, number> = rules.size_rules ?? {
    small: 1.0,
    medium: 1.1,
    large: 1.25,
    giant: 1.4,
  };

  // Determine billing unit for the pricingSnapshot rateUnit field
  const overnightSvcs = ["pet_sitting", "house_sitting", "doggy_daycare_overnight"];
  const hourlySvcs = ["dog_walking", "dog_training", "training"];
  const tripSvcs = ["pet_taxi"];
  const rateUnit: string = overnightSvcs.includes(req.serviceType)
    ? "per_night"
    : tripSvcs.includes(req.serviceType)
    ? "per_trip"
    : hourlySvcs.includes(req.serviceType)
    ? "per_hour"
    : "per_session";

  // 3. Per-pet line items
  const petLineItems: QuotePetLineItem[] = req.pets.map((pet, index) => {
    const isFirst = index === 0;
    const unitBase = isFirst ? basePriceCents : additionalPetCents;

    const typeMult = petTypeMultipliers[pet.petType] ?? 1.0;
    const sizeMult = sizeMultipliers[pet.sizeCategory ?? "medium"] ?? 1.0;
    const petBase = Math.round(unitBase * typeMult * sizeMult * durationUnitsCount);

    let adjustment = 0;
    const snapshotFlags: Record<string, unknown> = {};

    if (pet.requiresMedication && rules.medication_surcharge_cents) {
      const medSurcharge = Math.round(
        rules.medication_surcharge_cents * durationUnitsCount
      );
      adjustment += medSurcharge;
      snapshotFlags.medicationSurcharge = medSurcharge;
    }
    if (pet.hasBehaviorFlag && rules.behavior_flag_surcharge_cents) {
      const behSurcharge = Math.round(
        rules.behavior_flag_surcharge_cents * durationUnitsCount
      );
      adjustment += behSurcharge;
      snapshotFlags.behaviorSurcharge = behSurcharge;
    }
    if (pet.hasSpecialNeeds && rules.special_needs_surcharge_cents) {
      const snSurcharge = Math.round(
        rules.special_needs_surcharge_cents * durationUnitsCount
      );
      adjustment += snSurcharge;
      snapshotFlags.specialNeedsSurcharge = snSurcharge;
    }

    return {
      clientRef: pet.clientRef,
      petId: pet.petId ?? null,
      petName: pet.petName,
      label: petLabel(index, pet.petType),
      basePriceCents: petBase,
      adjustmentPriceCents: adjustment,
      subtotalPriceCents: petBase + adjustment,
      pricingSnapshot: {
        isFirst,
        unitBase,
        typeMult,
        sizeMult,
        durationUnits: durationUnitsCount,
        rateUnit,
        ...snapshotFlags,
      },
    };
  });

  // 4. Add-on line items — look up provider catalog first, then system catalog as fallback
  const addonLineItems: QuoteAddonLineItem[] = [];
  for (const addon of req.addons ?? []) {
    // Try provider-specific catalog first
    const providerEntry = addonCatalog.find((a) => a.code === addon.addonCode);
    // Fall back to system catalog so addons always price even without a rate card
    const systemEntry = SYSTEM_ADDON_CATALOG[addon.addonCode];
    const catalogEntry = providerEntry ?? systemEntry;

    if (!catalogEntry) {
      warnings.push(`Add-on "${addon.addonCode}" is not available — skipped.`);
      continue;
    }

    const qty = addon.quantity ?? 1;
    const unitPrice = providerEntry
      ? providerEntry.unit_price_cents
      : systemEntry.unit_price_cents;

    // Validate petRef for pet-scope addons
    if (catalogEntry.scope === "pet" && addon.petRef) {
      const petExists = req.pets.some((p) => p.clientRef === addon.petRef);
      if (!petExists) {
        warnings.push(`Add-on "${addon.addonCode}" references unknown pet ref "${addon.petRef}" — skipped.`);
        continue;
      }
    }

    addonLineItems.push({
      addonCode: addon.addonCode,
      addonName: catalogEntry.name,
      scope: catalogEntry.scope,
      petRef: addon.petRef ?? null,
      quantity: qty,
      unitPriceCents: unitPrice,
      subtotalPriceCents: unitPrice * qty,
    });
  }

  // 5. Booking subtotal (pets + addons)
  const petSubtotal = petLineItems.reduce((s, p) => s + p.subtotalPriceCents, 0);
  const addonSubtotal = addonLineItems.reduce((s, a) => s + a.subtotalPriceCents, 0);
  let subtotal = petSubtotal + addonSubtotal;

  const adjustments: AppliedAdjustment[] = [];

  // 6. Promo / coupon discount (server-side validation only)
  let discountCents = 0;
  if (req.promoCode) {
    const promoResult = await validatePromoCode(req.promoCode, subtotal, req.userId ?? null);
    if (promoResult.valid) {
      discountCents = promoResult.discountCents;
      adjustments.push({
        type: "promo_code",
        code: req.promoCode,
        amountCents: discountCents,
      });
    } else {
      warnings.push(promoResult.reason ?? `Promo code "${req.promoCode}" is not valid.`);
    }
  }

  let remaining = clampAboveZero(subtotal - discountCents);

  // 7. Gift card (egift balance from wallet)
  let giftCardAppliedCents = 0;
  if (req.giftCardCode && remaining > 0 && req.userId) {
    const wallet = await getWallet(req.userId);
    if (wallet && wallet.egiftBalanceCents > 0) {
      giftCardAppliedCents = Math.min(wallet.egiftBalanceCents, remaining);
      remaining = clampAboveZero(remaining - giftCardAppliedCents);
      adjustments.push({ type: "gift_card", amountCents: giftCardAppliedCents });
    }
  }

  // 8. Wallet credit (cash + promo + referral balances)
  let walletCreditAppliedCents = 0;
  if (req.useWalletCredit && remaining > 0 && req.userId) {
    const wallet = await getWallet(req.userId);
    if (wallet) {
      const available =
        (wallet.cashWalletBalanceCents ?? 0) +
        (wallet.promoBalanceCents ?? 0) +
        (wallet.referralBalanceCents ?? 0);
      walletCreditAppliedCents = Math.min(available, remaining);
      remaining = clampAboveZero(remaining - walletCreditAppliedCents);
      if (walletCreditAppliedCents > 0) {
        adjustments.push({ type: "wallet_credit", amountCents: walletCreditAppliedCents });
      }
    }
  }

  // 9. Tax — currently 0 (marketplace services exempt from VAT collection at booking level)
  const taxCents = 0;

  const totalCents = clampAboveZero(remaining + taxCents);

  const response: QuoteResponse = {
    success: true,
    pricingVersion: QUOTE_ENGINE_VERSION,
    quotedAt: new Date().toISOString(),
    currency: req.currency ?? "ILS",
    serviceType: req.serviceType,
    providerId: req.providerId,
    durationUnits: durationUnitsCount,
    durationLabel,
    lineItems: {
      pets: petLineItems,
      addons: addonLineItems,
    },
    totals: {
      subtotalCents: subtotal,
      discountCents,
      giftCardAppliedCents,
      walletCreditAppliedCents,
      taxCents,
      totalCents,
    },
    appliedAdjustments: adjustments,
    warnings,
  };

  // Async audit log (fire-and-forget, never blocks response)
  logQuote(req, response).catch(() => {});

  return response;
}

// ── Persist pet + addon rows after booking is created ────────────────────────

export async function persistBookingQuote(
  bookingRequestId: number,
  quote: QuoteResponse,
  pets: QuotePetInput[],
  addons: QuoteAddonInput[]
): Promise<{ petRows: { id: string }[]; addonRows: { id: string }[] }> {
  // Delete existing rows (idempotent reprice)
  await db.delete(bookingRequestPets).where(
    eq(bookingRequestPets.bookingRequestId, bookingRequestId)
  );
  await db.delete(bookingRequestAddons).where(
    eq(bookingRequestAddons.bookingRequestId, bookingRequestId)
  );

  // Insert pet rows
  const petInserts = quote.lineItems.pets.map((line, i) => {
    const petInput = pets.find((p) => p.clientRef === line.clientRef) ?? pets[i];
    return {
      bookingRequestId,
      petId: line.petId ? parseInt(line.petId, 10) : null,
      petName: line.petName,
      petType: petInput?.petType ?? "dog",
      breed: petInput?.breed ?? null,
      sizeCategory: petInput?.sizeCategory ?? null,
      ageYears: petInput?.ageYears?.toString() ?? null,
      weightKg: petInput?.weightKg?.toString() ?? null,
      gender: petInput?.gender ?? null,
      specialNotes: null,
      requiresMedication: petInput?.requiresMedication ?? false,
      hasBehaviorFlag: petInput?.hasBehaviorFlag ?? false,
      hasSpecialNeeds: petInput?.hasSpecialNeeds ?? false,
      quantity: petInput?.quantity ?? 1,
      basePriceCents: line.basePriceCents,
      adjustmentPriceCents: line.adjustmentPriceCents,
      subtotalPriceCents: line.subtotalPriceCents,
      currency: quote.currency,
      pricingSnapshot: line.pricingSnapshot,
    };
  });

  const petRows = petInserts.length > 0
    ? await db.insert(bookingRequestPets).values(petInserts).returning({ id: bookingRequestPets.id })
    : [];

  // Map clientRef -> DB id for pet-level addon FKs
  const petRefToDbId: Record<string, string> = {};
  quote.lineItems.pets.forEach((line, i) => {
    if (petRows[i]) petRefToDbId[line.clientRef] = petRows[i].id;
  });

  // Insert addon rows
  const addonInserts = quote.lineItems.addons.map((line) => ({
    bookingRequestId,
    bookingRequestPetId: line.petRef ? (petRefToDbId[line.petRef] ?? null) : null,
    addonCode: line.addonCode,
    addonName: line.addonName,
    addonScope: line.scope,
    quantity: line.quantity,
    unitPriceCents: line.unitPriceCents,
    subtotalPriceCents: line.subtotalPriceCents,
    currency: quote.currency,
    pricingSnapshot: {},
  }));

  const addonRows = addonInserts.length > 0
    ? await db.insert(bookingRequestAddons).values(addonInserts).returning({ id: bookingRequestAddons.id })
    : [];

  // Update booking_requests quote summary columns
  await db
    .update(bookingRequests)
    .set({
      quoteSubtotalCents: quote.totals.subtotalCents,
      quoteDiscountCents: quote.totals.discountCents,
      quoteGiftCardCents: quote.totals.giftCardAppliedCents,
      quoteCreditCents: quote.totals.walletCreditAppliedCents,
      quoteTaxCents: quote.totals.taxCents,
      quoteTotalCents: quote.totals.totalCents,
      quoteCurrency: quote.currency,
      quoteBreakdown: quote as unknown as Record<string, unknown>,
      pricingVersion: quote.pricingVersion,
      walletCreditUsedCents: quote.totals.walletCreditAppliedCents,
    })
    .where(eq(bookingRequests.id, bookingRequestId));

  return { petRows, addonRows };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function getWallet(userId: string) {
  const rows = await db
    .select({
      egiftBalanceCents: walletAccounts.egiftBalanceCents,
      cashWalletBalanceCents: walletAccounts.cashWalletBalanceCents,
      promoBalanceCents: walletAccounts.promoBalanceCents,
      referralBalanceCents: walletAccounts.referralBalanceCents,
    })
    .from(walletAccounts)
    .where(eq(walletAccounts.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

interface PromoResult {
  valid: boolean;
  discountCents: number;
  reason?: string;
}

async function validatePromoCode(
  code: string,
  subtotalCents: number,
  _userId: string | null
): Promise<PromoResult> {
  // Simplified: look up code in campaigns table (future: full campaign engine)
  try {
    const result = await db.execute(
      `SELECT discount_type, discount_value, min_order_cents, max_discount_cents, is_active
       FROM campaigns
       WHERE promo_code = $1
         AND is_active = true
         AND (expires_at IS NULL OR expires_at > now())
       LIMIT 1`,
      [code.trim().toUpperCase()]
    );
    const row = (result as any).rows?.[0];
    if (!row) return { valid: false, discountCents: 0, reason: `Promo code "${code}" not found or expired.` };

    if (row.min_order_cents && subtotalCents < parseInt(row.min_order_cents)) {
      return {
        valid: false,
        discountCents: 0,
        reason: `Minimum order of ₪${Math.round(row.min_order_cents / 100)} required for this promo.`,
      };
    }

    let discount = 0;
    if (row.discount_type === "percent") {
      discount = Math.round((subtotalCents * parseFloat(row.discount_value)) / 100);
    } else {
      discount = parseInt(row.discount_value ?? "0") * 100;
    }

    if (row.max_discount_cents) {
      discount = Math.min(discount, parseInt(row.max_discount_cents));
    }

    return { valid: true, discountCents: clampAboveZero(discount) };
  } catch {
    return { valid: false, discountCents: 0, reason: "Promo validation unavailable." };
  }
}

async function logQuote(req: QuoteRequest, res: QuoteResponse) {
  await db.insert(quoteEngineLogs).values({
    bookingRequestId: req.bookingRequestId ?? null,
    userId: req.userId ?? null,
    providerId: req.providerId,
    serviceType: req.serviceType,
    requestPayload: req as unknown as Record<string, unknown>,
    responsePayload: res as unknown as Record<string, unknown>,
    pricingVersion: QUOTE_ENGINE_VERSION,
  });
}
