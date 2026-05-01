import { MapPin, Navigation, X, AlertTriangle, CheckCircle2, Wifi } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';
import { useLocationService, type LocationPermissionState } from '@/hooks/useLocationService';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

interface LocationPermissionBannerProps {
  role?: 'customer' | 'provider';
  onLocationReady?: (lat: number, lng: number) => void;
  compact?: boolean;
}

function label(state: LocationPermissionState, isHebrew: boolean, hasGPS: boolean) {
  if (hasGPS) return isHebrew ? 'מיקום GPS פעיל' : 'GPS location active';
  if (state === 'requesting') return isHebrew ? 'מחפש מיקום...' : 'Finding your location...';
  if (state === 'denied') return isHebrew ? 'מיקום מושבת – הפעל בהגדרות' : 'Location blocked – enable in settings';
  if (state === 'unavailable') return isHebrew ? 'GPS אינו זמין במכשיר זה' : 'GPS unavailable on this device';
  return isHebrew ? 'הפעל שירות מיקום לחיפוש מדויק יותר' : 'Enable location for better nearby matches';
}

export default function LocationPermissionBanner({
  role = 'customer',
  onLocationReady,
  compact = false,
}: LocationPermissionBannerProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [dismissed, setDismissed] = useState(false);
  const { permissionState, stamp, requestPermission, hasGPS } = useLocationService(role);

  if (dismissed) return null;
  if (hasGPS && stamp) {
    onLocationReady?.(stamp.latitude, stamp.longitude);
    if (compact) return null;
  }

  const isGranted = hasGPS;
  const isDenied = permissionState === 'denied';
  const isRequesting = permissionState === 'requesting';

  if (compact && !isGranted) {
    return (
      <button
        onClick={requestPermission}
        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
        disabled={isRequesting}
      >
        <Navigation className={`h-3.5 w-3.5 ${isRequesting ? 'animate-pulse text-blue-500' : 'text-gray-400'}`} />
        <span>{isRequesting
          ? (isHebrew ? 'מחפש...' : 'Locating...')
          : (isHebrew ? 'השתמש במיקום שלי' : 'Use my location')
        }</span>
      </button>
    );
  }

  if (isGranted) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-xl text-sm">
        <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        <span className="text-green-700 font-medium">
          {isHebrew ? 'GPS פעיל — מציג ספקים קרובים אליך' : 'GPS active — showing providers near you'}
        </span>
        <Wifi className="h-3.5 w-3.5 text-green-400 ms-auto animate-pulse" />
      </div>
    );
  }

  return (
    <div className={`relative flex items-start gap-3 px-4 py-3 rounded-xl border transition-all ${
      isDenied
        ? 'bg-amber-50 border-amber-200'
        : 'bg-blue-50 border-blue-200'
    }`}>
      <div className={`shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
        isDenied ? 'bg-amber-100' : 'bg-blue-100'
      }`}>
        {isDenied
          ? <AlertTriangle className="h-4 w-4 text-amber-500" />
          : <MapPin className="h-4 w-4 text-blue-500" />
        }
      </div>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-semibold ${isDenied ? 'text-amber-800' : 'text-blue-800'}`}>
          {label(permissionState, isHebrew, isGranted)}
        </p>
        <p className={`text-xs mt-0.5 ${isDenied ? 'text-amber-600' : 'text-blue-600'}`}>
          {isDenied
            ? (isHebrew
                ? 'כדי לקבל תוצאות בסביבתך, הפעל מיקום בהגדרות הדפדפן ורענן'
                : 'To see results near you, allow location in browser settings and refresh')
            : (isHebrew
                ? 'התאמה מדויקת לפי קרבה — ספקים ולקוחות בסביבה שלך. ניתן גם להזין כתובת ידנית.'
                : 'Precision proximity matching across the PetWash™ network. Typing an address works too.')
          }
        </p>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {!isDenied && (
          <Button
            size="sm"
            onClick={requestPermission}
            disabled={isRequesting}
            className="h-8 px-3 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
          >
            {isRequesting
              ? (isHebrew ? 'מחפש...' : 'Locating...')
              : (isHebrew ? 'הפעל GPS' : 'Enable GPS')
            }
          </Button>
        )}
        <button
          onClick={() => setDismissed(true)}
          className="text-gray-400 hover:text-gray-600 p-1 rounded"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
