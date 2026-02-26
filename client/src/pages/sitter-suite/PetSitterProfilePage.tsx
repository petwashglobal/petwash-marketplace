// PetSitterProfilePage - ⁦Pet Wash™⁩ luxury sitter profile
// Integrated from src/modules/pet-sitter/
import { useState, type FC } from "react";
import { useLanguage } from "@/lib/languageStore";

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
  const { language } = useLanguage();
  const isHebrew = language === 'he';

  const activeServices =
    stayType === "sitterHome" ? servicesAtSitterHome : servicesAtOwnerHome;

  const formatRating = (value: number) => value.toFixed(1);

  return (
    <div className="min-h-screen bg-white text-gray-900">

      <main className="relative mx-auto max-w-6xl px-4 pb-24 pt-8 sm:px-6 lg:px-8">
        {/* Top breadcrumb */}
        <nav className="mb-4 text-xs text-gray-500">
          <span className="cursor-pointer hover:text-gray-700">
            PetWash
          </span>
          <span className="mx-1 text-gray-300">/</span>
          <span className="cursor-pointer hover:text-gray-700">
            {isHebrew ? 'שמרטפים' : 'Pet sitters'}
          </span>
          <span className="mx-1 text-gray-300">/</span>
          <span className="text-gray-700">{locationLabel}</span>
        </nav>

        {/* Hero header */}
        <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
              {sitterName}
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              {sitterTagline}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-600">
              <div className="flex items-center gap-1.5">
                <span className="text-yellow-500">
                  ★
                </span>
                <span className="font-medium">
                  {formatRating(ratingAverage)}
                </span>
                <span className="text-gray-400">
                  ({ratingCount} {isHebrew ? 'ביקורות' : 'reviews'})
                </span>
              </div>
              <span className="h-3 w-px bg-gray-200" />
              <span className="rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                {isHebrew ? 'מארח 7 כוכבים מהימן' : 'Trusted 7-star host'}
              </span>
              <span className="h-3 w-px bg-gray-200" />
              <span>{locationLabel}</span>
            </div>
          </div>

          {/* Price summary */}
          <div className="mt-2 flex flex-col items-start gap-1 text-sm text-gray-700 sm:items-end">
            <div className="flex items-baseline gap-1">
              <span className="text-lg font-semibold">
                {nightlyPriceFrom}
              </span>
              <span className="text-xs text-gray-500">
                {isHebrew ? 'ללילה · חיית המחמד אצל המארח' : 'per night · pets stay at sitter home'}
              </span>
            </div>
            {dayVisitPriceFrom && (
              <div className="flex items-baseline gap-1 text-xs text-gray-600">
                <span className="text-gray-700">
                  {dayVisitPriceFrom}
                </span>
                <span className="text-gray-400">
                  {isHebrew ? 'ביקור יום בביתך' : 'day visit at your home'}
                </span>
              </div>
            )}
          </div>
        </header>

        {/* Hero gallery */}
        <section className="mb-10 grid gap-3 sm:grid-cols-3 sm:grid-rows-2">
          {/* Main image */}
          <div className="relative sm:col-span-2 sm:row-span-2">
            <div className="group h-64 overflow-hidden rounded-3xl border border-gray-200 bg-gray-100 sm:h-full">
              <img
                src={heroImageUrl}
                alt={`${sitterName} with pets`}
                className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
              />
            </div>
            <div className="pointer-events-none absolute inset-0 rounded-3xl ring-1 ring-gray-200" />
            <div className="absolute bottom-4 start-4 flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs text-gray-800 backdrop-blur">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs font-semibold text-white">
                PW
              </span>
              <span>{isHebrew ? 'מארח מאומת רשמית ⁦Pet Wash™⁩' : 'Official ⁦Pet Wash™⁩ verified host'}</span>
            </div>
          </div>

          {/* Secondary images */}
          {galleryImages.slice(0, 3).map((src, index) => (
            <div
              key={index}
              className="group relative h-28 overflow-hidden rounded-2xl border border-gray-200 bg-gray-100 sm:h-full"
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
              <h2 className="text-base font-semibold tracking-tight text-gray-900">
                {isHebrew ? 'אודות המארח' : 'About this host'}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                {isHebrew
                  ? `ברוכים הבאים לרמה אחרת של טיפול בחיות מחמד. ${sitterName} מציע/ה סביבה ביתית פרטית ובוטיקית עם תשומת לב ברמה מלונאית. עם למעלה מ-`
                  : `Welcome to a different level of pet care. ${sitterName} offers a private, boutique home environment with hotel style attention to detail. With over `}
                <span className="font-semibold">
                  {yearsExperience} {isHebrew ? 'שנות' : 'years'}
                </span>{" "}
                {isHebrew
                  ? 'ניסיון מעשי, חיות המחמד שלכם מטופלות כאורחים מכובדים, לא סתם הזמנה ביומן.'
                  : 'of hands-on experience, your pets are treated as honored guests, not just bookings in a calendar.'}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                {isHebrew
                  ? 'בין אם חיית המחמד שלכם נשארת בבית המארח או שהשמרטף מגיע לביתכם בזמן שאתם נוסעים, כל שהות כוללת שגרה מותאמת אישית, אנרגיה רגועה ותשומת לב מתמדת. אותו אדם שמקבל אתכם הוא זה שמטפל בחיית המחמד, משקה צמחים, אוסף חבילות ושומר על הבית מאוכלס בזמן שאתם בחו״ל.'
                  : 'Whether your pet stays in the host home or your sitter moves into your home while you travel, every stay includes personalised routines, calm energy, and constant attention. The same person who greets you is the one who cares for your pet, waters your plants, collects your parcels and keeps your home feeling lived in while you are away.'}
              </p>

              <dl className="mt-4 grid gap-4 text-xs text-gray-700 sm:grid-cols-3">
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <dt className="text-gray-500">{isHebrew ? 'ניסיון' : 'Experience'}</dt>
                  <dd className="mt-1 font-medium">
                    {yearsExperience}+ {isHebrew ? 'שנים' : 'years'}
                  </dd>
                  <dd className="mt-0.5 text-[11px] text-gray-500">
                    {isHebrew ? 'מהימן על ידי משפחות חוזרות' : 'Trusted by repeat families'}
                  </dd>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <dt className="text-gray-500">{isHebrew ? 'אורחים מתקבלים' : 'Accepted guests'}</dt>
                  <dd className="mt-1 font-medium">
                    {acceptedPetsSummary}
                  </dd>
                  <dd className="mt-0.5 text-[11px] text-gray-500">
                    {isHebrew ? `עד ${maxPetsPerBooking} חיות מחמד להזמנה` : `Up to ${maxPetsPerBooking} pets per booking`}
                  </dd>
                </div>
                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <dt className="text-gray-500">{isHebrew ? 'שפות' : 'Languages'}</dt>
                  <dd className="mt-1 font-medium">
                    {languages.join(" · ")}
                  </dd>
                  <dd className="mt-0.5 text-[11px] text-gray-500">
                    {responseTimeLabel}
                  </dd>
                </div>
              </dl>
            </section>

            {/* Why guests trust this sitter */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-gray-900">
                {isHebrew ? 'למה אורחי ⁦Pet Wash™⁩ מזמינים שמרטף זה' : 'Why ⁦Pet Wash™⁩ guests book this sitter'}
              </h2>
              <div className="mt-3 grid gap-3 text-sm text-gray-700 sm:grid-cols-2">
                {highlightBullets.map((item, index) => (
                  <div
                    key={index}
                    className="flex gap-3 rounded-2xl border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-xs text-emerald-600">
                      ✓
                    </div>
                    <p className="text-xs leading-relaxed">{item}</p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-gray-600">
                {verifiedBadges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    {badge}
                  </span>
                ))}
              </div>
            </section>

            {/* Services selector */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-gray-900">
                {isHebrew ? 'שירותים ומחירים' : 'Services and pricing'}
              </h2>

              <div className="mt-3 inline-flex rounded-full bg-gray-100 p-1 text-xs text-gray-700">
                <button
                  type="button"
                  onClick={() => setStayType("sitterHome")}
                  className={`flex-1 rounded-full px-4 py-2 transition ${
                    stayType === "sitterHome"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {isHebrew ? 'חיית המחמד בבית המארח' : 'Pet stays at host home'}
                </button>
                <button
                  type="button"
                  onClick={() => setStayType("ownerHome")}
                  className={`flex-1 rounded-full px-4 py-2 transition ${
                    stayType === "ownerHome"
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-500 hover:text-gray-900"
                  }`}
                >
                  {isHebrew ? 'המארח בביתכם' : 'Host stays at your home'}
                </button>
              </div>

              <div className="mt-4 grid gap-3 text-xs text-gray-800">
                {activeServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-start justify-between rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3"
                  >
                    <div className="max-w-[70%]">
                      <div className="font-medium">{service.label}</div>
                      {service.description && (
                        <p className="mt-1 text-[11px] text-gray-500">
                          {service.description}
                        </p>
                      )}
                    </div>
                    <div className="text-end">
                      <div className="text-xs text-gray-500">
                        {isHebrew ? 'החל מ-' : 'from'}
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
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {isHebrew ? 'תוספות אופציונליות' : 'Optional add ons'}
                  </h3>
                  <div className="mt-3 grid gap-3 text-xs text-gray-800 sm:grid-cols-2">
                    {addOns.map((addOn) => (
                      <label
                        key={addOn.id}
                        className="flex cursor-pointer items-start gap-2 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3 hover:border-emerald-500/60"
                      >
                        <input
                          type="checkbox"
                          className="mt-0.5 h-4 w-4 rounded border-gray-300 bg-white text-emerald-500 focus:ring-emerald-500"
                          disabled
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {addOn.label}
                            </span>
                            {addOn.priceFrom && (
                              <span className="text-[11px] text-gray-500">
                                {isHebrew ? `החל מ-${addOn.priceFrom}` : `from ${addOn.priceFrom}`}
                              </span>
                            )}
                          </div>
                          {addOn.description && (
                            <p className="mt-1 text-[11px] text-gray-500">
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
              <h2 className="text-base font-semibold tracking-tight text-gray-900">
                {isHebrew ? 'סביבה ביתית ובטיחות' : 'Home environment and safety'}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                {homeSummary}
              </p>
              <ul className="mt-3 grid gap-2 text-xs text-gray-700 sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isHebrew ? 'חיות המחמד ישנות בתוך הבית על מיטות פרימיום או בהתקנה המועדפת עליכם.' : 'Pets sleep indoors on premium beds or in your preferred setup.'}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isHebrew ? 'שגרת כניסה ויציאה מאובטחת, בדיקה כפולה של דלתות ושערים.' : 'Secure entry and exit routines, double check doors and gates.'}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isHebrew ? 'עדכונים יומיים עם תמונות וסרטונים קצרים.' : 'Daily updates with photos and short videos.'}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isHebrew ? 'טיפול בסיסי בבית בזמן שאתם נוסעים. אורות, תריסים, דואר ופחי אשפה.' : 'Basic home care while you travel. Lights, blinds, mail and bins.'}
                </li>
              </ul>
            </section>

            {/* House sitting extras */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-gray-900">
                {isHebrew ? 'תוספות שמרטפות בית בזמן שאתם בחו״ל' : 'House sitting extras while you are away'}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-gray-700">
                {isHebrew
                  ? 'כשאתם בוחרים שמרטפות בית, השמרטף הופך לשומר הבית שלכם. הוא מטפל בכל חיות המחמד בבית, שומר על המקום מאובטח ומאוכלס, ופועל לפי ההוראות שלכם ברמת דיוק מלונאית.'
                  : 'When you choose house sitting, your sitter becomes your in-residence guardian. They care for all pets in the home, keep your space secure and lived in, and follow your instructions with hotel level precision.'}
              </p>
              <ul className="mt-3 grid gap-2 text-xs text-gray-700 sm:grid-cols-2">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isHebrew ? 'השקיית צמחים פנימיים וחיצוניים לפי לוח הזמנים שלכם.' : 'Water indoor and outdoor plants on your schedule.'}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isHebrew ? 'הכנסת חבילות ושמירה על אזור הכניסה נקי.' : 'Bring parcels inside and keep entrance area clean.'}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isHebrew ? 'הדלקת אורות ותריסים כדי לדמות פעילות רגילה.' : 'Switch lights and blinds to simulate normal activity.'}
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  {isHebrew ? 'בדיקת אבטחה יומית של דלתות, חלונות ואזורים חיצוניים.' : 'Daily security check of doors, windows and outdoor areas.'}
                </li>
              </ul>
            </section>

            {/* Reviews */}
            <section>
              <h2 className="text-base font-semibold tracking-tight text-gray-900">
                {isHebrew ? 'ביקורות אורחים' : 'Guest reviews'}
              </h2>
              <div className="mt-3 flex items-center gap-2 text-sm text-gray-800">
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  ★ {formatRating(ratingAverage)} {isHebrew ? 'ממוצע' : 'average'}
                </span>
                <span className="text-xs text-gray-500">
                  {isHebrew ? `מבוסס על ${ratingCount} שהיות שהוזמנו דרך PetWash` : `Based on ${ratingCount} stays booked through PetWash`}
                </span>
              </div>
              <div className="mt-4 grid gap-3 text-xs text-gray-800 sm:grid-cols-2">
                {reviews.slice(0, 4).map((review) => (
                  <article
                    key={review.id}
                    className="flex flex-col rounded-2xl border border-gray-200 bg-gray-50 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <h3 className="text-xs font-semibold">
                          {review.name}
                        </h3>
                        <p className="text-[11px] text-gray-500">
                          {review.date}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-yellow-500">
                        <span>★</span>
                        <span>{formatRating(review.rating)}</span>
                      </div>
                    </div>
                    <p className="mt-2 line-clamp-5 text-[11px] leading-relaxed text-gray-700">
                      {review.text}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </div>

          {/* Right column - booking card */}
          <aside className="lg:sticky lg:top-20">
            <div className="rounded-3xl border border-gray-200 bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.08)] backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-500">
                    {isHebrew ? 'החל מ-' : 'From'}
                  </div>
                  <div className="text-lg font-semibold text-gray-900">
                    {nightlyPriceFrom}
                    <span className="ms-1 text-xs font-normal text-gray-500">
                      {isHebrew ? 'ללילה' : 'per night'}
                    </span>
                  </div>
                </div>
                <div className="rounded-full border border-emerald-500/40 bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700">
                  {isHebrew ? 'מארח 7 כוכבים · מאומת ⁦Pet Wash™⁩' : '7-star host · ⁦Pet Wash™⁩ verified'}
                </div>
              </div>

              {/* Stay type selector */}
              <div className="mt-4 text-xs text-gray-800">
                <label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500">
                  {isHebrew ? 'סגנון שהות' : 'Stay style'}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStayType("sitterHome")}
                    className={`rounded-2xl border px-3 py-2 text-start text-[11px] transition ${
                      stayType === "sitterHome"
                        ? "border-emerald-500 bg-white text-gray-900 shadow-sm"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    <div className="font-medium">
                      {isHebrew ? 'חיית מחמד בבית המארח' : 'Pet at host home'}
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {isHebrew ? 'שהות בוטיקית בנכס השמרטף' : 'Boutique stay at sitter property'}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStayType("ownerHome")}
                    className={`rounded-2xl border px-3 py-2 text-start text-[11px] transition ${
                      stayType === "ownerHome"
                        ? "border-emerald-500 bg-white text-gray-900 shadow-sm"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:border-gray-400"
                    }`}
                  >
                    <div className="font-medium">
                      {isHebrew ? 'מארח בביתכם' : 'Host in your home'}
                    </div>
                    <div className="mt-0.5 text-[10px] text-gray-500">
                      {isHebrew ? 'שמרטפות בית וטיפול בנכס' : 'House sitting plus property care'}
                    </div>
                  </button>
                </div>
              </div>

              {/* Placeholder booking controls - dev can replace with real form/datepicker */}
              <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-gray-200 text-xs text-gray-800">
                <div className="flex flex-col gap-1 bg-gray-50 px-3 py-2.5">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    {isHebrew ? 'כניסה' : 'Check in'}
                  </span>
                  <span className="text-[11px] text-gray-600">
                    {isHebrew ? 'הוספת תאריך' : 'Add date'}
                  </span>
                </div>
                <div className="flex flex-col gap-1 bg-gray-50 px-3 py-2.5">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    {isHebrew ? 'יציאה' : 'Check out'}
                  </span>
                  <span className="text-[11px] text-gray-600">
                    {isHebrew ? 'הוספת תאריך' : 'Add date'}
                  </span>
                </div>
                <div className="col-span-2 flex flex-col gap-1 bg-gray-50 px-3 py-2.5">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400">
                    {isHebrew ? 'אורחים' : 'Guests'}
                  </span>
                  <span className="text-[11px] text-gray-600">
                    {isHebrew ? 'חיות מחמד ופרטי הבית' : 'Pets and home details'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                className="mt-4 flex w-full items-center justify-center rounded-2xl bg-emerald-400 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_40px_rgba(16,185,129,0.3)] hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-white"
              >
                {isHebrew ? 'בקשת שהות יוקרתית' : 'Request luxury stay'}
              </button>

              <p className="mt-2 text-center text-[11px] text-gray-500">
                {isHebrew
                  ? 'ללא התחייבות. הבקשה שלכם מאושרת רק כאשר השמרטף מקבל אותה באפליקציית ⁦Pet Wash™⁩.'
                  : 'No commitment yet. Your request is only confirmed when the sitter accepts in the ⁦Pet Wash™⁩ app.'}
              </p>

              {/* Price breakdown placeholder */}
              <div className="mt-4 space-y-1 border-t border-gray-200 pt-3 text-[11px] text-gray-600">
                <div className="flex items-center justify-between">
                  <span>{isHebrew ? 'תעריף ללילה (לדוגמה)' : 'Nightly rate (example)'}</span>
                  <span>{nightlyPriceFrom}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>{isHebrew ? 'עמלת פלטפורמה והגנה ⁦Pet Wash™⁩' : '⁦Pet Wash™⁩ platform & protection fee'}</span>
                  <span>{isHebrew ? 'מחושב בהזמנה' : 'Calculated at booking'}</span>
                </div>
                <div className="flex items-center justify-between text-gray-900">
                  <span className="font-semibold">
                    {isHebrew ? 'הערכת סכום כולל' : 'Total estimate'}
                  </span>
                  <span className="font-semibold">
                    {isHebrew ? 'מוצג לפני התשלום' : 'Shown before you pay'}
                  </span>
                </div>
              </div>

              {/* Safety copy */}
              <div className="mt-4 rounded-2xl bg-gray-50 p-3 text-[11px] text-gray-600">
                <div className="mb-1 flex items-center gap-1.5 text-gray-800">
                  <span className="text-emerald-500">⛑</span>
                  <span className="font-semibold">
                    {isHebrew ? 'בטיחות ושקט נפשי' : 'Safety and peace of mind'}
                  </span>
                </div>
                <p className="leading-relaxed">
                  {isHebrew
                    ? 'כל ההזמנות דרך ⁦Pet Wash™⁩ כוללות תשלומים מאובטחים, פרופילי שמרטפים מאומתים ותמיכה אם משהו לא הולך לפי התוכנית.'
                    : 'All bookings through ⁦Pet Wash™⁩ include secure payments, verified sitter profiles and support if something does not go to plan.'}
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
