import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, Waves, CreditCard, CheckCircle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/languageStore";
import { t } from "@/lib/i18n";

interface BayInfo {
  side: string;
  label: string;
  labelHe: string;
  status: string;
  isReady: boolean;
}

interface BayStatusResponse {
  stationId: string;
  bays: BayInfo[];
  anyReady: boolean;
  allBusy: boolean;
}

export default function K9000BookingFlow() {
  const { stationId } = useParams();
  const [, setLocation] = useLocation();
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const isRtl = language === 'he' || language === 'ar';

  const { data, isLoading, isError, refetch, isFetching } = useQuery<BayStatusResponse>({
    queryKey: ['/api/k9000/stations', stationId ?? 'default', 'bay-status'],
    queryFn: async () => {
      const id = stationId ?? '1';
      const res = await fetch(`/api/k9000/stations/${id}/bay-status`);
      if (!res.ok) throw new Error('Failed to fetch bay status');
      return res.json();
    },
    refetchInterval: 15_000,
    enabled: true,
  });

  const bays: BayInfo[] = data?.bays ?? [];
  const anyReady = data?.anyReady ?? null;
  const allBusy  = data?.allBusy  ?? false;

  function bayStatusBadge(bay: BayInfo) {
    if (bay.isReady) {
      return (
        <Badge className="bg-green-100 text-green-800 border-green-300 text-sm px-3 py-1">
          <CheckCircle className="h-4 w-4 mr-1 inline" />
          {isHebrew ? 'פנוי' : t('k9000.bayAvailable', language)}
        </Badge>
      );
    }
    if (bay.status === 'busy' || bay.status === 'cleanup') {
      return (
        <Badge className="bg-red-100 text-red-800 border-red-300 text-sm px-3 py-1">
          <Clock className="h-4 w-4 mr-1 inline" />
          {isHebrew ? 'תפוס' : t('k9000.bayBusy', language)}
        </Badge>
      );
    }
    if (bay.status === 'fault' || bay.status === 'maintenance' || bay.status === 'offline') {
      return (
        <Badge className="bg-gray-200 text-gray-700 border-gray-300 text-sm px-3 py-1">
          <AlertCircle className="h-4 w-4 mr-1 inline" />
          {isHebrew ? 'לא זמין' : 'Unavailable'}
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-600 text-sm px-3 py-1">
        {bay.status}
      </Badge>
    );
  }

  return (
    <div className="min-h-screen luxury-bg-mesh">
      {/* Header */}
      <div className="luxury-glass-panel border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <button
            className="luxury-btn-ghost mb-4"
            onClick={() => setLocation('/locations')}
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4 mr-2" />
            {isHebrew ? 'חזרה לתחנות' : 'Back to Stations'}
          </button>
          <h1 className="luxury-heading-md luxury-text-gradient" data-testid="page-title">
            {isHebrew ? '🐾 תחנת K9000™' : '🐾 K9000™ Wash Station'}
          </h1>
          <p className="luxury-text-body mt-1 opacity-70">
            {isHebrew
              ? 'הגע לתחנה, בדוק מפרץ פנוי והתחל שטיפה'
              : 'Arrive at the station, check for a free bay, and start your wash'}
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-12 pt-6 space-y-6">

        {/* Live Bay Status */}
        <div className="luxury-glass-card luxury-shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="luxury-heading-sm flex items-center gap-2">
              <Waves className="h-5 w-5 text-blue-500" />
              {isHebrew ? 'מצב מפרצים בזמן אמת' : t('k9000.bayStatus', language)}
            </h2>
            <button
              onClick={() => refetch()}
              className="text-gray-400 hover:text-blue-500 transition-colors"
              aria-label="Refresh bay status"
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {isLoading && (
            <div className="text-center py-6 luxury-text-body opacity-60">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3" />
              {isHebrew ? 'בודק זמינות מפרצים...' : t('k9000.checkingBayStatus', language)}
            </div>
          )}

          {isError && !isLoading && (
            <div className="text-center py-4 luxury-text-body text-amber-600">
              {isHebrew
                ? 'לא ניתן לטעון את מצב המפרצים. בדוק שוב בעוד כמה שניות.'
                : 'Could not load bay status. Please check again in a moment.'}
            </div>
          )}

          {!isLoading && bays.length === 0 && !isError && (
            <div className="text-center py-4 luxury-text-body opacity-60">
              {isHebrew
                ? 'פרטי מפרצים לא זמינים עדיין. גש פיזית לתחנה.'
                : 'Bay details not yet available. Please go to the station directly.'}
            </div>
          )}

          {bays.length > 0 && (
            <div className="space-y-3">
              {bays.map((bay) => (
                <div
                  key={bay.side}
                  className={`flex items-center justify-between rounded-xl px-4 py-3 border ${
                    bay.isReady ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                  }`}
                  data-testid={`bay-status-${bay.side}`}
                >
                  <span className="font-semibold text-gray-800">
                    {isHebrew ? bay.labelHe : bay.label}
                  </span>
                  {bayStatusBadge(bay)}
                </div>
              ))}
            </div>
          )}

          {allBusy && !isLoading && (
            <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-amber-800 text-sm">
              <Clock className="h-4 w-4 inline mr-1" />
              {isHebrew
                ? 'שני המפרצים תפוסים כרגע — המתן כמה דקות, מפרץ צפוי להתפנות בקרוב'
                : t('k9000.waitMessage', language)}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="luxury-glass-card luxury-shadow-xl p-6 space-y-4">
          <h2 className="luxury-heading-sm">
            {isHebrew ? 'איך זה עובד' : 'How it works'}
          </h2>

          {/* Path 1: Pay at terminal */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-blue-800">
              <CreditCard className="h-5 w-5" />
              {isHebrew ? 'תשלום בטרמינל (כרטיס / NFC)' : t('k9000.payAtTerminal', language)}
            </div>
            <p className="text-sm text-blue-700">
              {isHebrew
                ? 'גש למפרץ הפנוי, הנח כרטיס אשראי או טלפון על קורא ה-Nayax — השטיפה מתחילה מיד.'
                : t('k9000.payAtTerminalDesc', language)}
            </p>
          </div>

          {/* Path 2: Redeem via app */}
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-purple-800">
              <Waves className="h-5 w-5" />
              {isHebrew ? 'מימוש קרדיט / QR' : t('k9000.redeemWash', language)}
            </div>
            <p className="text-sm text-purple-700">
              {isHebrew
                ? 'יש לך קרדיטים או חבילת שטיפה? צור QR באפליקציה וסרוק אותו בטרמינל.'
                : 'Have wash credits or a package? Generate a QR in the app and scan it at the terminal.'}
            </p>
            <Button
              className="luxury-btn-primary w-full mt-2"
              onClick={() => setLocation('/k9000/redeem')}
              data-testid="button-redeem-wash"
            >
              <Waves className="h-4 w-4 mr-2" />
              {isHebrew ? 'מימוש שטיפה' : t('k9000.redeemWash', language)}
            </Button>
          </div>
        </div>

        {/* No booking notice */}
        <p className="text-center luxury-text-small opacity-50 px-4">
          {isHebrew
            ? 'K9000 פועל כמו מכונת שירות עצמי — אין צורך בהזמנה מראש, בלוח זמנים או בקביעת תור.'
            : 'K9000 works like a self-service car wash — no advance booking, no calendar slot, no appointment needed.'}
        </p>
      </div>
    </div>
  );
}
