// PetWashTalentMarketplacePage - 7-platform unified marketplace
// Integrated from src/modules/platforms/
import { useState, type FC } from "react";

type PlatformId =
  | "hub"
  | "walk"
  | "sitter"
  | "transport"
  | "lostFound"
  | "hardware"
  | "enterprise";

interface PlatformConfig {
  id: PlatformId;
  shortName: string;
  fullName: string;
  tagLine: string;
  accent: string; // Tailwind class for accent color
  chipColor: string;
  description: string;
}

interface ContractorProfile {
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
}

const PLATFORM_CONFIG: PlatformConfig[] = [
  {
    id: "sitter",
    shortName: "Sitter",
    fullName: "The Sitter Suite",
    tagLine: "Hotel level pet sitting and house guardians.",
    accent: "border-rose-400 text-rose-500",
    chipColor: "bg-rose-50 text-rose-500",
    description:
      "Trusted sitters and house guardians who care for your pets, your plants and your property while you travel.",
  },
  {
    id: "walk",
    shortName: "Walk My Pet",
    fullName: "Walk My Pet",
    tagLine: "Premium dog walkers with live GPS.",
    accent: "border-emerald-400 text-emerald-500",
    chipColor: "bg-emerald-50 text-emerald-600",
    description:
      "City walkers and calm handlers who follow structured routes, send photos and keep your dog relaxed and happy.",
  },
  {
    id: "transport",
    shortName: "PetTrek",
    fullName: "PetTrek Transport",
    tagLine: "Uber style pet rides with live tracking.",
    accent: "border-indigo-400 text-indigo-500",
    chipColor: "bg-indigo-50 text-indigo-600",
    description:
      "Safe drivers and vehicles for vet visits, washes, airport trips and longer journeys.",
  },
  {
    id: "hub",
    shortName: "Wash Hub",
    fullName: "⁦Pet Wash™⁩ Hub Operators",
    tagLine: "Operators of premium organic wash hubs.",
    accent: "border-sky-400 text-sky-500",
    chipColor: "bg-sky-50 text-sky-600",
    description:
      "Local hub operators who run ⁦Pet Wash™⁩ stations with strict hygiene, maintenance and guest service standards.",
  },
  {
    id: "lostFound",
    shortName: "Paw Finder",
    fullName: "Paw Finder Community",
    tagLine: "Community heroes for lost and found pets.",
    accent: "border-amber-400 text-amber-500",
    chipColor: "bg-white text-amber-600",
    description:
      "Moderators and community leads who run local zones and help reunite pets with their families.",
  },
  {
    id: "hardware",
    shortName: "K9000",
    fullName: "K9000 Technicians",
    tagLine: "Engineers for smart wash hardware.",
    accent: "border-slate-500 text-slate-700",
    chipColor: "bg-slate-100 text-slate-700",
    description:
      "Technicians and field engineers who install, service and monitor K9000 machines and IoT hardware.",
  },
  {
    id: "enterprise",
    shortName: "Enterprise",
    fullName: "Enterprise Partners",
    tagLine: "Franchise and white label leaders.",
    accent: "border-orange-400 text-orange-500",
    chipColor: "bg-white text-orange-600",
    description:
      "Franchise owners and enterprise partners who operate ⁦Pet Wash™⁩ at city scale with full data and analytics.",
  },
];

// Demo profiles for all platforms
// In production, load this list from your Octopus Global Brain API
const PROFILES: ContractorProfile[] = [
  // Sitter Suite
  {
    id: "sitter1",
    platformId: "sitter",
    name: "April K.",
    title: "Luxury home sitter and house guardian",
    mainService: "Overnight boutique stays or full house sitting while you travel.",
    location: "Armadale, VIC · Australia",
    rating: 4.98,
    reviews: 126,
    priceFrom: "$145 per night",
    heroLabel: "7 star featured sitter",
    badges: ["House sitting", "Property care", "Senior pets"],
    specialties: ["Dogs up to 25kg", "Indoor cats", "Medication schedules"],
    imageUrl: "https://images.pexels.com/photos/4587995/pexels-photo-4587995.jpeg",
  },
  {
    id: "sitter2",
    platformId: "sitter",
    name: "Daniela R.",
    title: "Calm sitter for small dogs and cats",
    mainService: "Stays at your apartment and keeps your pets on their usual routine.",
    location: "Tel Aviv, Israel",
    rating: 4.95,
    reviews: 89,
    priceFrom: "$120 per night",
    heroLabel: "City stays",
    badges: ["Apartments", "Indoor only", "Daily photo updates"],
    specialties: ["Rescue pets", "Shy dogs", "Plant care"],
    imageUrl: "https://images.pexels.com/photos/7210275/pexels-photo-7210275.jpeg",
  },
  {
    id: "sitter3",
    platformId: "sitter",
    name: "James & Noor",
    title: "Couple sitters for larger homes",
    mainService: "House guardians for family homes and villas with multiple pets.",
    location: "Dubai, UAE",
    rating: 5,
    reviews: 54,
    priceFrom: "$220 per night",
    heroLabel: "Large homes",
    badges: ["Multiple pets", "Pools and gardens", "Airport transfers"],
    specialties: ["Big dogs", "Puppies", "Luxury properties"],
    imageUrl: "https://images.pexels.com/photos/5731912/pexels-photo-5731912.jpeg",
  },

  // Walk My Pet
  {
    id: "walk1",
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
    imageUrl: "https://images.pexels.com/photos/7214460/pexels-photo-7214460.jpeg",
  },
  {
    id: "walk2",
    platformId: "walk",
    name: "Maya L.",
    title: "Calm walker for small dogs",
    mainService: "Short calm walks and enrichment games for seniors and small breeds.",
    location: "Melbourne, Australia",
    rating: 4.94,
    reviews: 77,
    priceFrom: "$35 per walk",
    heroLabel: "Senior friendly",
    badges: ["Short routes", "Enrichment", "Gentle handling"],
    specialties: ["Senior dogs", "Tiny breeds", "Post surgery care"],
    imageUrl: "https://images.pexels.com/photos/4588065/pexels-photo-4588065.jpeg",
  },

  // PetTrek Transport
  {
    id: "transport1",
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
    imageUrl: "https://images.pexels.com/photos/7214463/pexels-photo-7214463.jpeg",
  },
  {
    id: "transport2",
    platformId: "transport",
    name: "Maxi Pet Chauffeur",
    title: "Comfort rides for anxious pets",
    mainService: "Single family only, soft harness options and soft music.",
    location: "Sydney, Australia",
    rating: 4.97,
    reviews: 38,
    priceFrom: "From $65 per ride",
    heroLabel: "Comfort rides",
    badges: ["Anxious pets", "One family only", "Door to door"],
    specialties: ["Rescue dogs", "Noise sensitive", "Short notice"],
    imageUrl: "https://images.pexels.com/photos/7210268/pexels-photo-7210268.jpeg",
  },

  // Wash Hub operators
  {
    id: "hub1",
    platformId: "hub",
    name: "⁦Pet Wash™⁩ Hub - Ramat Gan Park",
    title: "Outdoor wash hub with dual K9000 bays",
    mainService: "Organic shampoos, shade, lockers and integrated loyalty.",
    location: "Ramat Gan National Park, Israel",
    rating: 4.93,
    reviews: 112,
    priceFrom: "From $18 per wash",
    heroLabel: "Flagship hub",
    badges: ["Organic products", "Shade", "Self service"],
    specialties: ["Weekend families", "Big dogs", "Quick rinse"],
    imageUrl: "https://images.pexels.com/photos/5731864/pexels-photo-5731864.jpeg",
  },
  {
    id: "hub2",
    platformId: "hub",
    name: "⁦Pet Wash™⁩ Hub - Inner City",
    title: "High traffic city hub",
    mainService: "Fast in and out washes with digital receipts for busy owners.",
    location: "Melbourne CBD, Australia",
    rating: 4.9,
    reviews: 59,
    priceFrom: "From $19 per wash",
    heroLabel: "City hub",
    badges: ["Digital receipts", "Late hours", "Quick dry"],
    specialties: ["Office workers", "Short visits", "Back to back washes"],
    imageUrl: "https://images.pexels.com/photos/5731913/pexels-photo-5731913.jpeg",
  },

  // Paw Finder
  {
    id: "paw1",
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
    imageUrl: "https://images.pexels.com/photos/3299900/pexels-photo-3299900.jpeg",
  },
  {
    id: "paw2",
    platformId: "lostFound",
    name: "South Melbourne Paw Finder",
    title: "Lost and found volunteers",
    mainService: "Organises local groups and contact points near the beach.",
    location: "South Melbourne, Australia",
    rating: 4.96,
    reviews: 29,
    priceFrom: "Always free",
    heroLabel: "Beach zone",
    badges: ["Collar checks", "Local vets", "Microchip scan"],
    specialties: ["Dogs near beach", "Shared yards", "Apartments"],
    imageUrl: "https://images.pexels.com/photos/573552/pexels-photo-573552.jpeg",
  },

  // K9000 hardware technicians
  {
    id: "hw1",
    platformId: "hardware",
    name: "K9000 Service Israel",
    title: "Certified K9000 field technicians",
    mainService: "Install, calibrate and maintain ⁦Pet Wash™⁩ K9000 machines.",
    location: "Nationwide, Israel",
    rating: 4.9,
    reviews: 34,
    priceFrom: "Service plans on request",
    heroLabel: "Official service",
    badges: ["Installations", "Preventive maintenance", "Remote diagnostics"],
    specialties: ["Dual bays", "Outdoor installs", "Retrofit projects"],
    imageUrl: "https://images.pexels.com/photos/8960982/pexels-photo-8960982.jpeg",
  },
  {
    id: "hw2",
    platformId: "hardware",
    name: "K9000 Tech Melbourne",
    title: "Local hardware partner",
    mainService: "Supports airport and mall hubs with rapid response times.",
    location: "Victoria, Australia",
    rating: 4.95,
    reviews: 21,
    priceFrom: "Service plans on request",
    heroLabel: "Rapid response",
    badges: ["SLAs", "Spare parts", "Firmware updates"],
    specialties: ["Shopping centers", "High foot traffic", "Night works"],
    imageUrl: "https://images.pexels.com/photos/6872933/pexels-photo-6872933.jpeg",
  },

  // Enterprise partners
  {
    id: "ent1",
    platformId: "enterprise",
    name: "⁦Pet Wash™⁩ Tel Aviv Franchise",
    title: "City franchise partner",
    mainService: "Runs multiple hubs and transport fleets under one license.",
    location: "Tel Aviv, Israel",
    rating: 4.98,
    reviews: 17,
    priceFrom: "Enterprise terms",
    heroLabel: "City scale",
    badges: ["Multi site", "Fleet management", "Analytics"],
    specialties: ["Municipal partners", "Advertising", "High density areas"],
    imageUrl: "https://images.pexels.com/photos/3760067/pexels-photo-3760067.jpeg",
  },
  {
    id: "ent2",
    platformId: "enterprise",
    name: "GCC ⁦Pet Wash™⁩ Group",
    title: "Regional master franchise",
    mainService: "Expands ⁦Pet Wash™⁩ hubs across several countries in the region.",
    location: "GCC region",
    rating: 5,
    reviews: 9,
    priceFrom: "Enterprise terms",
    heroLabel: "Regional master",
    badges: ["Multi currency", "White label", "Data agreements"],
    specialties: ["Airports", "Malls", "Tourist zones"],
    imageUrl: "https://images.pexels.com/photos/258154/pexels-photo-258154.jpeg",
  },
];

const formatRating = (n: number) => n.toFixed(2);

// Card component for each contractor profile
function ContractorCard({
  profile,
  platform,
}: {
  profile: ContractorProfile;
  platform: PlatformConfig;
}) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_16px_50px_rgba(15,23,42,0.08)] transition hover:-translate-y-1 hover:shadow-[0_24px_80px_rgba(15,23,42,0.16)]">
      {/* Image */}
      <div className="relative h-52 w-full overflow-hidden">
        <img
          src={profile.imageUrl}
          alt={profile.name}
          className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/45 via-black/5 to-transparent" />
        <div className="absolute left-4 top-4 flex flex-col gap-2">
          {profile.heroLabel && (
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold bg-white/90 text-slate-900`}
            >
              {profile.heroLabel}
            </span>
          )}
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-medium bg-white/85 ${platform.accent}`}
          >
            {platform.shortName}
          </span>
        </div>
      </div>

      {/* Content */}
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
              className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] ${platform.chipColor} border border-slate-100`}
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

const PetWashTalentMarketplacePage: FC = () => {
  const [platformId, setPlatformId] = useState<PlatformId>("sitter");

  const platform = PLATFORM_CONFIG.find((p) => p.id === platformId)!;
  const profiles = PROFILES.filter((p) => p.platformId === platformId);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6 lg:px-8">
        {/* Top header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
              ⁦Pet Wash™⁩ Luxury Network
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
              Book trusted ⁦Pet Wash™⁩ partners
            </h1>
            <p className="mt-2 max-w-xl text-sm text-slate-600">
              ⁦Pet Wash™⁩ Luxury Marketplace, designed for 2026. All profiles
              are connected to the same ⁦Pet Wash™⁩ account and Octopus Global
              Brain. Clear ratings, clear prices, one login.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
              Banking level security · Luxury visual experience
            </span>
            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] text-slate-500 shadow-sm">
              One profile for owners across all platforms
            </span>
          </div>
        </header>

        {/* Platform tabs */}
        <nav className="mb-6 overflow-x-auto pb-1">
          <div className="inline-flex rounded-full bg-white p-1 shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
            {PLATFORM_CONFIG.map((p) => {
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

        {/* Platform description */}
        <section className="mb-6 rounded-3xl bg-white px-5 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)] border border-slate-100">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 ${platform.accent} bg-white`}
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
            {/* Filters placeholder */}
            <div className="flex flex-col gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center rounded-full bg-slate-50 px-3 py-1 shadow-sm">
                  ⭐ 4.9 average rating
                </span>
                <span className="hidden rounded-full bg-slate-50 px-3 py-1 shadow-sm sm:inline-flex">
                  Verified identity and phone
                </span>
              </div>
              <div className="flex gap-2">
                <div className="hidden flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] sm:flex">
                  🔍 Search by city or suburb (coming soon)
                </div>
                <div className="hidden items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] sm:flex">
                  Filter by price and rating (coming soon)
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Profiles grid */}
        <section>
          {profiles.length === 0 ? (
            <div className="rounded-3xl bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
              No profiles for this platform yet. They will appear here once
              your Octopus Global Brain syncs contractors.
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

        {/* Bottom note */}
        <section className="mt-10 text-center text-[11px] text-slate-500">
          All profiles are examples for visual layout only. In production this
          page will pull live contractors from the ⁦Pet Wash™⁩ backend and show
          real prices and availability in each city.
        </section>
      </main>
    </div>
  );
};

export default PetWashTalentMarketplacePage;