/**
 * StationPage — /stations/:slug — public landing page per K9000 station.
 *
 * The local-SEO lever from the 2026-06-10 audit: the שטיפת כלבים בשירות עצמי
 * SERP has no owned competitor content, and per-station pages are how the
 * site enters local search (homedog/walkdog pattern).
 *
 * Truthfulness rules:
 * - Renders ONLY live data from GET /api/public/stations/:code — no invented
 *   hours, prices or phone numbers. Missing fields are simply not shown.
 * - LocalBusiness JSON-LD is built from the same live data (address, geo,
 *   hours when present) via injectStructuredData.
 * - Offline/maintenance stations state it plainly.
 */
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { MapPin, Clock, Loader2, Accessibility, Car, CreditCard, Smartphone, Waves, ArrowRight } from 'lucide-react';
import { useSEO, injectStructuredData } from '@/lib/seo';
import { getApiUrl } from '@/lib/apiConfig';
import { logger } from '@/lib/logger';
import { type PublicStation, STATION_STATUS_LABEL } from '@/pages/Locations';

const DAY_LABELS: Record<string, { en: string; he: string; schema: string }> = {
  sunday: { en: 'Sunday', he: 'ראשון', schema: 'Sunday' },
  monday: { en: 'Monday', he: 'שני', schema: 'Monday' },
  tuesday: { en: 'Tuesday', he: 'שלישי', schema: 'Tuesday' },
  wednesday: { en: 'Wednesday', he: 'רביעי', schema: 'Wednesday' },
  thursday: { en: 'Thursday', he: 'חמישי', schema: 'Thursday' },
  friday: { en: 'Friday', he: 'שישי', schema: 'Friday' },
  saturday: { en: 'Saturday', he: 'שבת', schema: 'Saturday' },
};
const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface StationPageProps { slug: string; }

export default function StationPage({ slug }: StationPageProps) {
  const [, navigate] = useLocation();
  const [station, setStation] = useState<PublicStation | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    setStation(null); setNotFound(false); setFailed(false);
    fetch(getApiUrl(`/api/public/stations/${encodeURIComponent(slug)}`))
      .then(r => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { if (d?.station) setStation(d.station as PublicStation); })
      .catch(e => { logger.error('[StationPage] load', e); setFailed(true); });
  }, [slug]);

  // Per-station SEO: city-targeted title built from LIVE data only.
  useSEO(station ? {
    title: `שטיפת כלבים בשירות עצמי ב${station.city} — ${station.stationName} | Pet Wash™`,
    description: `Self-service K9000 dog wash at ${station.stationName}, ${station.address}, ${station.city}. שטיפת כלבים בשירות עצמי ב${station.city} — ${station.address}. מוצרים המותאמים לחיות מחמד, קל, בטוח ונקי.`,
    keywords: `שטיפת כלבים ${station.city}, שטיפת כלבים בשירות עצמי ${station.city}, dog wash ${station.city}, K9000, מקלחת לכלב ${station.city}`,
    canonical: `https://petwash.co.il/stations/${station.stationCode.toLowerCase()}`,
    ogType: 'website',
  } : undefined);

  // LocalBusiness JSON-LD from live data — only fields that actually exist.
  useEffect(() => {
    if (!station) return;
    const hours = station.operatingHours
      ? DAY_ORDER
          .filter(d => station.operatingHours?.[d]?.open && station.operatingHours?.[d]?.close)
          .map(d => ({
            '@type': 'OpeningHoursSpecification',
            dayOfWeek: DAY_LABELS[d].schema,
            opens: station.operatingHours![d].open,
            closes: station.operatingHours![d].close,
          }))
      : [];
    injectStructuredData({
      '@context': 'https://schema.org',
      '@type': 'LocalBusiness',
      '@id': `https://petwash.co.il/stations/${station.stationCode.toLowerCase()}#station`,
      name: `Pet Wash™ — ${station.stationName}`,
      url: `https://petwash.co.il/stations/${station.stationCode.toLowerCase()}`,
      image: 'https://petwash.co.il/IMG_7114_1751624638881.jpeg',
      address: {
        '@type': 'PostalAddress',
        streetAddress: station.address,
        addressLocality: station.city,
        ...(station.postalCode ? { postalCode: station.postalCode } : {}),
        addressCountry: 'IL',
      },
      geo: { '@type': 'GeoCoordinates', latitude: Number(station.latitude), longitude: Number(station.longitude) },
      ...(hours.length ? { openingHoursSpecification: hours } : {}),
      paymentAccepted: [
        ...(station.acceptsCard ? ['Credit Card'] : []),
        ...(station.acceptsMobile ? ['Apple Pay, Google Pay'] : []),
        ...(station.acceptsCash ? ['Cash'] : []),
      ].join(', ') || undefined,
      parentOrganization: { '@id': 'https://petwash.co.il/#organization' },
    });
  }, [station]);

  if (notFound) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center px-4">
        <div className="text-center max-w-md luxury-glass-card p-10">
          <Waves className="w-10 h-10 mx-auto mb-4 text-gray-400" strokeWidth={1.5} />
          <h1 className="luxury-heading-lg mb-3">Station not found · התחנה לא נמצאה</h1>
          <Button className="luxury-btn-primary mt-4" onClick={() => navigate('/locations')}>
            All stations · לכל התחנות
          </Button>
        </div>
      </div>
    );
  }

  if (failed) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center px-4">
        <p className="luxury-text-body text-center">This page could not be loaded right now. · העמוד אינו זמין כרגע.</p>
      </div>
    );
  }

  if (!station) {
    return (
      <div className="min-h-screen luxury-bg-mesh flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  const status = STATION_STATUS_LABEL[station.operationalStatus]
    || { en: station.operationalStatus, he: station.operationalStatus, cls: 'text-gray-500' };
  const lat = Number(station.latitude);
  const lng = Number(station.longitude);
  const hoursEntries = station.operatingHours
    ? DAY_ORDER.filter(d => station.operatingHours?.[d]?.open && station.operatingHours?.[d]?.close)
    : [];

  return (
    <div className="min-h-screen luxury-bg-mesh">
      <div className="container mx-auto px-4 py-16 max-w-3xl">
        <button onClick={() => navigate('/locations')} className="text-sm luxury-text-muted underline mb-6 inline-flex items-center gap-1">
          <ArrowRight className="w-3.5 h-3.5 scale-x-[-1]" /> All stations · לכל התחנות
        </button>

        <div className="luxury-fade-in mb-10">
          <h1 className="luxury-heading-xl mb-3">שטיפת כלבים בשירות עצמי ב{station.city}</h1>
          <h2 className="text-2xl font-bold luxury-gradient-text mb-2">{station.stationName}</h2>
          <p className="text-lg luxury-text-body flex items-center gap-2">
            <MapPin className="w-5 h-5 shrink-0" /> {station.address}, {station.city}
          </p>
          <p className={`text-sm font-medium mt-2 ${status.cls}`}>{status.he} · {status.en}</p>
        </div>

        {station.operationalStatus !== 'active' && (
          <div className="luxury-glass-card p-5 mb-8">
            <p className="luxury-text-body text-sm">
              {station.operationalStatus === 'maintenance'
                ? 'התחנה בתחזוקה כעת ותחזור לפעול בקרוב. · This station is under maintenance and will be back soon.'
                : 'התחנה אינה זמינה זמנית. · This station is temporarily unavailable.'}
            </p>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-6 mb-10">
          {hoursEntries.length > 0 && (
            <div className="luxury-glass-card p-6">
              <h3 className="font-bold text-sm luxury-text-muted mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> שעות פעילות · Hours</h3>
              <ul className="space-y-1 text-sm luxury-text-body">
                {hoursEntries.map(d => (
                  <li key={d} className="flex justify-between gap-4">
                    <span>{DAY_LABELS[d].he} · {DAY_LABELS[d].en}</span>
                    <span dir="ltr">{station.operatingHours![d].open}–{station.operatingHours![d].close}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="luxury-glass-card p-6">
            <h3 className="font-bold text-sm luxury-text-muted mb-3">בתחנה · At the station</h3>
            <ul className="space-y-2 text-sm luxury-text-body">
              <li className="flex items-center gap-2"><Waves className="w-4 h-4 shrink-0" /> K9000 self-service dog wash · שטיפה בשירות עצמי</li>
              {station.parkingAvailable && <li className="flex items-center gap-2"><Car className="w-4 h-4 shrink-0" /> חניה זמינה · Parking available</li>}
              {station.wheelchairAccessible && <li className="flex items-center gap-2"><Accessibility className="w-4 h-4 shrink-0" /> נגישה לכיסאות גלגלים · Wheelchair accessible</li>}
              {station.acceptsCard && <li className="flex items-center gap-2"><CreditCard className="w-4 h-4 shrink-0" /> כרטיס אשראי · Credit card</li>}
              {station.acceptsMobile && <li className="flex items-center gap-2"><Smartphone className="w-4 h-4 shrink-0" /> תשלום בנייד · Apple Pay / Google Pay</li>}
            </ul>
          </div>
        </div>

        <div className="luxury-glass-card p-6 mb-10">
          <p className="luxury-text-body text-sm leading-relaxed">
            תחנת ⁦Pet Wash™⁩ ב{station.city} מציעה שטיפת כלבים בשירות עצמי — קל, בטוח ונקי,
            עם מוצרים המותאמים לחיות מחמד מתוצרת אוסטרליה.
            <br />
            The ⁦Pet Wash™⁩ station in {station.city} offers premium self-service dog washing —
            easy, safe and clean, with Australian-made, pet-formulated products.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <Button
            className="luxury-btn-primary luxury-shadow-xl"
            onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lng}`, '_blank')}
          >
            <MapPin className="w-5 h-5 mr-2" /> Navigate · ניווט
          </Button>
          <Button
            className="luxury-btn-outline"
            onClick={() => window.open(`https://waze.com/ul?ll=${lat},${lng}&navigate=yes`, '_blank')}
          >
            Waze
          </Button>
        </div>
      </div>
    </div>
  );
}
