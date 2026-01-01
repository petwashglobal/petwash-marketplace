// FILE: src/marketplace/petwash_talent_marketplace_system_2026.tsx
// PetWash Talent Marketplace System 2026
// Contains:
// 1) Shared types and platform registry
// 2) In memory contractor dataset (demo)
// 3) Backend API registration helpers
// 4) Frontend React components (Marketplace + Join page)
// 5) Basic SPA routes wrapper
// 6) QA helper for quick consistency checks

import React from "react";

/* =========================================================
 * 1. SHARED TYPES AND PLATFORM REGISTRY
 * =======================================================*/

export type PlatformId =
  | "sitter"
  | "walk"
  | "transport"
  | "hub"
  | "lostFound"
  | "hardware"
  | "enterprise";

export interface PlatformDefinition {
  id: PlatformId;
  shortName: string;
  fullName: string;
  tagLine: string;
  description: string;
  accentBorder: string;
  accentChip: string;
  iconEmoji: string;
  // Routing and backend integration
  routePath: string;
  apiNamespace: string; // for example "/api/contractors"
  octopusNamespace: string; // for example "petwash.sitter"
  isActive: boolean; // easy way to hide or pause a platform
  sortOrder: number;
}

export interface ContractorProfile {
  id: string;
  platformId: PlatformId;
  name: string;
  title: string;
  mainService: string;
  location: string;
  rating: number;
  reviews: number;
  priceFrom?: string;
  heroLabel?: string;
  badges: string[];
  specialties: string[];
  imageUrl: string;
  // future fields
  isActive?: boolean;
  city?: string;
  country?: string;
}

export const PLATFORM_REGISTRY: PlatformDefinition[] = [
  {
    id: "sitter",
    shortName: "Sitter",
    fullName: "The Sitter Suite",
    tagLine: "Hotel level pet sitting and house guardians.",
    description:
      "Trusted sitters and house guardians who care for your pets, your plants and your property while you travel.",
    accentBorder: "border-rose-400 text-rose-500",
    accentChip: "bg-rose-50 text-rose-500",
    iconEmoji: "🏡",
    routePath: "/platform/sitter",
    apiNamespace: "/api/contractors",
    octopusNamespace: "petwash.sitter",
    isActive: true,
    sortOrder: 10,
  },
  {
    id: "walk",
    shortName: "Walk My Pet",
    fullName: "Walk My Pet",
    tagLine: "Premium dog walkers with live GPS.",
    description:
      "City walkers and calm handlers who follow structured routes, send photos and keep your dog relaxed.",
    accentBorder: "border-emerald-400 text-emerald-500",
    accentChip: "bg-emerald-50 text-emerald-600",
    iconEmoji: "🐾",
    routePath: "/platform/walk",
    apiNamespace: "/api/contractors",
    octopusNamespace: "petwash.walk",
    isActive: true,
    sortOrder: 20,
  },
  {
    id: "transport",
    shortName: "PetTrek",
    fullName: "PetTrek Transport",
    tagLine: "Uber style pet rides with live tracking.",
    description:
      "Safe drivers and vehicles for vet visits, washes, airport trips and longer journeys.",
    accentBorder: "border-indigo-400 text-indigo-500",
    accentChip: "bg-indigo-50 text-indigo-600",
    iconEmoji: "🚐",
    routePath: "/platform/transport",
    apiNamespace: "/api/contractors",
    octopusNamespace: "petwash.transport",
    isActive: true,
    sortOrder: 30,
  },
  {
    id: "hub",
    shortName: "Wash Hub",
    fullName: "Pet Wash Hub Operators",
    tagLine: "Operators of premium organic wash hubs.",
    description:
      "Local hub operators who run PetWash stations with strict hygiene, maintenance and guest service standards.",
    accentBorder: "border-sky-400 text-sky-500",
    accentChip: "bg-sky-50 text-sky-600",
    iconEmoji: "🛁",
    routePath: "/platform/hub",
    apiNamespace: "/api/contractors",
    octopusNamespace: "petwash.hub",
    isActive: true,
    sortOrder: 40,
  },
  {
    id: "lostFound",
    shortName: "Paw Finder",
    fullName: "Paw Finder Community",
    tagLine: "Community heroes for lost and found pets.",
    description:
      "Moderators and community leads who run local zones and help reunite pets with their families.",
    accentBorder: "border-amber-400 text-amber-500",
    accentChip: "bg-amber-50 text-amber-600",
    iconEmoji: "🧭",
    routePath: "/platform/paw-finder",
    apiNamespace: "/api/contractors",
    octopusNamespace: "petwash.pawfinder",
    isActive: true,
    sortOrder: 50,
  },
  {
    id: "hardware",
    shortName: "K9000",
    fullName: "K9000 Technicians",
    tagLine: "Engineers for smart wash hardware.",
    description:
      "Technicians and field engineers who install, service and monitor K9000 machines and IoT hardware.",
    accentBorder: "border-slate-500 text-slate-700",
    accentChip: "bg-slate-100 text-slate-700",
    iconEmoji: "⚙️",
    routePath: "/platform/k9000",
    apiNamespace: "/api/contractors",
    octopusNamespace: "petwash.k9000",
    isActive: true,
    sortOrder: 60,
  },
  {
    id: "enterprise",
    shortName: "Enterprise",
    fullName: "Enterprise Partners",
    tagLine: "Franchise and white label leaders.",
    description:
      "Franchise owners and enterprise partners who operate PetWash at city scale with full data and analytics.",
    accentBorder: "border-orange-400 text-orange-500",
    accentChip: "bg-orange-50 text-orange-600",
    iconEmoji: "🌐",
    routePath: "/platform/enterprise",
    apiNamespace: "/api/contractors",
    octopusNamespace: "petwash.enterprise",
    isActive: true,
    sortOrder: 70,
  },
];

/* =========================================================
 * 2. IN MEMORY DEMO CONTRACTOR DATA
 *    In production this should be replaced by a database
 * =======================================================*/

export const DEMO_CONTRACTORS: ContractorProfile[] = [
  // Sitter
  {
    id: "sitter_april_k",
    platformId: "sitter",
    name: "April K.",
    title: "Luxury home sitter and house guardian",
    mainService:
      "Overnight boutique stays or full house sitting while you travel.",
    location: "Armadale, VIC · Australia",
    rating: 4.98,
    reviews: 126,
    priceFrom: "$145 per night",
    heroLabel: "7 star featured sitter",
    badges: ["House sitting", "Property care", "Senior pets"],
    specialties: ["Dogs up to 25kg", "Indoor cats", "Medication schedules"],
    imageUrl:
      "https://images.pexels.com/photos/4587995/pexels-photo-4587995.jpeg",
    isActive: true,
    city: "Melbourne",
    country: "Australia",
  },
  {
    id: "sitter_daniela_r",
    platformId: "sitter",
    name: "Daniela R.",
    title: "Calm sitter for small dogs and cats",
    mainService:
      "Stays at your apartment and keeps your pets on their usual routine.",
    location: "Tel Aviv, Israel",
    rating: 4.95,
    reviews: 89,
    priceFrom: "$120 per night",
    heroLabel: "City stays",
    badges: ["Apartments", "Indoor only", "Daily photo updates"],
    specialties: ["Rescue pets", "Shy dogs", "Plant care"],
    imageUrl:
      "https://images.pexels.com/photos/7210275/pexels-photo-7210275.jpeg",
    isActive: true,
    city: "Tel Aviv",
    country: "Israel",
  },
  {
    id: "sitter_james_noor",
    platformId: "sitter",
    name: "James & Noor",
    title: "Couple sitters for larger homes",
    mainService:
      "House guardians for family homes and villas with multiple pets.",
    location: "Dubai, UAE",
    rating: 5,
    reviews: 54,
    priceFrom: "$220 per night",
    heroLabel: "Large homes",
    badges: ["Multiple pets", "Pools and gardens", "Airport transfers"],
    specialties: ["Big dogs", "Puppies", "Luxury properties"],
    imageUrl:
      "https://images.pexels.com/photos/5731912/pexels-photo-5731912.jpeg",
    isActive: true,
    city: "Dubai",
    country: "UAE",
  },

  // Walk
  {
    id: "walk_ido_s",
    platformId: "walk",
    name: "Ido S.",
    title: "Structured city walker",
    mainService: "Premium one on one walks with live GPS and clean routes.",
    location: "Ramat Gan, Israel",
    rating: 4.96,
    reviews: 102,
    priceFrom: "$39 per walk",
    heroLabel: "Live GPS",
    badges: ["Solo walks", "Route history", "Photo recap"],
    specialties: ["High energy dogs", "Loose leash work", "Heat safe timing"],
    imageUrl:
      "https://images.pexels.com/photos/7214460/pexels-photo-7214460.jpeg",
    isActive: true,
    city: "Ramat Gan",
    country: "Israel",
  },
  {
    id: "walk_maya_l",
    platformId: "walk",
    name: "Maya L.",
    title: "Calm walker for small dogs",
    mainService:
      "Short calm walks and enrichment games for seniors and small breeds.",
    location: "Melbourne, Australia",
    rating: 4.94,
    reviews: 77,
    priceFrom: "$35 per walk",
    heroLabel: "Senior friendly",
    badges: ["Short routes", "Enrichment", "Gentle handling"],
    specialties: ["Senior dogs", "Tiny breeds", "Post surgery care"],
    imageUrl:
      "https://images.pexels.com/photos/4588065/pexels-photo-4588065.jpeg",
    isActive: true,
    city: "Melbourne",
    country: "Australia",
  },

  // Transport
  {
    id: "transport_tel_aviv",
    platformId: "transport",
    name: "PetTrek Tel Aviv",
    title: "City and airport pet rides",
    mainService: "Climate controlled van with secure crates and live ETA.",
    location: "Tel Aviv, Israel",
    rating: 4.92,
    reviews: 64,
    priceFrom: "From $49 per ride",
    heroLabel: "Live tracking",
    badges: ["Airport", "Vet visits", "Multi pet"],
    specialties: ["Cats", "Dog pairs", "Longer routes"],
    imageUrl:
      "https://images.pexels.com/photos/7214463/pexels-photo-7214463.jpeg",
    isActive: true,
    city: "Tel Aviv",
    country: "Israel",
  },
  {
    id: "transport_maxi",
    platformId: "transport",
    name: "Maxi Pet Chauffeur",
    title: "Comfort rides for anxious pets",
    mainService:
      "Single family only, soft harness options and soft music in the car.",
    location: "Sydney, Australia",
    rating: 4.97,
    reviews: 38,
    priceFrom: "From $65 per ride",
    heroLabel: "Comfort rides",
    badges: ["Anxious pets", "One family only", "Door to door"],
    specialties: ["Rescue dogs", "Noise sensitive", "Short notice"],
    imageUrl:
      "https://images.pexels.com/photos/7210268/pexels-photo-7210268.jpeg",
    isActive: true,
    city: "Sydney",
    country: "Australia",
  },

  // Hubs
  {
    id: "hub_ramat_gan",
    platformId: "hub",
    name: "PetWash Hub - Ramat Gan Park",
    title: "Outdoor wash hub with dual K9000 bays",
    mainService:
      "Organic shampoos, shade, lockers and integrated loyalty for families.",
    location: "Ramat Gan National Park, Israel",
    rating: 4.93,
    reviews: 112,
    priceFrom: "From $18 per wash",
    heroLabel: "Flagship hub",
    badges: ["Organic products", "Shade", "Self service"],
    specialties: ["Weekend families", "Big dogs", "Quick rinse"],
    imageUrl:
      "https://images.pexels.com/photos/5731864/pexels-photo-5731864.jpeg",
    isActive: true,
    city: "Ramat Gan",
    country: "Israel",
  },
  {
    id: "hub_melbourne_cbd",
    platformId: "hub",
    name: "PetWash Hub - Inner City",
    title: "High traffic city hub",
    mainService:
      "Fast in and out washes with digital receipts for busy owners.",
    location: "Melbourne CBD, Australia",
    rating: 4.9,
    reviews: 59,
    priceFrom: "From $19 per wash",
    heroLabel: "City hub",
    badges: ["Digital receipts", "Late hours", "Quick dry"],
    specialties: ["Office workers", "Short visits", "Back to back washes"],
    imageUrl:
      "https://images.pexels.com/photos/5731913/pexels-photo-5731913.jpeg",
    isActive: true,
    city: "Melbourne",
    country: "Australia",
  },

  // Paw Finder
  {
    id: "paw_kfar_saba",
    platformId: "lostFound",
    name: "Kfar Saba Paw Finder Zone",
    title: "Volunteer community group",
    mainService: "Runs instant alerts and AI photo matches for the area.",
    location: "Kfar Saba, Israel",
    rating: 5,
    reviews: 41,
    priceFrom: "Always free",
    heroLabel: "Community hero",
    badges: ["Fast alerts", "AI photo match", "Posters pack"],
    specialties: ["Dogs and cats", "Urban parks", "Housing blocks"],
    imageUrl:
      "https://images.pexels.com/photos/3299900/pexels-photo-3299900.jpeg",
    isActive: true,
    city: "Kfar Saba",
    country: "Israel",
  },
  {
    id: "paw_south_melbourne",
    platformId: "lostFound",
    name: "South Melbourne Paw Finder",
    title: "Lost and found volunteers",
    mainService:
      "Organises local groups and contact points near the beach zone.",
    location: "South Melbourne, Australia",
    rating: 4.96,
    reviews: 29,
    priceFrom: "Always free",
    heroLabel: "Beach zone",
    badges: ["Collar checks", "Local vets", "Microchip scan"],
    specialties: ["Dogs near beach", "Shared yards", "Apartments"],
    imageUrl:
      "https://images.pexels.com/photos/573552/pexels-photo-573552.jpeg",
    isActive: true,
    city: "Melbourne",
    country: "Australia",
  },

  // Hardware
  {
    id: "hw_israel",
    platformId: "hardware",
    name: "K9000 Service Israel",
    title: "Certified K9000 field technicians",
    mainService: "Install, calibrate and maintain PetWash K9000 machines.",
    location: "Nationwide, Israel",
    rating: 4.9,
    reviews: 34,
    priceFrom: "Service plans on request",
    heroLabel: "Official service",
    badges: ["Installations", "Preventive maintenance", "Remote diagnostics"],
    specialties: ["Dual bays", "Outdoor installs", "Retrofit projects"],
    imageUrl:
      "https://images.pexels.com/photos/8960982/pexels-photo-8960982.jpeg",
    isActive: true,
    city: "Nationwide",
    country: "Israel",
  },
  {
    id: "hw_melbourne",
    platformId: "hardware",
    name: "K9000 Tech Melbourne",
    title: "Local hardware partner",
    mainService:
      "Supports airport and mall hubs with rapid response times.",
    location: "Victoria, Australia",
    rating: 4.95,
    reviews: 21,
    priceFrom: "Service plans on request",
    heroLabel: "Rapid response",
    badges: ["SLAs", "Spare parts", "Firmware updates"],
    specialties: ["Shopping centers", "High foot traffic", "Night works"],
    imageUrl:
      "https://images.pexels.com/photos/6872933/pexels-photo-6872933.jpeg",
    isActive: true,
    city: "Melbourne",
    country: "Australia",
  },

  // Enterprise
  {
    id: "ent_tel_aviv",
    platformId: "enterprise",
    name: "PetWash Tel Aviv Franchise",
    title: "City franchise partner",
    mainService:
      "Runs multiple hubs and transport fleets under one license.",
    location: "Tel Aviv, Israel",
    rating: 4.98,
    reviews: 17,
    priceFrom: "Enterprise terms",
    heroLabel: "City scale",
    badges: ["Multi site", "Fleet management", "Analytics"],
    specialties: ["Municipal partners", "Advertising", "High density areas"],
    imageUrl:
      "https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg",
    isActive: true,
    city: "Tel Aviv",
    country: "Israel",
  },
  {
    id: "ent_gcc",
    platformId: "enterprise",
    name: "GCC PetWash Group",
    title: "Regional master franchise",
    mainService:
      "Expands PetWash hubs across several countries in the region.",
    location: "GCC region",
    rating: 5,
    reviews: 9,
    priceFrom: "Enterprise terms",
    heroLabel: "Regional master",
    badges: ["Multi currency", "White label", "Data agreements"],
    specialties: ["Airports", "Malls", "Tourist zones"],
    imageUrl:
      "https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg",
    isActive: true,
    city: "GCC",
    country: "Regional",
  },
];

/* =========================================================
 * 3. BACKEND API REGISTRATION HELPERS
 *    Simple Express style registration
 * =======================================================*/

type ExpressLikeApp = {
  get: (path: string, handler: any) => void;
  post: (path: string, handler: any) => void;
};

const PLATFORM_INDEX: Record<PlatformId, PlatformDefinition> =
  PLATFORM_REGISTRY.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<PlatformId, PlatformDefinition>);

export function registerTalentMarketplaceApi(app: ExpressLikeApp) {
  // GET /api/contractors?platform=sitter or all
  app.get("/api/contractors", (req: any, res: any) => {
    const platform = (req.query.platform as PlatformId | undefined) || undefined;
    const activeOnly = req.query.active !== "false";

    let list = DEMO_CONTRACTORS.slice();

    if (platform) {
      list = list.filter((c) => c.platformId === platform);
    }
    if (activeOnly) {
      list = list.filter((c) => c.isActive !== false);
    }

    res.json({
      ok: true,
      count: list.length,
      items: list,
    });
  });

  // GET /api/contractors/:id
  app.get("/api/contractors/:id", (req: any, res: any) => {
    const id = req.params.id;
    const contractor = DEMO_CONTRACTORS.find((c) => c.id === id);
    if (!contractor) {
      res.status(404).json({ ok: false, error: "not_found" });
      return;
    }
    res.json({ ok: true, item: contractor });
  });

  // POST /api/contractors/apply
  // body: { platformId, name, email, phone, city, country, message }
  app.post("/api/contractors/apply", async (req: any, res: any) => {
    const {
      platformId,
      name,
      email,
      phone,
      city,
      country,
      message,
    } = req.body || {};

    if (!platformId || !name || !email) {
      res.status(400).json({
        ok: false,
        error: "missing_required_fields",
      });
      return;
    }

    if (!PLATFORM_INDEX[platformId as PlatformId]) {
      res.status(400).json({
        ok: false,
        error: "invalid_platform",
      });
      return;
    }

    const stored = {
      id: `pending_${Date.now()}`,
      ts: new Date().toISOString(),
      platformId,
      name,
      email,
      phone,
      city,
      country,
      message,
    };

    // Here the dev can:
    // - push to database
    // - send email to support@petwash.co.il
    // - send event to Octopus Global Brain

    // eslint-disable-next-line no-console
    console.log("New contractor application:", stored);

    res.json({
      ok: true,
      received: true,
    });
  });

  // POST /api/auth/register-contractor
  // very simple placeholder (dev will replace with real auth)
  app.post("/api/auth/register-contractor", (req: any, res: any) => {
    const { email, password, platformId } = req.body || {};
    if (!email || !password || !platformId) {
      res.status(400).json({ ok: false, error: "missing_required_fields" });
      return;
    }
    res.json({
      ok: true,
      contractorId: `demo_${Date.now()}`,
    });
  });
}

/* =========================================================
 * 4. FRONTEND COMPONENTS
 *    A. ContractorCard
 *    B. Marketplace
 *    C. JoinAsContractor form
 * =======================================================*/

const formatRating = (n: number) => n.toFixed(2);

function ContractorCard({
  profile,
  platform,
}: {
  profile: ContractorProfile;
  platform: PlatformDefinition;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
      <div className="relative h-52 w-full overflow-hidden">
        <img
          src={profile.imageUrl}
          alt={profile.name}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-col gap-2">
          {profile.heroLabel && (
            <span className="inline-flex items-center rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-slate-900 shadow-sm">
              {profile.heroLabel}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full border bg-white/90 px-2.5 py-0.5 text-[10px] font-medium ${platform.accentBorder}`}
          >
            {platform.shortName}
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="mb-1 flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {profile.name}
            </h3>
            <p className="mt-0.5 text-xs text-slate-500">
              {profile.title}
            </p>
          </div>
          <div className="text-right text-xs">
            <div className="flex items-center justify-end gap-1 text-amber-500">
              <span>★</span>
              <span className="font-semibold">
                {formatRating(profile.rating)}
              </span>
            </div>
            <div className="text-[11px] text-slate-500">
              {profile.reviews} reviews
            </div>
          </div>
        </div>

        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-700">
          {profile.mainService}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {profile.badges.map((badge) => (
            <span
              key={badge}
              className={`inline-flex items-center rounded-full border border-slate-100 px-2 py-0.5 text-[10px] ${platform.accentChip}`}
            >
              {badge}
            </span>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
          <div className="flex items-center gap-1.5">
            <span>📍</span>
            <span>{profile.location}</span>
          </div>
          {profile.priceFrom && (
            <div className="font-medium text-slate-900">
              {profile.priceFrom}
            </div>
          )}
        </div>

        <div className="mt-3 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span className="font-semibold text-slate-700">
              Specialties:
            </span>
            <span className="line-clamp-1">
              {profile.specialties.join(" · ")}
            </span>
          </div>

          <button
            type="button"
            className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-slate-900/5 bg-slate-900 text-xs font-semibold text-white shadow-[0_10px_35px_rgba(15,23,42,0.35)] transition hover:bg-slate-800"
          >
            View profile and request
          </button>
        </div>
      </div>
    </article>
  );
}

// Pure white marketplace
export const PetWashTalentMarketplacePage: React.FC = () => {
  const activePlatforms = PLATFORM_REGISTRY.filter((p) => p.isActive).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const [platformId, setPlatformId] = React.useState<PlatformId>(
    activePlatforms[0]?.id || "sitter"
  );

  const platform = PLATFORM_INDEX[platformId];
  const profiles = DEMO_CONTRACTORS.filter(
    (p) => p.platformId === platformId && p.isActive !== false
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              PetWash Talent Marketplace
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              Book trusted PetWash partners
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              Pet Wash™ Luxury Marketplace, designed for 2026. All profiles
              are tied to the same PetWash login, loyalty engine and Octopus
              Global Brain.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
              Banking level security · Luxury white design
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] text-slate-500 shadow-sm">
              One account for wash, walk, sitter and transport
            </span>
          </div>
        </header>

        <nav className="mb-6 overflow-x-auto pb-1">
          <div className="inline-flex rounded-full bg-white p-1 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
            {activePlatforms.map((p) => {
              const active = p.id === platformId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPlatformId(p.id)}
                  className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-medium transition ${
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {p.shortName}
                </button>
              );
            })}
          </div>
        </nav>

        <section className="mb-6 rounded-3xl border border-slate-100 bg-white px-5 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full border bg-white px-2.5 py-0.5 ${platform.accentBorder}`}
                >
                  {platform.fullName}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-semibold text-slate-900">
                {platform.tagLine}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                {platform.description}
              </p>
            </div>
            <div className="flex flex-col gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 shadow-sm">
                  ⭐ 4.9 average rating
                </span>
                <span className="hidden rounded-full bg-slate-50 px-3 py-1 shadow-sm sm:inline-flex">
                  Verified identity and phone
                </span>
              </div>
              <div className="hidden gap-2 sm:flex">
                <div className="flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                  🔍 Search by city or suburb (future filter)
                </div>
                <div className="items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px]">
                  Sort by rating or price (future control)
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          {profiles.length === 0 ? (
            <div className="rounded-3xl border border-slate-100 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              No profiles for this platform yet. They will appear here once
              Octopus Global Brain syncs live contractors from your backend.
            </div>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {profiles.map((profile) => (
                <ContractorCard
                  key={profile.id}
                  profile={profile}
                  platform={platform}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-10 rounded-3xl border border-slate-100 bg-white px-5 py-5 text-center text-[11px] text-slate-500 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          Want to join as a contractor or hub operator?
          <br />
          Use the Join page at <span className="font-medium">/join</span> or
          connect with PetWash directly.
        </section>
      </main>
    </div>
  );
};

// Simple white join form to let contractors apply now
export const JoinAsContractorPage: React.FC = () => {
  const activePlatforms = PLATFORM_REGISTRY.filter((p) => p.isActive).sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const [state, setState] = React.useState({
    platformId: activePlatforms[0]?.id || "sitter",
    name: "",
    email: "",
    phone: "",
    city: "",
    country: "",
    message: "",
  });
  const [status, setStatus] = React.useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setState((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("sending");
    try {
      const res = await fetch("/api/contractors/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw new Error("network");
      const body = await res.json();
      if (body.ok) {
        setStatus("sent");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-3xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        <header className="mb-6">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
            PetWash Partners
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            Join the Talent Marketplace
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            One short form to express interest. The PetWash team reviews every
            application and will contact you with next steps for your platform.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-slate-100 bg-white px-5 py-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Platform
              </label>
              <select
                name="platformId"
                value={state.platformId}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              >
                {activePlatforms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.fullName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Full name or company
              </label>
              <input
                type="text"
                name="name"
                value={state.name}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={state.email}
                onChange={handleChange}
                required
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Phone
              </label>
              <input
                type="tel"
                name="phone"
                value={state.phone}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-700">
                City
              </label>
              <input
                type="text"
                name="city"
                value={state.city}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Country
              </label>
              <input
                type="text"
                name="country"
                value={state.country}
                onChange={handleChange}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-700">
                Short description
              </label>
              <textarea
                name="message"
                value={state.message}
                onChange={handleChange}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none"
                placeholder="Tell us about your experience, vehicles or facilities, and why you want to join PetWash."
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={status === "sending" || status === "sent"}
            className="mt-5 inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_35px_rgba(15,23,42,0.35)] hover:bg-slate-800 disabled:opacity-70"
          >
            {status === "idle" && "Send application"}
            {status === "sending" && "Sending..."}
            {status === "sent" && "Application received"}
            {status === "error" && "Try again"}
          </button>

          <p className="mt-3 text-center text-[11px] text-slate-500">
            For urgent opportunities you can also email support@petwash.co.il
            with additional documents or links.
          </p>
        </form>
      </main>
    </div>
  );
};

/* =========================================================
 * 5. SIMPLE ROUTES WRAPPER (for wouter)
 *    Your dev can import and use inside App.tsx
 * =======================================================*/

export const PetWashTalentRoutes: React.FC<{ Router: any; Route: any }> = ({
  Router,
  Route,
}) => {
  // Example usage:
  // <Router>
  //   <PetWashTalentRoutes Router={Router} Route={Route} />
  // </Router>
  return (
    <>
      <Route path="/marketplace">
        <PetWashTalentMarketplacePage />
      </Route>
      <Route path="/join">
        <JoinAsContractorPage />
      </Route>
      {/* default route can be /marketplace */}
      <Route path="/">
        <PetWashTalentMarketplacePage />
      </Route>
    </>
  );
};

/* =========================================================
 * 6. QA HELPER
 *    Simple checks you can run in dev console or tests
 * =======================================================*/

export function runTalentMarketplaceQA() {
  const errors: string[] = [];

  // Every platform has at least one contractor
  PLATFORM_REGISTRY.filter((p) => p.isActive).forEach((p) => {
    const count = DEMO_CONTRACTORS.filter(
      (c) => c.platformId === p.id && c.isActive !== false
    ).length;
    if (count === 0) {
      errors.push(`Platform ${p.id} has no active contractors.`);
    }
  });

  // Unique contractor IDs
  const ids = new Set<string>();
  DEMO_CONTRACTORS.forEach((c) => {
    if (ids.has(c.id)) {
      errors.push(`Duplicate contractor id: ${c.id}`);
    }
    ids.add(c.id);
  });

  if (errors.length === 0) {
    // eslint-disable-next-line no-console
    console.log("Talent Marketplace QA: OK");
  } else {
    // eslint-disable-next-line no-console
    console.warn("Talent Marketplace QA issues:", errors);
  }

  return errors;
}