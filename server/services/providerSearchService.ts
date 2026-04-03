/**
 * MARKETPLACE PROVIDER SEARCH SERVICE
 * Online service domains only: pet_sitting, dog_walking, grooming, transport, daycare.
 * NOT for K9000.
 *
 * Data sources:
 *   dog_walking  → walker_profiles JOIN providers (platformId='walk_my_pet')
 *   pet_sitting  → sitter_profiles (serviceTypes ∋ 'boarding'/'drop_in') JOIN providers (platformId='sitter_suite')
 *   daycare      → sitter_profiles (serviceTypes ∋ 'daycare') JOIN providers (platformId='sitter_suite')
 *   grooming     → providers (platformId='groomers')
 *   transport    → providers (platformId='pet_trek')
 *
 * instantBook flag sourced from provider_operational_settings (left join by providerUid=userId).
 * Geocoding: postcode/city → Google Maps Geocoding API when frontend GPS not supplied.
 */

import type {
  ProviderSearchFilters,
  ProviderSearchItem,
  MarketplaceServiceType,
} from "../../shared/provider-search-types";
import {
  applyProviderFilters,
  scoreProvider,
  assignMatchLabels,
} from "../utils/providerSearch";
import { db } from "../db";
import {
  walkerProfiles,
  sitterProfiles,
  providers,
  providerOperationalSettings,
} from "../../shared/schema";
import { and, eq, or, inArray } from "drizzle-orm";
import { logger } from "../lib/logger";

// ── Helpers ────────────────────────────────────────────────────────────────

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

function parseDec(v: string | number | null | undefined): number {
  if (v == null) return 0;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return isNaN(n) ? 0 : n;
}

// ── Geocoding ──────────────────────────────────────────────────────────────

async function geocodeQuery(
  query: string
): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    logger.warn("[ProviderSearch] GOOGLE_MAPS_API_KEY not set — skipping geocode");
    return null;
  }
  try {
    const params = new URLSearchParams({
      address: query,
      key: apiKey,
      language: "he",
      region: "IL",
      components: "country:IL",
    });
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    if (data.status === "OK" && data.results?.[0]) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    logger.warn("[ProviderSearch] Geocode returned no results", {
      query,
      status: data.status,
    });
    return null;
  } catch (err: any) {
    logger.warn("[ProviderSearch] Geocode error", { error: err.message });
    return null;
  }
}

async function resolveSearchLocation(filters: ProviderSearchFilters): Promise<{
  lat?: number;
  lng?: number;
  source: "input" | "query_geocode" | "none";
}> {
  // Frontend already sent GPS — use it directly
  if (typeof filters.lat === "number" && typeof filters.lng === "number") {
    logger.info("[ProviderSearch] locationSource=input", { lat: filters.lat, lng: filters.lng });
    return { lat: filters.lat, lng: filters.lng, source: "input" };
  }

  // Try to geocode postcode or city if provided
  const query = filters.postcode || filters.q;
  if (query) {
    const coords = await geocodeQuery(query);
    if (coords) {
      logger.info("[ProviderSearch] locationSource=query_geocode", { query, lat: coords.lat, lng: coords.lng });
      return { ...coords, source: "query_geocode" };
    }
  }

  logger.info("[ProviderSearch] locationSource=none — no GPS, no geocodable query");
  return { source: "none" };
}

// ── DB Queries ─────────────────────────────────────────────────────────────

async function fetchDogWalkers(
  filters: ProviderSearchFilters
): Promise<ProviderSearchItem[]> {
  const rows = await db
    .select({
      providerId: providers.id,
      userId: providers.userId,
      businessName: providers.businessName,
      providerBio: providers.bio,
      providerRating: providers.averageRating,
      providerReviews: providers.totalReviews,
      providerBookings: providers.totalBookings,
      providerPhoto: providers.photoUrl,
      providerVerif: providers.verificationStatus,
      providerInsurance: providers.insuranceProvider,
      // Walker profile
      walkerDisplay: walkerProfiles.displayName,
      walkerFirst: walkerProfiles.firstName,
      walkerLast: walkerProfiles.lastName,
      walkerPhoto: walkerProfiles.profilePhotoUrl,
      walkerBio: walkerProfiles.bio,
      city: walkerProfiles.city,
      lat: walkerProfiles.currentLatitude,
      lng: walkerProfiles.currentLongitude,
      walkerRating: walkerProfiles.averageRating,
      walkerReviews: walkerProfiles.totalReviews,
      totalWalks: walkerProfiles.totalWalks,
      responseTime: walkerProfiles.responseTimeMinutes,
      baseHourlyRate: walkerProfiles.baseHourlyRate,
      currency: walkerProfiles.currency,
      verificationStatus: walkerProfiles.verificationStatus,
      // Operational settings
      instantBooking: providerOperationalSettings.instantBooking,
    })
    .from(walkerProfiles)
    .innerJoin(
      providers,
      and(
        eq(walkerProfiles.userId, providers.userId),
        eq(providers.platformId, "walk_my_pet"),
        eq(providers.isActive, true)
      )
    )
    .leftJoin(
      providerOperationalSettings,
      eq(providerOperationalSettings.providerUid, providers.userId)
    )
    .where(eq(walkerProfiles.verificationStatus, "verified"))
    .limit(200);

  return rows.map((w) => {
    const displayName =
      w.walkerDisplay ||
      (w.walkerFirst && w.walkerLast
        ? `${w.walkerFirst} ${w.walkerLast}`
        : w.businessName || "מטייל כלבים");
    const rating = parseDec(w.walkerRating) || parseDec(w.providerRating);
    const price = Math.round(parseDec(w.baseHourlyRate));
    const insured = !!w.providerInsurance;
    const badges: string[] = ["מאומת"];
    if (insured) badges.push("מבוטח");
    if (w.instantBooking) badges.push("הזמנה מיידית");
    if (rating >= 4.8) badges.push("מדורג גבוה");

    return {
      providerId: String(w.providerId),
      providerSlug: slug(`${displayName}-${w.city || "il"}`),
      displayName,
      avatarUrl: w.walkerPhoto ?? w.providerPhoto ?? undefined,
      shortBio: w.walkerBio ?? w.providerBio ?? undefined,
      city: w.city ?? undefined,
      lat: w.lat ? parseDec(w.lat) : undefined,
      lng: w.lng ? parseDec(w.lng) : undefined,
      verified: true,
      insured,
      instantBook: !!w.instantBooking,
      rating,
      reviewsCount: w.walkerReviews ?? w.providerReviews ?? 0,
      completedBookings: w.totalWalks ?? w.providerBookings ?? 0,
      responseTimeMinutes: w.responseTime ?? undefined,
      supportedServices: ["dog_walking"],
      startingPrice: price,
      currency: w.currency ?? "ILS",
      priceLabel: price > 0 ? `מ-₪${price}` : "לפי פנייה",
      availableForRequestedDates: true,
      rankingScore: 0,
      badges,
    };
  });
}

async function fetchSitters(
  serviceType: "pet_sitting" | "daycare" | null
): Promise<ProviderSearchItem[]> {
  // Map marketplace serviceType to the values stored in sitter_profiles.service_types[]
  const SITTER_SERVICE_MAP: Record<string, string[]> = {
    pet_sitting: ["boarding", "drop_in"],
    daycare: ["daycare"],
  };

  const rows = await db
    .select({
      providerId: providers.id,
      userId: providers.userId,
      businessName: providers.businessName,
      providerRating: providers.averageRating,
      providerReviews: providers.totalReviews,
      providerBookings: providers.totalBookings,
      providerInsurance: providers.insuranceProvider,
      // Sitter profile
      firstName: sitterProfiles.firstName,
      lastName: sitterProfiles.lastName,
      avatarUrl: sitterProfiles.profilePictureUrl,
      bio: sitterProfiles.bio,
      city: sitterProfiles.city,
      postalCode: sitterProfiles.postalCode,
      lat: sitterProfiles.latitude,
      lng: sitterProfiles.longitude,
      pricePerDayCents: sitterProfiles.pricePerDayCents,
      sitterServices: sitterProfiles.serviceTypes,
      hasLiabilityInsurance: sitterProfiles.hasLiabilityInsurance,
      verificationLevel: sitterProfiles.verificationLevel,
      // Operational settings
      instantBooking: providerOperationalSettings.instantBooking,
    })
    .from(sitterProfiles)
    .innerJoin(
      providers,
      and(
        eq(sitterProfiles.userId, providers.userId),
        eq(providers.platformId, "sitter_suite"),
        eq(providers.isActive, true)
      )
    )
    .leftJoin(
      providerOperationalSettings,
      eq(providerOperationalSettings.providerUid, providers.userId)
    )
    .where(
      or(
        eq(sitterProfiles.verificationLevel, "bronze"),
        eq(sitterProfiles.verificationLevel, "silver"),
        eq(sitterProfiles.verificationLevel, "gold")
      )
    )
    .limit(200);

  const results: ProviderSearchItem[] = [];
  for (const s of rows) {
    const services = s.sitterServices ?? [];
    // Post-filter by requested service type
    if (serviceType) {
      const required = SITTER_SERVICE_MAP[serviceType] ?? [];
      if (!services.some((sv) => required.includes(sv))) continue;
    }

    // Derive supported marketplace services from the sitter's service_types
    const supported: MarketplaceServiceType[] = [];
    if (services.some((sv) => ["boarding", "drop_in"].includes(sv)))
      supported.push("pet_sitting");
    if (services.includes("daycare")) supported.push("daycare");

    const displayName =
      s.businessName || `${s.firstName} ${s.lastName}`;
    const rating = parseDec(s.providerRating);
    const price = Math.round((s.pricePerDayCents ?? 0) / 100);
    const insured = !!(s.hasLiabilityInsurance || s.providerInsurance);
    const badges: string[] = ["מאומת"];
    if (insured) badges.push("מבוטח");
    if (s.instantBooking) badges.push("הזמנה מיידית");
    if (s.verificationLevel === "gold") badges.push("פרמיום");
    if (rating >= 4.8) badges.push("מדורג גבוה");

    results.push({
      providerId: String(s.providerId),
      providerSlug: slug(`${displayName}-${s.city || "il"}`),
      displayName,
      avatarUrl: s.avatarUrl ?? undefined,
      shortBio: s.bio ?? undefined,
      city: s.city ?? undefined,
      postcode: s.postalCode ?? undefined,
      lat: s.lat ? parseDec(s.lat) : undefined,
      lng: s.lng ? parseDec(s.lng) : undefined,
      verified: ["silver", "gold"].includes(s.verificationLevel ?? ""),
      insured,
      instantBook: !!s.instantBooking,
      rating,
      reviewsCount: s.providerReviews ?? 0,
      completedBookings: s.providerBookings ?? 0,
      supportedServices: supported,
      startingPrice: price,
      currency: "ILS",
      priceLabel: price > 0 ? `מ-₪${price}` : "לפי פנייה",
      availableForRequestedDates: true,
      rankingScore: 0,
      badges,
    });
  }
  return results;
}

async function fetchByPlatform(
  platformId: string,
  serviceType: MarketplaceServiceType
): Promise<ProviderSearchItem[]> {
  const rows = await db
    .select({
      providerId: providers.id,
      userId: providers.userId,
      businessName: providers.businessName,
      bio: providers.bio,
      photoUrl: providers.photoUrl,
      rating: providers.averageRating,
      reviewsCount: providers.totalReviews,
      totalBookings: providers.totalBookings,
      verificationStatus: providers.verificationStatus,
      insuranceProvider: providers.insuranceProvider,
      instantBooking: providerOperationalSettings.instantBooking,
    })
    .from(providers)
    .leftJoin(
      providerOperationalSettings,
      eq(providerOperationalSettings.providerUid, providers.userId)
    )
    .where(
      and(
        eq(providers.platformId, platformId),
        eq(providers.isActive, true)
      )
    )
    .limit(200);

  return rows.map((p) => {
    const displayName = p.businessName || "ספק שירות";
    const rating = parseDec(p.rating);
    const insured = !!p.insuranceProvider;
    const verified = p.verificationStatus === "approved";
    const badges: string[] = [];
    if (verified) badges.push("מאומת");
    if (insured) badges.push("מבוטח");
    if (p.instantBooking) badges.push("הזמנה מיידית");
    if (rating >= 4.8) badges.push("מדורג גבוה");

    return {
      providerId: String(p.providerId),
      providerSlug: slug(`${displayName}-il`),
      displayName,
      avatarUrl: p.photoUrl ?? undefined,
      shortBio: p.bio ?? undefined,
      verified,
      insured,
      instantBook: !!p.instantBooking,
      rating,
      reviewsCount: p.reviewsCount ?? 0,
      completedBookings: p.totalBookings ?? 0,
      supportedServices: [serviceType],
      startingPrice: 0,
      currency: "ILS",
      priceLabel: "לפי פנייה",
      availableForRequestedDates: true,
      rankingScore: 0,
      badges,
    };
  });
}

// ── Main fetch ─────────────────────────────────────────────────────────────

async function fetchMarketplaceProviders(
  filters: ProviderSearchFilters
): Promise<ProviderSearchItem[]> {
  const { serviceType } = filters;

  try {
    if (serviceType === "dog_walking") return fetchDogWalkers(filters);
    if (serviceType === "pet_sitting") return fetchSitters("pet_sitting");
    if (serviceType === "daycare") return fetchSitters("daycare");
    if (serviceType === "grooming")
      return fetchByPlatform("groomers", "grooming");
    if (serviceType === "transport")
      return fetchByPlatform("pet_trek", "transport");

    // No filter → union all domains
    const [walkers, petSitters, daycares, groomers, transport] =
      await Promise.all([
        fetchDogWalkers(filters),
        fetchSitters("pet_sitting"),
        fetchSitters("daycare"),
        fetchByPlatform("groomers", "grooming"),
        fetchByPlatform("pet_trek", "transport"),
      ]);

    // Deduplicate by providerId — sitter may appear in both pet_sitting & daycare
    const seen = new Set<string>();
    const all: ProviderSearchItem[] = [];
    for (const item of [
      ...walkers,
      ...petSitters,
      ...daycares,
      ...groomers,
      ...transport,
    ]) {
      if (!seen.has(item.providerId)) {
        seen.add(item.providerId);
        all.push(item);
      } else {
        // Merge supportedServices into existing entry
        const existing = all.find((x) => x.providerId === item.providerId)!;
        for (const svc of item.supportedServices) {
          if (!existing.supportedServices.includes(svc))
            existing.supportedServices.push(svc);
        }
      }
    }
    return all;
  } catch (err: any) {
    logger.error("[ProviderSearch] fetchMarketplaceProviders failed", {
      error: err.message,
    });
    return [];
  }
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function runProviderSearch(filters: ProviderSearchFilters) {
  const location = await resolveSearchLocation(filters);
  const providerList = await fetchMarketplaceProviders(filters);

  const scored = providerList
    .map((p) => scoreProvider({ ...p }, filters, location))
    .filter((p) => p.rankingScore > -999999);

  const sorted = applyProviderFilters(scored, filters).sort(
    (a, b) => b.rankingScore - a.rankingScore
  );

  const labelled = assignMatchLabels(sorted);

  const page = filters.page || 1;
  const pageSize = filters.pageSize || 20;
  const offset = (page - 1) * pageSize;

  return {
    filters,
    total: labelled.length,
    page,
    pageSize,
    results: labelled.slice(offset, offset + pageSize),
    debug: {
      usedLocation: location.source !== "none",
      locationSource: location.source,
    },
  };
}
