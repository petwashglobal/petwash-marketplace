/**
 * Locations — live station directory.
 *
 * Replaces the hardcoded demo list (3 invented addresses + fake phone
 * numbers) that shipped here previously: customers could navigate to
 * streets where no station exists. This page now renders ONLY what
 * GET /api/public/stations returns from pet_wash_stations, with an honest
 * empty state when no stations are listed yet.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from "@/components/ui/button";
import { MapPin, Navigation, Clock, Waves, Loader2, Accessibility, Car } from "lucide-react";
import { useSEO, pageSEO, injectStructuredData, generateBreadcrumbSchema } from '@/lib/seo';
import { getApiUrl } from '@/lib/apiConfig';
import { logger } from '@/lib/logger';
import waldStationPhoto from '@assets/wald_kfarsaba_station.jpg';

// AEO/GEO — visible FAQ mirrored 1:1 into FAQPage JSON-LD so answer engines
// (ChatGPT/Claude/Perplexity) can lift a factual sentence verbatim. Truthful,
// legal-safe (no guaranteed/medical claims); price ₪55 incl VAT per CEO 2026-07-09.
const STATION_FAQ: { qHe: string; qEn: string; aHe: string; aEn: string }[] = [
  {
    qHe: 'כמה עולה שטיפת כלב בשירות עצמי?',
    qEn: 'How much is a self-service dog wash?',
    aHe: 'שטיפה עצמית סטנדרטית עולה ₪55 (כולל מע״מ).',
    aEn: 'A standard self-service wash is ₪55 (VAT included).',
  },
  {
    qHe: 'איפה אפשר לשטוף כלב בכפר סבא?',
    qEn: 'Where can I wash my dog in Kfar Saba?',
    aHe: 'בעמדת ⁦PetWash™⁩ בפארק יצחק ולד, כפר סבא — עמדת שטיפה עצמית ⁦K9000⁩, פתוחה עכשיו.',
    aEn: 'At the PetWash™ station in Isaac Wald Park, Kfar Saba — a self-service K9000 bay, open now.',
  },
  {
    qHe: 'איך עובדת עמדת השטיפה?',
    qEn: 'How does the wash station work?',
    aHe: 'בוחרים תוכנית, מכניסים את הכלב לעמדה, ומשתמשים בשמפו, מים חמים וייבוש — הכל בשירות עצמי, בלי תור.',
    aEn: 'Pick a program, place your dog in the bay, then use shampoo, warm water and drying — all self-service, no queue.',
  },
  {
    qHe: 'האם זה מתאים לכלבים גדולים?',
    qEn: 'Is it suitable for large dogs?',
    aHe: 'כן, עמדת ⁦K9000⁩ מתאימה לכלבים בגדלים שונים.',
    aEn: 'Yes, the K9000 bay fits dogs of different sizes.',
  },
  {
    qHe: 'אילו אמצעי תשלום מתקבלים?',
    qEn: 'What payment methods are accepted?',
    aHe: 'תשלום בכרטיס אשראי בעמדה, ולחברי מועדון גם דרך אפליקציית ⁦PetWash™⁩.',
    aEn: 'Credit card at the station, and members can also pay via the PetWash™ app.',
  },
];

export interface PublicStation {
  stationCode: string;
  stationName: string;
  address: string;
  city: string;
  postalCode: string | null;
  latitude: string | number;
  longitude: string | number;
  locationType: string | null;
  parkingAvailable: boolean | null;
  wheelchairAccessible: boolean | null;
  outdoorType: string | null;
  operationalStatus: string;
  operatingHours: Record<string, { open: string; close: string }> | null;
  acceptsCard: boolean | null;
  acceptsMobile: boolean | null;
  acceptsCash: boolean | null;
}

export const STATION_STATUS_LABEL: Record<string, { en: string; he: string; cls: string }> = {
  active: { en: 'Open', he: 'פעילה', cls: 'text-[#0a0a0a] font-semibold' },
  coming_soon: { en: 'Opening soon', he: 'נפתחת בקרוב', cls: 'text-[#D4AF37]' },
  maintenance: { en: 'In maintenance', he: 'בתחזוקה', cls: 'text-gray-500' },
  offline: { en: 'Temporarily unavailable', he: 'לא זמינה זמנית', cls: 'text-gray-400' },
};

// Announced sites — REAL planned stations, honestly labelled, shown before any
// DB hardware row exists (CEO 2026-06-11: Kfar Saba must be visible to everyone
// now). NOT fake operating stations — every field is true; data mirrors
// docs/stations/launch-stations-2026-06.md. Set `open: true` once a site is
// actually operating (it then shows as "Open" instead of "Opening soon"), or
// remove the entry once its live pet_wash_stations row exists.
// arrivalHe/arrivalEn: plain-language "how do I actually find it" copy. A pin in
// the middle of a park is useless to a driver — people navigate by entrances,
// car parks and landmarks, so we state those in words (CEO 2026-07-18: visitors
// were getting lost inside Isaac Wald Park). Only ever fill this with verified
// on-the-ground detail — never guess an entrance.
const ANNOUNCED_LOCATIONS: { code: string; city: string; nameHe: string; nameEn: string; area: string; lat: number; lng: number; etaHe: string; etaEn: string; open?: boolean; hoursHe?: string; hoursEn?: string; opens?: string; closes?: string; arrivalHe?: string; arrivalEn?: string; photo?: string; photoAltHe?: string; photoAltEn?: string }[] = [
  {
    // LIVE: Isaac Wald Park is open — two K9000 bays operating (Nayax online).
    // Hours are CEO-stated (2026-07-15): daily 05:30–23:00, closed on holidays.
    code: 'PWS-IL-KFS-001',
    city: 'כפר סבא',
    nameHe: 'פארק יצחק ולד, כפר סבא',
    nameEn: 'Isaac Wald Park, Kfar Saba',
    area: 'Isaac Wald Park',
    lat: 32.179964, lng: 34.925016,
    open: true,
    etaHe: 'פעילה עכשיו — תחנת השטיפה החכמה הראשונה שלנו',
    etaEn: 'Open now — our first smart wash hub',
    hoursHe: 'פתוחה כל יום 05:30–23:00 (למעט חגים)',
    hoursEn: 'Open daily 05:30–23:00 (except holidays)',
    opens: '05:30', closes: '23:00',
    arrivalHe: 'פארק יצחק ולד, כפר סבא (מיקוד 4445810) — בתוך הפארק, ליד החניון הראשי; חניה במקום בתשלום (כחול-לבן), ומשם הליכה קצרה אל העמדה. (עמדה נפרדת לחלוטין מכפר סבא הירוקה / פארק 80.)',
    arrivalEn: 'Isaac Wald Park, Kfar Saba (postcode 4445810) — inside the park, beside the main car park; on-site paid parking (blue-and-white), then a short walk to the bay. (A completely separate station from Green Kfar Saba / Park 80.)',
    // Real on-site photo (CEO, 2026-07-23). Green Kfar Saba gets its photo next week.
    photo: waldStationPhoto,
    photoAltHe: 'תחנת PetWash בפארק יצחק ולד, כפר סבא — שני תאי שטיפה K9000',
    photoAltEn: 'PetWash station at Isaac Wald Park, Kfar Saba — dual K9000 wash bays',
  },
  {
    // Station 2 — Green Kfar Saba. Exact install coordinates confirmed by CEO
    // (2026-07-17): dual K9000 bay, 24/7. CEO marked LIVE (opens 2026-07-18).
    code: 'PWS-IL-KFS-002',
    city: 'כפר סבא',
    nameHe: 'כפר סבא הירוקה',
    nameEn: 'Green Kfar Saba',
    area: 'Green Kfar Saba',
    lat: 32.1982242, lng: 34.892436,
    open: true,
    etaHe: 'פעילה — עמדה דו-תאית, פתוחה 24/7',
    etaEn: 'Open — dual bay, 24/7',
    hoursHe: 'פתוחה 24 שעות בכל יום',
    hoursEn: 'Open 24/7',
    opens: '00:00', closes: '23:59',
    arrivalHe: 'כפר סבא הירוקה, פארק 80 — ממש בכניסה לפארק, ליד דוכן הקפה; העמדה נראית מהכניסה. (עמדה נפרדת לחלוטין מפארק יצחק ולד.)',
    arrivalEn: 'Green Kfar Saba, Park 80 — right at the park entrance, beside the coffee kiosk; the bay is visible from the entrance. (A completely separate station from Isaac Wald Park.)',
  },
];

export default function Locations() {
  useSEO({
    ...pageSEO.locations,
    title: 'שטיפת כלבים בשירות עצמי בכפר סבא — עמדות ⁦K9000⁩ | PetWash™',
    description: 'עמדת שטיפת כלבים בשירות עצמי ⁦K9000⁩ בפארק יצחק ולד, כפר סבא — פתוחה עכשיו. קל, נקי ובשליטה שלכם. מצאו את התחנה הקרובה.',
    keywords: 'שטיפת כלבים כפר סבא, שטיפת כלבים בשירות עצמי, עמדת שטיפה לכלבים, מקלחת לכלב כפר סבא, dog wash Kfar Saba, K9000',
  });
  const [, navigate] = useLocation();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [stations, setStations] = useState<PublicStation[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  // AEO/SEO structured data — Organization + LocalBusiness (only for the OPEN
  // announced station, truthful geo/address; hours/phone omitted as unknown) +
  // FAQPage + Breadcrumb, emitted as one @graph. Live-data-only, no invented fields.
  useEffect(() => {
    const openStations = ANNOUNCED_LOCATIONS.filter((a) => a.open);
    const socials = [
      'https://www.instagram.com/petwashltd',
      'https://www.tiktok.com/@petwashltd',
      'https://www.facebook.com/petwashltd',
    ];
    const graph: object[] = [
      {
        '@type': 'Organization',
        // Same @id the site-wide Organization uses in index.html — one canonical
        // Organization node, referenced (not re-declared thin) across the graph.
        '@id': 'https://petwash.co.il/#organization',
        name: 'PetWash™',
        url: 'https://petwash.co.il',
        logo: 'https://petwash.co.il/brand/petwash-logo-official.png',
        sameAs: socials,
      },
      // One LocalBusiness node per OPEN station — so every live site (not just
      // the first) is discoverable by search + answer engines.
      ...openStations.map((s) => ({
        '@type': 'LocalBusiness',
        '@id': `https://petwash.co.il/locations#${s.code}`,
        name: `PetWash™ — ${s.nameEn}`,
        url: 'https://petwash.co.il/locations',
        image: s.photo ? new URL(s.photo, 'https://petwash.co.il').href : 'https://petwash.co.il/brand/petwash-logo-official.png',
        priceRange: '₪₪',
        address: {
          '@type': 'PostalAddress',
          streetAddress: s.area,
          addressLocality: s.city,
          addressCountry: 'IL',
        },
        geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng },
        // Plain-language arrival directions — lets Google/answer engines tell a
        // visitor which entrance and car park to use, not just a raw coordinate.
        ...(s.arrivalEn ? { description: s.arrivalEn } : {}),
        // Regular weekly hours only — holiday closures are stated in the visible
        // card copy; schema.org has no clean "except holidays" expression.
        ...(s.opens && s.closes ? {
          openingHoursSpecification: {
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
            opens: s.opens,
            closes: s.closes,
          },
        } : {}),
        areaServed: s.city,
        parentOrganization: { '@id': 'https://petwash.co.il/#organization' },
        sameAs: socials,
        makesOffer: {
          '@type': 'Offer',
          priceCurrency: 'ILS',
          price: '55',
          itemOffered: { '@type': 'Service', name: 'שטיפת כלבים בשירות עצמי (K9000)' },
        },
      })),
      {
        '@type': 'FAQPage',
        mainEntity: STATION_FAQ.map((f) => ({
          '@type': 'Question',
          name: f.qHe,
          acceptedAnswer: { '@type': 'Answer', text: f.aHe },
        })),
      },
      generateBreadcrumbSchema([
        { name: 'בית', url: 'https://petwash.co.il/' },
        { name: 'תחנות', url: 'https://petwash.co.il/locations' },
      ]),
    ];
    injectStructuredData({ '@context': 'https://schema.org', '@graph': graph });
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => setUserLocation({ lat: position.coords.latitude, lng: position.coords.longitude }),
        () => { /* location denied — show unsorted list */ }
      );
    }
    fetch(getApiUrl('/api/public/stations'))
      .then(r => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(d => setStations((d.stations || []) as PublicStation[]))
      .catch(e => { logger.error('[Locations] load stations', e); setLoadFailed(true); });
  }, []);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const sorted = stations
    ? userLocation
      ? [...stations].sort((a, b) =>
          calculateDistance(userLocation.lat, userLocation.lng, Number(a.latitude), Number(a.longitude)) -
          calculateDistance(userLocation.lat, userLocation.lng, Number(b.latitude), Number(b.longitude)))
      : stations
    : [];

  // The page promises "Find a Station Near You" and asks for the visitor's GPS —
  // but the distance sort above only covered DB stations, and every real station
  // currently lives in ANNOUNCED_LOCATIONS. So a visitor granted location access
  // and was still told nothing. Annotate + sort the announced cards too.
  const announced = (userLocation
    ? [...ANNOUNCED_LOCATIONS]
        .map((a) => ({ ...a, km: calculateDistance(userLocation.lat, userLocation.lng, a.lat, a.lng) }))
        .sort((a, b) => a.km - b.km)
    : ANNOUNCED_LOCATIONS.map((a) => ({ ...a, km: undefined as number | undefined })));

  /** "800 m" under a kilometre, otherwise one decimal — no false precision. */
  const formatKm = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`);

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12 luxury-fade-in">
          <div className="text-7xl mb-6">📍</div>
          <h1 className="luxury-heading-xl mb-6">Find a Station Near You · תחנות שטיפה בשירות עצמי</h1>
          <p className="luxury-subtitle-lg max-w-2xl mx-auto">
            Premium self-service K9000 dog wash stations · שטיפת כלבים בשירות עצמי
          </p>
        </div>

        {userLocation && (sorted.length > 0 || announced.length > 0) && (
          <div className="max-w-4xl mx-auto mb-8 luxury-glass-card luxury-bg-success p-6 text-center luxury-scale-in">
            <p className="text-white flex items-center justify-center gap-3 text-lg font-semibold">
              <Navigation className="w-6 h-6" />
              Showing stations sorted by distance from your location
            </p>
          </div>
        )}

        {stations === null && !loadFailed && (
          <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-gray-400" /></div>
        )}

        {loadFailed && (
          <div className="max-w-xl mx-auto text-center luxury-glass-card p-10">
            <p className="luxury-text-body">
              The station map could not be loaded right now. Please try again shortly.
              <br />מפת התחנות אינה זמינה כרגע — נסו שוב בעוד רגע.
            </p>
          </div>
        )}

        {/* Announced sites — opening soon (real, honestly labelled). Always shown. */}
        {ANNOUNCED_LOCATIONS.length > 0 && (
          <div className="max-w-4xl mx-auto space-y-4 mb-8">
            {announced.map((a) => (
              <div key={a.nameEn} className="relative rounded-2xl p-[1.5px] bg-gradient-to-br from-[#D4AF37] via-[#F4E4A6] to-[#D4AF37] luxury-shadow-lg">
                <div className="rounded-2xl bg-white overflow-hidden">
                  {a.photo && (
                    <img
                      src={a.photo}
                      alt={`${a.photoAltEn ?? a.nameEn} · ${a.photoAltHe ?? a.nameHe}`}
                      loading="lazy"
                      decoding="async"
                      className="w-full h-52 sm:h-72 object-cover object-center"
                      data-testid={`station-photo-${a.code}`}
                    />
                  )}
                  <div className="p-6 sm:p-8">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                      {a.open ? (
                        <span className="text-xs font-semibold tracking-wide text-emerald-600">● OPEN NOW · פעילה עכשיו</span>
                      ) : (
                        <span className="text-xs font-semibold tracking-wide text-[#D4AF37]">✦ OPENING SOON · נפתחת בקרוב</span>
                      )}
                      <h2 className="text-2xl font-bold luxury-gradient-text mt-1">{a.nameEn}</h2>
                      <p className="text-lg luxury-text-body" dir="rtl">{a.nameHe}</p>
                      {a.km !== undefined && (
                        <p className="text-sm font-semibold text-[#9C7209] mt-1 flex items-center gap-1.5">
                          <Navigation className="w-4 h-4 shrink-0" />
                          <span>{formatKm(a.km)} away · {formatKm(a.km)} ממך</span>
                        </p>
                      )}
                      <p className="luxury-text-body mt-1">{a.etaEn} · {a.etaHe}</p>
                      {a.hoursHe && (
                        <p className="luxury-text-body mt-1 flex items-center gap-1.5">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>{a.hoursEn} · {a.hoursHe}</span>
                        </p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1 font-mono tracking-wide" dir="ltr">{a.code}</p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        className="luxury-btn-outline"
                        onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${a.lat},${a.lng}`, '_blank')}
                      >
                        <MapPin className="w-5 h-5 mr-2" /> View on map · במפה
                      </Button>
                      {/* Walking route — a park pin is hard to reach by car, so give
                          people the on-foot leg from wherever they parked. */}
                      <Button
                        className="luxury-btn-outline"
                        onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}&travelmode=walking`, '_blank')}
                      >
                        <Navigation className="w-5 h-5 mr-2" /> Walk here · הליכה
                      </Button>
                    </div>
                  </div>

                  {/* How to actually find it — entrance, car park, landmarks. */}
                  {a.arrivalHe && (
                    <div className="mt-5 rounded-xl bg-[#FBF8F1] border border-[#EFE6CE] p-4">
                      <p className="text-xs font-semibold tracking-wide text-[#9C7209] uppercase mb-1.5">
                        Getting there · איך מגיעים
                      </p>
                      <p className="luxury-text-body text-sm" dir="ltr">{a.arrivalEn}</p>
                      <p className="luxury-text-body text-sm mt-1" dir="rtl">{a.arrivalHe}</p>
                    </div>
                  )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {stations !== null && stations.length === 0 && ANNOUNCED_LOCATIONS.length === 0 && (
          <div className="max-w-xl mx-auto text-center luxury-glass-card p-10">
            <Waves className="w-10 h-10 mx-auto mb-4 text-gray-400" strokeWidth={1.5} />
            <p className="luxury-text-body text-lg">
              Station locations will appear here as they open.
              <br />מיקומי התחנות יופיעו כאן עם פתיחתן.
            </p>
          </div>
        )}

        <div className="max-w-4xl mx-auto space-y-6 luxury-stagger-fade-in">
          {sorted.map((station, index) => {
            const lat = Number(station.latitude);
            const lng = Number(station.longitude);
            const distance = userLocation ? calculateDistance(userLocation.lat, userLocation.lng, lat, lng) : null;
            const status = STATION_STATUS_LABEL[station.operationalStatus] || { en: station.operationalStatus, he: station.operationalStatus, cls: 'text-gray-500' };

            return (
              <div key={station.stationCode} className="luxury-glass-card luxury-hover-lift luxury-shadow-lg" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="p-8">
                  <div className="flex items-start justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold luxury-gradient-text mb-2">{station.stationName}</h2>
                      <p className="text-xl luxury-text-body">{station.address}, {station.city}</p>
                      <p className={`text-sm font-medium mt-1 ${status.cls}`}>{status.he} · {status.en}</p>
                    </div>
                    {distance !== null && (
                      <div className="luxury-glass-minimal px-6 py-4 rounded-xl text-center">
                        <div className="text-3xl font-black luxury-gradient-text">{distance.toFixed(1)}</div>
                        <div className="text-sm luxury-text-muted mt-1">km</div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-3 mb-8 text-sm luxury-text-muted">
                    {station.operatingHours && <span className="inline-flex items-center gap-1"><Clock className="w-4 h-4" /> {'שעות פעילות בעמוד התחנה · hours on station page'}</span>}
                    {station.parkingAvailable && <span className="inline-flex items-center gap-1"><Car className="w-4 h-4" /> חניה · Parking</span>}
                    {station.wheelchairAccessible && <span className="inline-flex items-center gap-1"><Accessibility className="w-4 h-4" /> נגישה · Accessible</span>}
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <Button
                      className="luxury-btn-primary luxury-shadow-xl"
                      onClick={() => navigate(`/stations/${station.stationCode.toLowerCase()}`)}
                      data-testid={`button-station-${station.stationCode}`}
                    >
                      <Waves className="w-5 h-5 mr-2" />
                      Station details · לעמוד התחנה
                    </Button>
                    <Button
                      className="luxury-btn-outline"
                      onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank')}
                    >
                      <MapPin className="w-5 h-5 mr-2" />
                      Navigate · ניווט
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* AEO/SEO — visible FAQ, mirrored 1:1 into FAQPage JSON-LD above so an
            answer engine can lift a factual sentence verbatim. */}
        <div className="max-w-3xl mx-auto mt-16" dir="rtl">
          <h2 className="text-2xl sm:text-3xl font-bold luxury-gradient-text mb-6 text-center">שאלות נפוצות · FAQ</h2>
          <div className="space-y-3">
            {STATION_FAQ.map((f, i) => (
              <details key={i} className="rounded-2xl border border-gray-100 bg-white p-4 sm:p-5 group">
                <summary className="cursor-pointer font-semibold text-gray-900 list-none flex items-center justify-between gap-3">
                  <span>{f.qHe}</span>
                  <span className="text-[#D4AF37] group-open:rotate-45 transition-transform text-xl leading-none">＋</span>
                </summary>
                <p className="text-gray-600 mt-3 leading-relaxed">{f.aHe}</p>
                <p className="text-gray-400 text-sm mt-1" dir="ltr">{f.aEn}</p>
              </details>
            ))}
          </div>
        </div>

        {/* Location request CTA — lead capture for new deployments.
            Bilingual content is split into explicit dir="ltr" (English) and
            dir="rtl" (Hebrew) blocks so punctuation doesn't flip on RTL mobile,
            and the CTA wraps instead of overflowing the viewport. */}
        <div className="max-w-4xl mx-auto mt-16 luxury-glass-card luxury-shadow-xl p-6 sm:p-10 text-center luxury-slide-up">
          <h2 className="text-2xl sm:text-3xl font-bold luxury-gradient-text mb-4">
            <span dir="ltr" className="block">Want a station in your neighborhood?</span>
            <span dir="rtl" className="block">רוצים תחנה בשכונה שלכם?</span>
          </h2>
          <p className="luxury-text-body text-base sm:text-lg mb-8">
            <span dir="ltr" className="block">Tell us where a ⁦PetWash™⁩ station would serve your building, center or city.</span>
            <span dir="rtl" className="block mt-1">ספרו לנו איפה תחנת ⁦PetWash™⁩ תשרת את הבניין, המרכז או העיר שלכם.</span>
          </p>
          <Button
            className="luxury-btn-outline luxury-shadow-lg w-full sm:w-auto h-auto whitespace-normal max-w-full py-3 leading-snug"
            onClick={() => window.location.href = 'mailto:Support@PetWash.co.il?subject=New Location Request'}
          >
            <span dir="ltr">📧 Request a New Location</span>
            <span className="mx-2 opacity-40 hidden sm:inline">·</span>
            <span dir="rtl" className="block sm:inline">בקשת מיקום חדש</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
