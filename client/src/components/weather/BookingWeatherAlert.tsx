import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CloudRain, Thermometer, Wind, CheckCircle2, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface BookingWeatherData {
  level: 'safe' | 'caution' | 'warning';
  icon: string;
  temperature: number;
  temperatureMin: number;
  conditionCode: number;
  condition: string;
  precipitationProbability: number;
  windSpeed: number;
  uvIndex: number;
  message: string;
  canProceed: boolean;
}

interface BookingWeatherAlertProps {
  lat?: number | string;
  lng?: number | string;
  date?: Date;
  lang?: string;
  className?: string;
}

export function BookingWeatherAlert({
  lat,
  lng,
  date,
  lang = 'en',
  className,
}: BookingWeatherAlertProps) {
  const dateStr = date ? date.toISOString().split('T')[0] : undefined;

  const params = new URLSearchParams({ lang });
  if (lat != null) params.set('lat', String(lat));
  if (lng != null) params.set('lng', String(lng));
  if (dateStr)     params.set('date', dateStr);

  const { data, isLoading } = useQuery<BookingWeatherData>({
    queryKey: ['/api/weather/booking-check', String(lat), String(lng), dateStr, lang],
    queryFn: async () => {
      const res = await fetch(`/api/weather/booking-check?${params.toString()}`);
      if (!res.ok) throw new Error('Weather check failed');
      return res.json();
    },
    staleTime: 15 * 60 * 1000,
    retry: 1,
    enabled: true,
  });

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-muted-foreground py-2', className)}>
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Checking weather conditions…</span>
      </div>
    );
  }

  if (!data) return null;

  const levelConfig = {
    safe: {
      bg: 'bg-emerald-50 border-emerald-200',
      text: 'text-emerald-800',
      sub: 'text-emerald-600',
      Icon: CheckCircle2,
      iconColor: 'text-emerald-600',
    },
    caution: {
      bg: 'bg-amber-50 border-amber-200',
      text: 'text-amber-900',
      sub: 'text-amber-700',
      Icon: AlertTriangle,
      iconColor: 'text-amber-500',
    },
    warning: {
      bg: 'bg-red-50 border-red-200',
      text: 'text-red-900',
      sub: 'text-red-700',
      Icon: CloudRain,
      iconColor: 'text-red-500',
    },
  }[data.level];

  return (
    <Alert className={cn('border', levelConfig.bg, className)}>
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5" aria-hidden="true">
          {data.icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className={cn('text-sm font-semibold mb-0.5', levelConfig.text)}>
            {data.level === 'safe'
              ? 'Weather looks great for your walk'
              : data.level === 'caution'
              ? 'Weather advisory for your booking'
              : 'Severe weather alert'}
          </p>
          <AlertDescription className={cn('text-sm', levelConfig.sub)}>
            {data.message}
          </AlertDescription>
          <div className={cn('flex items-center gap-4 mt-2 text-xs', levelConfig.sub)}>
            <span className="flex items-center gap-1">
              <Thermometer className="h-3 w-3" />
              {data.temperature}°C
            </span>
            <span className="flex items-center gap-1">
              <CloudRain className="h-3 w-3" />
              {data.precipitationProbability}% rain
            </span>
            <span className="flex items-center gap-1">
              <Wind className="h-3 w-3" />
              {data.windSpeed} km/h
            </span>
          </div>
          {data.level === 'warning' && (
            <p className={cn('text-xs mt-1.5 font-medium', levelConfig.text)}>
              You can still proceed — provider has final say.
            </p>
          )}
        </div>
      </div>
    </Alert>
  );
}
