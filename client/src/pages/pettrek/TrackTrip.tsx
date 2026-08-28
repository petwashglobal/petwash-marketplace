import { Button } from "@/components/ui/button";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, AlertTriangle, Car } from "lucide-react";
import { useLanguage } from "@/lib/languageStore";

/**
 * TrackTrip — customer-facing PetTrek live-tracking surface.
 *
 * HONESTY REBUILD. Until this file:
 *   • Took `:tripId` from the URL and IGNORED it.
 *   • Rendered the exact same hardcoded trip ("David Cohen driving a
 *     Toyota Corolla with Max the anxious dog, ETA 12 min, from
 *     Herzl 123 to Dizengoff 45") for every URL.
 *   • Faked a "Live GPS Tracking" panel that was three coloured dots,
 *     not a map.
 *   • Faked a realtime-updates feed with hardcoded messages and
 *     timestamps.
 *
 * Real PetTrek live tracking needs at minimum:
 *   • GET /api/pettrek/trips/:tripId (real trip authority).
 *   • WebSocket or polling for driver GPS + status transitions.
 *   • Rendered map (Google Maps / Mapbox), not gradient dots.
 *   • Real timeline built from trip_events, not literals.
 *   • Actual driver call / message deep-links keyed to a real
 *     driver contact row.
 *
 * None of that ships in this file. Rendering a fake trip when the
 * customer clicked Track was a legal/consumer-protection issue —
 * PetTrek is CEO-legally-blocked (server/routes/booking-requests.ts
 * :3346), so no customer has a real live trip today.
 *
 * The page now renders the honest "tracking not yet available" state
 * with the tripId visible, a back link, and a link to the customer
 * dashboard. When the real endpoint + WebSocket land, rebuild the
 * live surface on top of them and delete this shell.
 */
export default function TrackTrip() {
  const { tripId } = useParams<{ tripId: string }>();
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const tr = (en: string, he: string) => (isHebrew ? he : en);

  return (
    <div className="min-h-screen luxury-bg-mesh py-8 px-4" dir={isHebrew ? 'rtl' : 'ltr'}>
      <div className="max-w-2xl mx-auto space-y-6">
        <Button
          variant="ghost"
          className="gap-2"
          onClick={() => setLocation('/pettrek/customer/dashboard')}
          data-testid="button-back-dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr('Back to PetTrek', 'חזרה ל-PetTrek')}
        </Button>

        <div className="luxury-glass-card luxury-shadow-lg p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shrink-0">
              <AlertTriangle className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="luxury-heading-md mb-2" data-testid="page-title">
                {tr('Live tracking is not yet available', 'מעקב חי אינו זמין עדיין')}
              </h1>
              <p className="luxury-text-body">
                {tr(
                  "We're still finishing PetTrek's live-tracking wire. Once it lands, this page will show your driver's real GPS location, ETA, and trip timeline.",
                  'אנחנו עדיין משלימים את המעקב החי של PetTrek. כשנסיים, בעמוד הזה יופיעו המיקום החי של הנהג, זמן ההגעה, וציר הזמן של הנסיעה שלכם.',
                )}
              </p>
            </div>
          </div>

          {tripId && (
            <div className="luxury-glass-minimal p-4 mb-6" data-testid="trip-ref">
              <div className="text-xs uppercase tracking-widest luxury-text-small mb-1">
                {tr('Trip reference', 'מזהה נסיעה')}
              </div>
              <div dir="ltr" className="font-mono text-sm">
                #{tripId}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              className="luxury-btn-primary flex-1 gap-2"
              onClick={() => setLocation('/pettrek/customer/dashboard')}
              data-testid="button-dashboard"
            >
              <Car className="h-4 w-4" />
              {tr('Open PetTrek dashboard', 'פתחו את לוח הבקרה של PetTrek')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
