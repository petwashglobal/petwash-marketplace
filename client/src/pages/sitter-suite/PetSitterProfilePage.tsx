// PetSitterProfilePage - ⁦Pet Wash™⁩ luxury sitter profile
// Integrated from src/modules/pet-sitter/
import { useState, type FC } from "react";

type StayType = "sitterHome" | "ownerHome";

interface ServiceOption {
  id: string;
  label: string;
  description?: string;
  priceFrom: string;
}

interface AddOnOption {
  id: string;
  label: string;
  description?: string;
  priceFrom?: string;
}

interface Review {
  id: string;
  name: string;
  date: string;
  rating: number;
  text: string;
}

interface PetSitterProfileProps {
  sitterName: string;
  sitterTagline: string;
  locationLabel: string;
  ratingAverage: number;
  ratingCount: number;
  nightlyPriceFrom: string;
  dayVisitPriceFrom?: string;
  heroImageUrl: string;
  galleryImages: string[];
  servicesAtSitterHome: ServiceOption[];
  servicesAtOwnerHome: ServiceOption[];
  addOns: AddOnOption[];
  reviews: Review[];
  // Profile info
  yearsExperience: number;
  acceptedPetsSummary: string;
  maxPetsPerBooking: number;
  homeSummary: string;
  highlightBullets: string[];
  languages: string[];
  responseTimeLabel: string;
  verifiedBadges: string[];
}

/**
 * Luxury 7-star pet sitter profile page.
 * Uses Tailwind CSS only.
 * Developer: wire props from your backend or API.
 */
const PetSitterProfilePage: FC<PetSitterProfileProps> = (props) => {
  const {
    sitterName,
    sitterTagline,
    locationLabel,
    ratingAverage,
    ratingCount,
    nightlyPriceFrom,
    dayVisitPriceFrom,
    heroImageUrl,
    galleryImages,
    servicesAtSitterHome,
    servicesAtOwnerHome,
    addOns,
    reviews,
    yearsExperience,
    acceptedPetsSummary,
    maxPetsPerBooking,
    homeSummary,
    highlightBullets,
    languages,
    responseTimeLabel,
    verifiedBadges,
  } = props;

  const [stayType, setStayType] = useState<StayType>("sitterHome");

  const activeServices =
    stayType === "sitterHome" ? servicesAtSitterHome : servicesAtOwnerHome;

  const formatRating = (value: number) => value.toFixed(1);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      {/* Page background gradient */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-black opacity-90" />

      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        {/* Top breadcrumb */}
        <nav className="mb-4 text-xs text-slate-400">
          <span className="cursor-pointer hover:text-slate-200">
            PetWash
          </span>
          <span className="mx-1 text-slate-600">/</span>
          <span className="cursor-pointer hover:text-slate-200">
            Pet sitters
          </span>
          <span className="mx-1 text-slate-600">/</span>
          <span className="text-slate-200">{locationLabel}</span>
        </nav>

        {/* Hero header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              {sitterName}
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {sitterTagline}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <span className="text-yellow-300">
                  ★
                </span>
                <span className="font-medium">
                  {formatRating(ratingAverage)}
                </span>
                <span className="text-slate-500">
                  ({ratingCount} reviews)
                </span>
              </div>
              <span className="h-3 w-px bg-slate-700" />
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                Trusted 7-star host
              </span>
              <span className="h-3 w-px bg-slate-700" />
              <span>{locationLabel}</span>
            </div>
          </div>

          {/* Price summary */}
          <div className="mt-2 flex flex-col items-start gap-1 text-sm text-slate-200 sm:items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold">
                {nightlyPriceFrom}
              </span>
              <span className="text-xs text-slate-400">
                per night · pets stay at sitter home
              </span>
            </div>
            {dayVisitPriceFrom && (
              <div className="flex items-baseline gap-1 text-xs text-slate-300">
                <span className="text-slate-200">
                  {dayVisitPriceFrom}
                </span>
                <span className="text-slate-500">
                  day visit at your home
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Hero gallery */}
        <section className="mb-10 grid gap-3 sm:grid-cols-3 sm:grid-rows-2">
          {/* Main image */}
          <div className="relative sm:col-span-2 sm:row-span-2">
            <div className="group h-64 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 sm:h-full">
              <img
                src={heroImageUrl}
                alt={`${sitterName} with pets`}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-white/5" />
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-slate-100 backdrop-blur">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-black">
                PW
              </span>
              <span>Official PetWash verified host</span>
            </div>
          </div>

          {/* Secondary images */}
          {galleryImages.slice(0, 3).map((src, index) => (
            <div
              key={index}
              className="group relative h-28 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 sm:h-full"
            >
              <img
                src={src}
                alt={`Gallery ${index + 1}`}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
            </div>
          ))}
        </section>

        {/* Main layout */}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.6fr),minmax(0,1fr)]">
          {/* Left column - content */}
          <div className="space-y-10">
            {/* About host */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                About this host
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                Welcome to a different level of pet care. {sitterName} offers
                a private, boutique home environment with hotel style attention
                to detail. With over{" "}
                <span className="font-semibold">
                  {yearsExperience} years
                </span>{" "}
                of hands-on experience, your pets are treated as honored guests,
                not just bookings in a calendar.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                Whether your pet stays in the host home or your sitter moves
                into your home while you travel, every stay includes
                personalised routines, calm energy, and constant attention. The
                same person who greets you is the one who cares for your pet,
                waters your plants, collects your parcels and keeps your home
                feeling lived in while you are away.
              </p>

              <dl className="mt-4 grid gap-4 text-xs text-slate-200 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <dt className="text-slate-400">Experience</dt>
                  <dd className="mt-1 font-medium">
                    {yearsExperience}+ years
                  </dd>
                  <dd className="mt-0.5 text-[11px] text-slate-400">
                    Trusted by repeat families
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <dt className="text-slate-400">Accepted guests</dt>
                  <dd className="mt-1 font-medium">
                    {acceptedPetsSummary}
                  </dd>
                  <dd className="mt-0.5 text-[11px] text-slate-400">
                    Up to {maxPetsPerBooking} pets per booking
                  </dd>
                </div>
                <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
                  <dt className="text-slate-400">Languages</dt>
                  <dd className="mt-1 font-medium">
                    {languages.join(" · ")}
                  </dd>
                  <dd className="mt-0.5 text-[11px] text-slate-400">
                    {responseTimeLabel}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Why guests trust this sitter */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                Why PetWash guests book this sitter
              </h2>
              <div className="mt-3 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                {highlightBullets.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 p-3"
                  >
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/15 text-xs text-emerald-300">
                      ✓
                    </div>
                    <p className="text-xs leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-slate-300">
                {verifiedBadges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/80 px-3 py-1"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {badge}
                  </span>
                ))}
              </div>
            </section>

            {/* Services selector */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                Services and pricing
              </h2>

              <div className="mt-3 inline-flex rounded-full bg-slate-900/80 p-1 text-xs text-slate-200">
                <button
                  type="button"
                  onClick={() => setStayType("sitterHome")}
                  className={`flex-1 rounded-full px-4 py-2 transition ${
                    stayType === "sitterHome"
                      ? "bg-slate-50 text-slate-900 shadow-sm"
                      : "text-slate-300 hover:text-slate-50"
                  }`}
                >
                  Pet stays at host home
                </button>
                <button
                  type="button"
                  onClick={() => setStayType("ownerHome")}
                  className={`flex-1 rounded-full px-4 py-2 transition ${
                    stayType === "ownerHome"
                      ? "bg-slate-50 text-slate-900 shadow-sm"
                      : "text-slate-300 hover:text-slate-50"
                  }`}
                >
                  Host stays at your home
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-xs text-slate-100">
                {activeServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-start justify-between rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-3"
                  >
                    <div className="max-w-[70%]">
                      <div className="font-medium">{service.label}</div>
                      {service.description && (
                        <p className="mt-1 text-[11px] text-slate-400">
                          {service.description}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-300">
                        from
                      </div>
                      <div className="text-sm font-semibold">
                        {service.priceFrom}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {addOns.length > 0 && (
                <div className="mt-5">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Optional add ons
                  </h3>
                  <div className="mt-3 grid gap-3 text-xs text-slate-100 sm:grid-cols-2">
                    {addOns.map((addOn) => (
                      <label
                        key={addOn.id}
                        className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-800 bg-slate-900/70 px-3 py-3 hover:border-emerald-500/60"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                          disabled
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {addOn.label}
                            </span>
                            {addOn.priceFrom && (
                              <span className="text-[11px] text-slate-300">
                                from {addOn.priceFrom}
                              </span>
                            )}
                          </div>
                          {addOn.description && (
                            <p className="mt-1 text-[11px] text-slate-400">
                              {addOn.description}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* Home and safety */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                Home environment and safety
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                {homeSummary}
              </p>
              <ul className="mt-3 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Pets sleep indoors on premium beds or in your preferred setup.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Secure entry and exit routines, double check doors and gates.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Daily updates with photos and short videos.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Basic home care while you travel. Lights, blinds, mail and bins.
                </li>
              </ul>
            </section>

            {/* House sitting extras */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                House sitting extras while you are away
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-slate-200">
                When you choose house sitting, your sitter becomes your
                in-residence guardian. They care for all pets in the home, keep
                your space secure and lived in, and follow your instructions
                with hotel level precision.
              </p>
              <ul className="mt-3 grid gap-2 text-xs text-slate-200 sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Water indoor and outdoor plants on your schedule.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Bring parcels inside and keep entrance area clean.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Switch lights and blinds to simulate normal activity.
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Daily security check of doors, windows and outdoor areas.
                </li>
              </ul>
            </section>

            {/* Reviews */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-slate-50">
                Guest reviews
              </h2>
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-100">
                <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-300">
                  ★ {formatRating(ratingAverage)} average
                </span>
                <span className="text-xs text-slate-400">
                  Based on {ratingCount} stays booked through PetWash
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-xs text-slate-100 sm:grid-cols-2">
                {reviews.slice(0, 4).map((review) => (
                  <article
                    key={review.id}
                    className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/70 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold">
                          {review.name}
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          {review.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-yellow-300">
                        <span>★</span>
                        <span>{formatRating(review.rating)}</span>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-5 text-[11px] leading-relaxed text-slate-200">
                      {review.text}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Right column - booking card */}
          <aside className="lg:sticky lg:top-20">
            <div className="rounded-3xl border border-slate-800 bg-slate-950/90 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.7)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-slate-400">
                    From
                  </div>
                  <div className="text-lg font-semibold text-slate-50">
                    {nightlyPriceFrom}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      per night
                    </span>
                  </div>
                </div>
                <div className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-200">
                  7-star host · PetWash verified
                </div>
              </div>

              {/* Stay type selector */}
              <div className="mt-4 text-xs text-slate-100">
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-slate-400">
                  Stay style
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStayType("sitterHome")}
                    className={`rounded-2xl border px-3 py-2 text-left text-[11px] transition ${
                      stayType === "sitterHome"
                        ? "border-emerald-500 bg-slate-900 text-slate-50 shadow-sm"
                        : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <div className="font-medium">
                      Pet at host home
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      Boutique stay at sitter property
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStayType("ownerHome")}
                    className={`rounded-2xl border px-3 py-2 text-left text-[11px] transition ${
                      stayType === "ownerHome"
                        ? "border-emerald-500 bg-slate-900 text-slate-50 shadow-sm"
                        : "border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500"
                    }`}
                  >
                    <div className="font-medium">
                      Host in your home
                    </div>
                    <div className="mt-0.5 text-[10px] text-slate-400">
                      House sitting plus property care
                    </div>
                  </button>
                </div>
              </div>

              {/* Placeholder booking controls - dev can replace with real form/datepicker */}
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-slate-800 text-xs text-slate-100">
                <div className="flex flex-col gap-1 bg-slate-950 px-3 py-2.5">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    Check in
                  </span>
                  <span className="text-[11px] text-slate-300">
                    Add date
                  </span>
                </div>
                <div className="flex flex-col gap-1 bg-slate-950 px-3 py-2.5">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    Check out
                  </span>
                  <span className="text-[11px] text-slate-300">
                    Add date
                  </span>
                </div>
                <div className="col-span-2 flex flex-col gap-1 bg-slate-950 px-3 py-2.5">
                  <span className="text-[10px] uppercase tracking-wide text-slate-500">
                    Guests
                  </span>
                  <span className="text-[11px] text-slate-300">
                    Pets and home details
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_40px_rgba(16,185,129,0.5)] hover:bg-emerald-300 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-slate-950"
              >
                Request luxury stay
              </button>

              <p className="mt-2 text-center text-[11px] text-slate-400">
                No commitment yet. Your request is only confirmed when
                the sitter accepts in the PetWash app.
              </p>

              {/* Price breakdown placeholder */}
              <div className="mt-4 space-y-1 border-t border-slate-800 pt-3 text-[11px] text-slate-300">
                <div className="flex items-center justify-between">
                  <span>Nightly rate (example)</span>
                  <span>{nightlyPriceFrom}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>PetWash platform & protection fee</span>
                  <span>Calculated at booking</span>
                </div>
                <div className="flex items-center justify-between text-slate-50">
                  <span className="font-semibold">
                    Total estimate
                  </span>
                  <span className="font-semibold">
                    Shown before you pay
                  </span>
                </div>
              </div>

              {/* Safety copy */}
              <div className="mt-4 rounded-2xl bg-slate-900/80 p-3 text-[11px] text-slate-300">
                <div className="mb-1 flex items-center gap-1.5 text-slate-100">
                  <span className="text-emerald-300">⛑</span>
                  <span className="font-semibold">
                    Safety and peace of mind
                  </span>
                </div>
                <p className="leading-relaxed">
                  All bookings through PetWash include secure payments,
                  verified sitter profiles and support if something does not
                  go to plan.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
};

export default PetSitterProfilePage;