/**
 * THE CARE CARD — what the owner gets when a walk finishes.
 *
 * One artifact instead of a chat scroll: when the walker arrived and left, how
 * long and how far, and the shape of the route they actually took.
 *
 * Every value here comes from GET /api/walk-my-pet/walks/:id/care-card, which
 * reads what was already recorded during the walk. Nothing is estimated and
 * nothing is filled in: a field the walk did not capture renders as "not
 * recorded", never as 0. A confident "0.00 km" under a walk that really
 * happened is worse than an honest gap — it makes the owner doubt the walk
 * rather than the tracking.
 *
 * The route is drawn as an inline SVG polyline from the raw points, normalised
 * into the viewBox. No tiles, no map key, no third-party request — the shape of
 * the walk is the part that reassures, and it costs nothing to draw.
 */
import { useQuery } from '@tanstack/react-query';
import { MapPin, Clock, Route as RouteIcon } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

interface CarePoint { lat: number; lng: number; at?: string | null }

interface CareCard {
  available: boolean;
  reason?: string;
  walker?: { displayName?: string | null; profilePhotoUrl?: string | null } | null;
  startedAt?: string | null;
  endedAt?: string | null;
  durationMinutes?: number | null;
  distanceMeters?: number | null;
  route?: CarePoint[];
  notes?: string | null;
}

/** HH:MM in the viewer's locale, or null when the moment was never recorded. */
function clockTime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Normalise lat/lng into the viewBox. Latitude grows northward and SVG y grows
 * downward, so y is inverted — otherwise every route renders mirrored.
 * A degenerate span (the walker stood still) would divide by zero; the guard
 * keeps such a walk on screen instead of producing NaN coordinates.
 */
function toPolyline(route: CarePoint[], w: number, h: number, pad: number): string {
  if (route.length < 2) return '';
  const lats = route.map((p) => p.lat);
  const lngs = route.map((p) => p.lng);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const spanLat = maxLat - minLat || 1e-9;
  const spanLng = maxLng - minLng || 1e-9;
  return route
    .map((p) => {
      const x = pad + ((p.lng - minLng) / spanLng) * (w - pad * 2);
      const y = pad + (1 - (p.lat - minLat) / spanLat) * (h - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function WalkCareCard({ bookingId }: { bookingId: string }) {
  const { language } = useLanguage();
  const he = language === 'he';

  const { data, isLoading, isError } = useQuery<CareCard>({
    queryKey: [`/api/walk-my-pet/walks/${bookingId}/care-card`],
  });

  if (isLoading) {
    return <div className="h-48 rounded-2xl bg-gray-50 animate-pulse" aria-hidden />;
  }

  // An error is NOT "no card". Say which one it is, or the owner reads a
  // failed request as a walk that was never tracked.
  if (isError) {
    return (
      <div role="alert" className="rounded-2xl border border-gray-200 p-4 text-sm text-gray-600">
        {he ? 'לא הצלחנו לטעון את כרטיס הטיול. נסו שוב.' : "We couldn't load the walk card. Please try again."}
      </div>
    );
  }

  if (!data?.available) return null;

  const start = clockTime(data.startedAt);
  const end = clockTime(data.endedAt);
  const route = data.route ?? [];
  const W = 320, H = 120, PAD = 10;
  const line = toPolyline(route, W, H, PAD);
  const points = line ? line.split(' ') : [];
  const [startX, startY] = points.length ? points[0].split(',') : ['0', '0'];
  const [endX, endY] = points.length ? points[points.length - 1].split(',') : ['0', '0'];

  const km = typeof data.distanceMeters === 'number' ? (data.distanceMeters / 1000).toFixed(2) : null;
  const notRecorded = he ? 'לא נרשם' : 'not recorded';

  return (
    <section
      dir={he ? 'rtl' : 'ltr'}
      className="rounded-2xl border border-[#D4AF37]/40 bg-white overflow-hidden"
      data-testid="walk-care-card"
    >
      <header className="px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">
          {he ? 'כרטיס הטיול' : 'Walk card'}
        </h3>
        {data.walker?.displayName && (
          <p className="mt-0.5 text-xs text-gray-500">
            {he ? 'עם ' : 'with '}{data.walker.displayName}
          </p>
        )}
      </header>

      {line ? (
        <div className="bg-[#FAFAF7] px-2 py-3">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="w-full h-auto"
            role="img"
            aria-label={he ? 'מסלול הטיול' : 'The route walked'}
          >
            <polyline
              points={line}
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            <circle cx={startX} cy={startY} r="4" fill="#0A0A0A" />
            <circle cx={endX} cy={endY} r="4" fill="#D4AF37" stroke="#0A0A0A" strokeWidth="1.5" />
          </svg>
        </div>
      ) : (
        <div className="bg-[#FAFAF7] px-4 py-6 text-center text-xs text-gray-400">
          {he ? 'המסלול לא נרשם בטיול הזה' : 'No route was recorded for this walk'}
        </div>
      )}

      <dl className="grid grid-cols-3 divide-x divide-gray-100 rtl:divide-x-reverse border-t border-gray-100">
        <div className="px-3 py-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
            <Clock className="w-3 h-3" aria-hidden />{he ? 'יצא' : 'Start'}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">{start ?? notRecorded}</dd>
        </div>
        <div className="px-3 py-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
            <MapPin className="w-3 h-3" aria-hidden />{he ? 'חזר' : 'End'}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">{end ?? notRecorded}</dd>
        </div>
        <div className="px-3 py-3 text-center">
          <dt className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-wide text-gray-400">
            <RouteIcon className="w-3 h-3" aria-hidden />{he ? 'מרחק' : 'Distance'}
          </dt>
          <dd className="mt-1 text-sm font-semibold text-gray-900">
            {km !== null ? `${km} ${he ? 'ק"מ' : 'km'}` : notRecorded}
          </dd>
        </div>
      </dl>

      {typeof data.durationMinutes === 'number' && (
        <p className="px-4 pb-3 text-xs text-gray-500">
          {he ? `משך: ${data.durationMinutes} דקות` : `Duration: ${data.durationMinutes} min`}
        </p>
      )}

      {data.notes && (
        <p className="px-4 pb-4 text-sm leading-relaxed text-gray-700 border-t border-gray-100 pt-3">
          {data.notes}
        </p>
      )}
    </section>
  );
}
