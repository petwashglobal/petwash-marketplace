import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { 
  providerRateCards,
  serviceAddons,
  providerAvailability,
  quoteRequests
} from "../../shared/schema";
import { nanoid } from "nanoid";

const COMMISSION_RATE = 0.15; // 15% platform commission

interface PetInfo {
  type: 'dog' | 'cat' | 'bird' | 'rabbit' | 'fish' | 'reptile' | 'other';
  size?: 'tiny' | 'small' | 'medium' | 'large' | 'giant';
  name?: string;
  breed?: string;
}

interface QuoteInput {
  providerId: string;
  platform: string;
  serviceType: string;
  startDate: Date;
  endDate: Date;
  pets: PetInfo[];
  requestedAddons?: string[];
  specialRequirements?: string;
}

interface QuoteBreakdown {
  baseAmount: number;
  additionalPetsAmount: number;
  addonsAmount: number;
  surchargeAmount: number;
  discountAmount: number;
  subtotal: number;
  commission: number;
  total: number;
  providerPayout: number;
  currency: 'ILS';
  
  breakdown: {
    nights?: number;
    hours?: number;
    visits?: number;
    ratePerUnit: number;
    additionalPetRate: number;
    addonsList: Array<{ code: string; name: string; price: number }>;
    appliedDiscounts: Array<{ type: string; percent: number; amount: number }>;
    appliedSurcharges: Array<{ type: string; percent: number; amount: number }>;
  };
}

function calculateNights(startDate: Date, endDate: Date): number {
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 5 || day === 6; // Friday/Saturday in Israel
}

function isIsraeliHoliday(date: Date): boolean {
  const year = date.getFullYear();
  const holidays2025 = [
    '2025-03-14', '2025-03-21', // Purim
    '2025-04-13', '2025-04-20', // Passover
    '2025-05-02', // Independence Day
    '2025-06-02', // Shavuot
    '2025-09-23', '2025-09-24', // Rosh Hashanah
    '2025-10-02', // Yom Kippur
    '2025-10-07', '2025-10-14', // Sukkot
    '2025-12-15', '2025-12-22', // Hanukkah
  ];
  const holidays2026 = [
    '2026-03-03', '2026-03-04', // Purim
    '2026-04-02', '2026-04-09', // Passover
    '2026-04-22', // Independence Day
    '2026-05-22', // Shavuot
    '2026-09-12', '2026-09-13', // Rosh Hashanah
    '2026-09-21', // Yom Kippur
    '2026-09-26', '2026-10-03', // Sukkot
    '2026-12-05', '2026-12-12', // Hanukkah
  ];
  
  const dateStr = date.toISOString().split('T')[0];
  return [...holidays2025, ...holidays2026].includes(dateStr);
}

function countWeekendDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current < endDate) {
    if (isWeekend(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

function countHolidayDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  while (current < endDate) {
    if (isIsraeliHoliday(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function calculateQuote(input: QuoteInput): Promise<QuoteBreakdown | null> {
  const rateCard = await db
    .select()
    .from(providerRateCards)
    .where(
      and(
        eq(providerRateCards.providerId, input.providerId),
        eq(providerRateCards.platform, input.platform),
        eq(providerRateCards.serviceType, input.serviceType),
        eq(providerRateCards.isActive, true)
      )
    )
    .limit(1);

  if (!rateCard.length) {
    return null;
  }

  const rate = rateCard[0];
  const nights = calculateNights(input.startDate, input.endDate);
  const petCount = input.pets.length;
  const additionalPets = Math.max(0, petCount - 1);

  let baseAmount = 0;
  let ratePerUnit = 0;
  let unitType: 'nights' | 'hours' | 'visits' = 'nights';

  if (rate.baseRatePerNightCents && nights > 0) {
    baseAmount = rate.baseRatePerNightCents * nights;
    ratePerUnit = rate.baseRatePerNightCents;
    unitType = 'nights';
  } else if (rate.baseRatePerHourCents) {
    const hours = Math.max(1, nights * 2); // Estimate 2 hours per day for hourly services
    baseAmount = rate.baseRatePerHourCents * hours;
    ratePerUnit = rate.baseRatePerHourCents;
    unitType = 'hours';
  } else if (rate.baseRatePerVisitCents) {
    const visits = Math.max(1, nights);
    baseAmount = rate.baseRatePerVisitCents * visits;
    ratePerUnit = rate.baseRatePerVisitCents;
    unitType = 'visits';
  }

  const additionalPetRate = rate.additionalPetSurchargeCents || 0;
  let additionalPetsAmount = 0;
  if (additionalPets > 0) {
    if (unitType === 'nights') {
      additionalPetsAmount = additionalPetRate * nights * additionalPets;
    } else {
      additionalPetsAmount = additionalPetRate * additionalPets;
    }
  }

  let petTypeSurcharge = 0;
  const petTypePricing = rate.petTypePricing as Record<string, number> || {};
  for (const pet of input.pets) {
    const key = pet.size ? `${pet.size}_${pet.type}` : pet.type;
    if (petTypePricing[key]) {
      petTypeSurcharge += petTypePricing[key];
    } else if (petTypePricing[pet.type]) {
      petTypeSurcharge += petTypePricing[pet.type];
    }
  }

  let addonsAmount = 0;
  const addonsList: Array<{ code: string; name: string; price: number }> = [];
  
  if (input.requestedAddons && input.requestedAddons.length > 0) {
    const addonPricing = rate.addonPricing as Record<string, number> || {};
    const enabledAddons = rate.enabledAddons || [];
    
    for (const addonCode of input.requestedAddons) {
      if (enabledAddons.includes(addonCode) && addonPricing[addonCode]) {
        const addonPrice = addonPricing[addonCode];
        addonsAmount += addonPrice;
        addonsList.push({
          code: addonCode,
          name: addonCode.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          price: addonPrice
        });
      }
    }
  }

  let surchargeAmount = 0;
  const appliedSurcharges: Array<{ type: string; percent: number; amount: number }> = [];

  const weekendDays = countWeekendDays(input.startDate, input.endDate);
  if (weekendDays > 0 && rate.weekendSurchargePercent && rate.weekendSurchargePercent > 0) {
    const weekendSurcharge = Math.round((baseAmount / nights) * weekendDays * (rate.weekendSurchargePercent / 100));
    surchargeAmount += weekendSurcharge;
    appliedSurcharges.push({
      type: 'Weekend',
      percent: rate.weekendSurchargePercent,
      amount: weekendSurcharge
    });
  }

  const holidayDays = countHolidayDays(input.startDate, input.endDate);
  if (holidayDays > 0 && rate.holidaySurchargePercent && rate.holidaySurchargePercent > 0) {
    const holidaySurcharge = Math.round((baseAmount / nights) * holidayDays * (rate.holidaySurchargePercent / 100));
    surchargeAmount += holidaySurcharge;
    appliedSurcharges.push({
      type: 'Holiday',
      percent: rate.holidaySurchargePercent,
      amount: holidaySurcharge
    });
  }

  let discountAmount = 0;
  const appliedDiscounts: Array<{ type: string; percent: number; amount: number }> = [];

  if (nights >= 30 && rate.monthlyDiscountPercent && rate.monthlyDiscountPercent > 0) {
    const monthlyDiscount = Math.round(baseAmount * (rate.monthlyDiscountPercent / 100));
    discountAmount += monthlyDiscount;
    appliedDiscounts.push({
      type: 'Monthly (30+ days)',
      percent: rate.monthlyDiscountPercent,
      amount: monthlyDiscount
    });
  } else if (nights >= 7 && rate.weeklyDiscountPercent && rate.weeklyDiscountPercent > 0) {
    const weeklyDiscount = Math.round(baseAmount * (rate.weeklyDiscountPercent / 100));
    discountAmount += weeklyDiscount;
    appliedDiscounts.push({
      type: 'Weekly (7+ days)',
      percent: rate.weeklyDiscountPercent,
      amount: weeklyDiscount
    });
  }

  const subtotal = baseAmount + additionalPetsAmount + petTypeSurcharge + addonsAmount + surchargeAmount - discountAmount;
  const commission = Math.round(subtotal * COMMISSION_RATE);
  const total = subtotal;
  const providerPayout = subtotal - commission;

  return {
    baseAmount,
    additionalPetsAmount,
    addonsAmount,
    surchargeAmount,
    discountAmount,
    subtotal,
    commission,
    total,
    providerPayout,
    currency: 'ILS',
    breakdown: {
      [unitType]: unitType === 'nights' ? nights : undefined,
      ratePerUnit,
      additionalPetRate,
      addonsList,
      appliedDiscounts,
      appliedSurcharges
    }
  };
}

export async function createQuoteRequest(
  input: QuoteInput, 
  customerId: string
): Promise<{ quoteId: string; quote: QuoteBreakdown | null }> {
  const quote = await calculateQuote(input);
  const quoteId = `QUOTE-${Date.now()}-${nanoid(6).toUpperCase()}`;

  await db.insert(quoteRequests).values({
    quoteId,
    customerId,
    providerId: input.providerId,
    platform: input.platform,
    serviceType: input.serviceType,
    startDate: input.startDate.toISOString().split('T')[0],
    endDate: input.endDate.toISOString().split('T')[0],
    numberOfNights: calculateNights(input.startDate, input.endDate),
    petCount: input.pets.length,
    petDetails: sql`${JSON.stringify(input.pets)}::jsonb`,
    requestedAddons: input.requestedAddons || [],
    specialRequirements: input.specialRequirements,
    baseAmountCents: quote?.baseAmount || 0,
    additionalPetsCents: quote?.additionalPetsAmount || 0,
    addonsCents: quote?.addonsAmount || 0,
    surchargeCents: quote?.surchargeAmount || 0,
    discountCents: quote?.discountAmount || 0,
    subtotalCents: quote?.subtotal || 0,
    platformFeeCents: Math.round((quote?.subtotal || 0) * COMMISSION_RATE),
    totalCents: quote?.total || 0,
    providerEarningsCents: quote?.providerPayout || 0,
    status: 'pending'
  });

  return { quoteId, quote };
}

export async function getAvailableAddons(platform: string, serviceType: string) {
  const addons = await db
    .select()
    .from(serviceAddons)
    .where(eq(serviceAddons.isActive, true));

  return addons.filter(addon => {
    const platforms = addon.applicablePlatforms || [];
    const services = addon.applicableServiceTypes || [];
    return (platforms.length === 0 || platforms.includes(platform)) &&
           (services.length === 0 || services.includes(serviceType));
  });
}

export async function getProviderRateCard(
  providerId: string,
  platform: string,
  serviceType: string
) {
  const rateCard = await db
    .select()
    .from(providerRateCards)
    .where(
      and(
        eq(providerRateCards.providerId, providerId),
        eq(providerRateCards.platform, platform),
        eq(providerRateCards.serviceType, serviceType)
      )
    )
    .limit(1);

  return rateCard[0] || null;
}

export function formatPrice(cents: number, currency: 'ILS' = 'ILS'): string {
  const amount = cents / 100;
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency
  }).format(amount);
}

export function formatPriceSimple(cents: number): string {
  return `₪${(cents / 100).toFixed(2)}`;
}
