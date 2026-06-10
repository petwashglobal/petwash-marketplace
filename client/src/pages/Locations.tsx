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
import { useSEO, pageSEO } from '@/lib/seo';
import { getApiUrl } from '@/lib/apiConfig';
import { logger } from '@/lib/logger';

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
  active: { en: 'Open', he: 'פעילה', cls: 'text-emerald-600' },
  coming_soon: { en: 'Opening soon', he: 'נפתחת בקרוב', cls: 'text-amber-600' },
  maintenance: { en: 'In maintenance', he: 'בתחזוקה', cls: 'text-gray-500' },
  offline: { en: 'Temporarily unavailable', he: 'לא זמינה זמנית', cls: 'text-gray-400' },
};

export default function Locations() {
  useSEO(pageSEO.locations);
  const [, navigate] = useLocation();
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [stations, setStations] = useState<PublicStation[] | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

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

        {userLocation && sorted.length > 0 && (
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

        {stations !== null && stations.length === 0 && (
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

        {/* Location request CTA — lead capture for new deployments */}
        <div className="max-w-4xl mx-auto mt-16 luxury-glass-card luxury-shadow-xl p-10 text-center luxury-slide-up">
          <h2 className="text-3xl font-bold luxury-gradient-text mb-4">Want a station in your neighborhood? · רוצים תחנה בשכונה שלכם?</h2>
          <p className="luxury-text-body text-lg mb-8">
            Tell us where a ⁦Pet Wash™⁩ station would serve your building, center or city.
            <br />ספרו לנו איפה תחנת ⁦Pet Wash™⁩ תשרת את הבניין, המרכז או העיר שלכם.
          </p>
          <Button
            className="luxury-btn-outline luxury-shadow-lg"
            onClick={() => window.location.href = 'mailto:Support@PetWash.co.il?subject=New Location Request'}
          >
            📧 Request a New Location · בקשת מיקום חדש
          </Button>
        </div>
      </div>
    </div>
  );
}
