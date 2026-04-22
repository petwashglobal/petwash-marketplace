import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { CloudRain, Wind, AlertTriangle, Thermometer, Sun, CloudSun, Droplets } from 'lucide-react';
import { useLanguage } from '@/lib/languageStore';

interface WeatherData {
  temperature: number;
  condition: string;
  conditionCode: number;
  humidity: number;
  windSpeed: number;
  precipitation: number;
  isAdverse: boolean;
  adverseReason?: string;
}

interface WeatherConsentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConsent: (customerConsent: boolean, acceptedConditions: string[]) => void;
  walkerName: string;
  scheduledDate: Date;
}

// Weather condition thresholds for adverse conditions
const ADVERSE_THRESHOLDS = {
  heavyRain: 5, // mm precipitation
  strongWind: 40, // km/h
  extremeHeat: 35, // °C
  extremeCold: 5, // °C
  dustStorm: true, // WMO code 77 or sand/dust conditions
};

// WMO Weather Codes
const ADVERSE_CODES = [
  45, 48, // Fog
  51, 53, 55, 56, 57, // Drizzle
  61, 63, 65, 66, 67, // Rain
  71, 73, 75, 77, // Snow
  80, 81, 82, // Rain showers
  85, 86, // Snow showers
  95, 96, 99, // Thunderstorm
];

const DUST_CODES = [77]; // Snow grains (often indicates dusty conditions in desert)

function getWeatherIcon(code: number) {
  if (code === 0) return <Sun className="h-6 w-6 text-amber-400" />;
  if (code <= 3) return <CloudSun className="h-6 w-6 text-slate-400" />;
  if (code >= 61 && code <= 67) return <CloudRain className="h-6 w-6 text-blue-500" />;
  if (code >= 80 && code <= 82) return <CloudRain className="h-6 w-6 text-blue-600" />;
  if (code >= 95) return <AlertTriangle className="h-6 w-6 text-red-500" />;
  return <Wind className="h-6 w-6 text-slate-500" />;
}

async function fetchWeatherForecast(date: Date): Promise<WeatherData> {
  const lat = 32.0853; // Tel Aviv default
  const lon = 34.7818;
  const dateStr = date.toISOString().split('T')[0];
  
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode&timezone=Asia/Jerusalem&start_date=${dateStr}&end_date=${dateStr}`
  );
  
  if (!response.ok) throw new Error('Weather fetch failed');
  
  const data = await response.json();
  const daily = data.daily;
  
  const avgTemp = (daily.temperature_2m_max[0] + daily.temperature_2m_min[0]) / 2;
  const precipitation = daily.precipitation_sum[0] || 0;
  const windSpeed = daily.windspeed_10m_max[0] || 0;
  const weatherCode = daily.weathercode[0] || 0;
  
  // Determine if conditions are adverse
  let isAdverse = false;
  let adverseReason = '';
  
  if (precipitation >= ADVERSE_THRESHOLDS.heavyRain) {
    isAdverse = true;
    adverseReason = 'heavy_rain';
  } else if (windSpeed >= ADVERSE_THRESHOLDS.strongWind) {
    isAdverse = true;
    adverseReason = 'strong_wind';
  } else if (avgTemp >= ADVERSE_THRESHOLDS.extremeHeat) {
    isAdverse = true;
    adverseReason = 'extreme_heat';
  } else if (avgTemp <= ADVERSE_THRESHOLDS.extremeCold) {
    isAdverse = true;
    adverseReason = 'extreme_cold';
  } else if (ADVERSE_CODES.includes(weatherCode)) {
    isAdverse = true;
    adverseReason = 'adverse_weather';
  } else if (DUST_CODES.includes(weatherCode)) {
    isAdverse = true;
    adverseReason = 'dust_storm';
  }
  
  // Hebrew condition names
  const conditionMap: Record<number, string> = {
    0: 'בהיר',
    1: 'בהיר בעיקרו',
    2: 'מעונן חלקית',
    3: 'מעונן',
    45: 'ערפל',
    48: 'ערפל קופא',
    51: 'טפטוף קל',
    53: 'טפטוף',
    55: 'טפטוף כבד',
    61: 'גשם קל',
    63: 'גשם',
    65: 'גשם כבד',
    71: 'שלג קל',
    73: 'שלג',
    75: 'שלג כבד',
    77: 'סופת אבק/חול',
    80: 'ממטרים קלים',
    81: 'ממטרים',
    82: 'ממטרים כבדים',
    95: 'סופת רעמים',
    96: 'סופת רעמים עם ברד',
    99: 'סופת רעמים חזקה',
  };
  
  return {
    temperature: Math.round(avgTemp),
    condition: conditionMap[weatherCode] || 'לא ידוע',
    conditionCode: weatherCode,
    humidity: 65, // Open-Meteo daily doesn't include humidity
    windSpeed: Math.round(windSpeed),
    precipitation: Math.round(precipitation * 10) / 10,
    isAdverse,
    adverseReason,
  };
}

export function WeatherConsentDialog({
  open,
  onOpenChange,
  onConsent,
  walkerName,
  scheduledDate,
}: WeatherConsentDialogProps) {
  const { language } = useLanguage();
  const isHebrew = language === 'he';
  const [customerAccepts, setCustomerAccepts] = useState(false);
  const [understandsRisks, setUnderstandsRisks] = useState(false);
  
  const { data: weather, isLoading } = useQuery({
    queryKey: ['weather-forecast', scheduledDate.toISOString().split('T')[0]],
    queryFn: () => fetchWeatherForecast(scheduledDate),
    enabled: open,
    staleTime: 30 * 60 * 1000, // 30 minutes
  });
  
  // Reset checkboxes when dialog opens
  useEffect(() => {
    if (open) {
      setCustomerAccepts(false);
      setUnderstandsRisks(false);
    }
  }, [open]);
  
  const adverseReasonText: Record<string, { he: string; en: string }> = {
    heavy_rain: { he: 'גשם כבד צפוי', en: 'Heavy rain expected' },
    strong_wind: { he: 'רוחות חזקות צפויות', en: 'Strong winds expected' },
    extreme_heat: { he: 'חום קיצוני צפוי', en: 'Extreme heat expected' },
    extreme_cold: { he: 'קור קיצוני צפוי', en: 'Extreme cold expected' },
    dust_storm: { he: 'סופת אבק/חול צפויה', en: 'Dust/sand storm expected' },
    adverse_weather: { he: 'תנאי מזג אוויר קשים', en: 'Adverse weather conditions' },
  };
  
  const canProceed = customerAccepts && understandsRisks;
  
  const handleConfirm = () => {
    const conditions = [];
    if (customerAccepts) conditions.push('customer_accepts_conditions');
    if (understandsRisks) conditions.push('understands_risks');
    if (weather?.adverseReason) conditions.push(`adverse_reason:${weather.adverseReason}`);
    conditions.push(`weather_temp:${weather?.temperature || 'unknown'}`);
    conditions.push(`weather_code:${weather?.conditionCode || 'unknown'}`);
    
    onConsent(true, conditions);
    onOpenChange(false);
  };
  
  const handleDecline = () => {
    onConsent(false, []);
    onOpenChange(false);
  };
  
  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="luxury-glass-card max-w-md" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="luxury-glass-card max-w-md border-amber-200/50" dir={(language === 'he' || language === 'ar') ? 'rtl' : 'ltr'}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
            {isHebrew ? 'התראת מזג אוויר' : 'Weather Advisory'}
          </DialogTitle>
          <DialogDescription className="text-slate-600">
            {isHebrew 
              ? 'נדרשת הסכמה לתנאי מזג האוויר הצפויים'
              : 'Consent required for expected weather conditions'}
          </DialogDescription>
        </DialogHeader>
        
        {/* Weather Info Card */}
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {weather && getWeatherIcon(weather.conditionCode)}
              <span className="font-medium text-slate-800">{weather?.condition}</span>
            </div>
            <div className="flex items-center gap-1 text-lg font-semibold text-slate-900">
              <Thermometer className="h-4 w-4 text-red-400" />
              {weather?.temperature}°C
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex items-center gap-1 text-slate-600">
              <Wind className="h-4 w-4" />
              {weather?.windSpeed} {isHebrew ? 'קמ״ש' : 'km/h'}
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <Droplets className="h-4 w-4" />
              {weather?.precipitation} {isHebrew ? 'מ״מ' : 'mm'}
            </div>
          </div>
          
          {weather?.isAdverse && weather.adverseReason && (
            <div className="mt-3 p-2 bg-amber-100 rounded-lg border border-amber-300">
              <p className="text-amber-800 font-medium text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" />
                {adverseReasonText[weather.adverseReason]?.[isHebrew ? 'he' : 'en'] || weather.adverseReason}
              </p>
            </div>
          )}
        </div>
        
        {/* Walker Note */}
        <div className="bg-blue-50 rounded-xl p-3 border border-blue-200">
          <p className="text-blue-800 text-sm">
            {isHebrew 
              ? `${walkerName} מוכן/ה להליכה בתנאים אלה. חלק מהמוליכים שלנו מתמחים בהליכות בכל מזג אוויר.`
              : `${walkerName} is willing to walk in these conditions. Some of our walkers specialize in all-weather walks.`}
          </p>
        </div>
        
        {/* Consent Checkboxes */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Checkbox
              id="customer-accepts"
              checked={customerAccepts}
              onCheckedChange={(checked) => setCustomerAccepts(checked === true)}
              className="mt-1"
            />
            <label htmlFor="customer-accepts" className="text-sm text-slate-700 cursor-pointer">
              {isHebrew 
                ? 'אני מסכים/ה שההליכה תתבצע בתנאי מזג האוויר הצפויים'
                : 'I agree that the walk will take place in the expected weather conditions'}
            </label>
          </div>
          
          <div className="flex items-start gap-3">
            <Checkbox
              id="understands-risks"
              checked={understandsRisks}
              onCheckedChange={(checked) => setUnderstandsRisks(checked === true)}
              className="mt-1"
            />
            <label htmlFor="understands-risks" className="text-sm text-slate-700 cursor-pointer">
              {isHebrew 
                ? 'אני מבין/ה שהמוליך/ה עשוי/ה לקצר את ההליכה או לשנות את המסלול בהתאם לתנאים בשטח'
                : 'I understand that the walker may shorten the walk or change the route based on actual conditions'}
            </label>
          </div>
        </div>
        
        <DialogFooter className="flex gap-2 pt-2">
          <Button
            variant="outline"
            onClick={handleDecline}
            className="flex-1"
          >
            {isHebrew ? 'בטל הזמנה' : 'Cancel Booking'}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!canProceed}
            className="flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
          >
            {isHebrew ? 'אישור והמשך' : 'Confirm & Continue'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Hook to check if weather consent is needed
export function useWeatherConsent(scheduledDate: Date | null) {
  return useQuery({
    queryKey: ['weather-consent-check', scheduledDate?.toISOString().split('T')[0]],
    queryFn: async () => {
      if (!scheduledDate) return { needsConsent: false };
      const weather = await fetchWeatherForecast(scheduledDate);
      return { 
        needsConsent: weather.isAdverse,
        weather
      };
    },
    enabled: !!scheduledDate,
    staleTime: 30 * 60 * 1000,
  });
}
