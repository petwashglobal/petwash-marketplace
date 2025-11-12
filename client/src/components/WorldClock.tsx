import { useState, useEffect } from "react";
import { Clock, Globe } from "lucide-react";
import { SUPPORTED_LANGUAGES } from "@shared/languages";

interface WorldClockProps {
  showMultiple?: boolean; // Show multiple time zones
  compact?: boolean;      // Compact mode for header
}

export function WorldClock({ showMultiple = false, compact = false }: WorldClockProps) {
  const [times, setTimes] = useState<Record<string, string>>({});
  const [dates, setDates] = useState<Record<string, string>>({});

  useEffect(() => {
    const updateTimes = () => {
      const newTimes: Record<string, string> = {};
      const newDates: Record<string, string> = {};

      Object.entries(SUPPORTED_LANGUAGES).forEach(([code, config]) => {
        const now = new Date();
        
        // Format time
        newTimes[code] = new Intl.DateTimeFormat(code, {
          timeZone: config.timezone,
          hour: '2-digit',
          minute: '2-digit',
          second: showMultiple ? undefined : '2-digit',
          hour12: config.timeFormat === '12h',
        }).format(now);

        // Format date
        newDates[code] = new Intl.DateTimeFormat(code, {
          timeZone: config.timezone,
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'short',
        }).format(now);
      });

      setTimes(newTimes);
      setDates(newDates);
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);

    return () => clearInterval(interval);
  }, [showMultiple]);

  if (compact) {
    // Compact mode for dashboard header (show user's timezone only)
    const userLang = localStorage.getItem('language') || 'he';
    const config = SUPPORTED_LANGUAGES[userLang as keyof typeof SUPPORTED_LANGUAGES] || SUPPORTED_LANGUAGES.he;
    
    return (
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <Clock className="h-4 w-4" />
        <span className="font-mono">{times[userLang]}</span>
        <span className="hidden md:inline">•</span>
        <span className="hidden md:inline">{dates[userLang]}</span>
      </div>
    );
  }

  if (!showMultiple) {
    // Single timezone (user's current)
    const userLang = localStorage.getItem('language') || 'he';
    const config = SUPPORTED_LANGUAGES[userLang as keyof typeof SUPPORTED_LANGUAGES] || SUPPORTED_LANGUAGES.he;
    
    return (
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
            <Clock className="h-6 w-6 text-white" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">
              {config.country} {config.flag}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {config.timezone}
            </p>
          </div>
        </div>
        
        <div className="text-center">
          <div className="text-4xl font-bold font-mono text-gray-900 dark:text-white mb-2">
            {times[userLang]}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {dates[userLang]}
          </div>
        </div>
      </div>
    );
  }

  // Multiple timezones grid
  const priorityCountries = ['he', 'en', 'ar', 'ru', 'fr', 'es']; // Show top 6

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-800">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl">
          <Globe className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">
          World Clock
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {priorityCountries.map((code) => {
          const config = SUPPORTED_LANGUAGES[code as keyof typeof SUPPORTED_LANGUAGES];
          if (!config) return null;

          return (
            <div
              key={code}
              className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{config.flag}</span>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    {config.country}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {config.timezone.split('/')[1]}
                  </p>
                </div>
              </div>
              
              <div className="text-2xl font-mono font-bold text-gray-900 dark:text-white">
                {times[code]}
              </div>
              
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {dates[code]?.split(',')[0]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
