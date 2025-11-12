import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Sun, 
  Cloud, 
  CloudRain, 
  CloudSnow, 
  Wind,
  Droplets,
  ThermometerSun,
  Calendar,
  MapPin,
  Sparkles,
  Star,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface DayForecast {
  date: string;
  dayOfWeek: string;
  temperature: {
    max: number;
    min: number;
  };
  weatherCode: number;
  condition: {
    condition: string;
    icon: string;
  };
  precipitationProbability: number;
  uvIndex: number;
  windSpeed: number;
  washScore: number;
  recommendation: {
    rating: 'excellent' | 'good' | 'moderate' | 'poor';
    emoji: string;
    title: string;
    message: string;
    color: string;
    action: string;
    priority: string;
  };
}

interface PlannerData {
  success: boolean;
  location: {
    city: string;
    country: string;
    formattedAddress: string;
  };
  forecast: DayForecast[];
  provider: string;
}

const RATING_GRADIENT = {
  excellent: 'from-emerald-500 via-green-400 to-teal-400',
  good: 'from-blue-500 via-cyan-400 to-sky-400',
  moderate: 'from-amber-500 via-yellow-400 to-orange-400',
  poor: 'from-red-500 via-rose-400 to-pink-400',
};

const getWeatherIcon = (code: number) => {
  if (code === 0 || code === 1) return <Sun className="w-12 h-12 text-yellow-400" />;
  if (code === 2 || code === 3) return <Cloud className="w-12 h-12 text-gray-400" />;
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return <CloudRain className="w-12 h-12 text-blue-400" />;
  if ([71, 73, 75, 85, 86].includes(code)) return <CloudSnow className="w-12 h-12 text-blue-200" />;
  return <Cloud className="w-12 h-12 text-gray-400" />;
};

export default function PetWashDayPlanner() {
  const [location, setLocation] = useState('Tel Aviv');
  const [searchInput, setSearchInput] = useState('Tel Aviv');

  const { data, isLoading, error } = useQuery<PlannerData>({
    queryKey: ['/api/weather/7-day-planner', location],
    enabled: !!location,
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setLocation(searchInput.trim());
    }
  };

  const bestWashDay = data?.forecast && data.forecast.length > 0
    ? data.forecast.reduce((best, day) => 
        day.washScore > best.washScore ? day : best
      , data.forecast[0])
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black text-white relative overflow-hidden">
      {/* Luxury Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.03) 10px, rgba(255,255,255,0.03) 20px)`
        }} />
      </div>

      {/* Animated Gradient Orbs (Chanel-style) */}
      <motion.div
        className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-amber-500/20 via-yellow-400/10 to-transparent rounded-full blur-3xl"
        animate={{
          scale: [1, 1.2, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />
      <motion.div
        className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-gradient-to-tr from-blue-500/20 via-cyan-400/10 to-transparent rounded-full blur-3xl"
        animate={{
          scale: [1.2, 1, 1.2],
          opacity: [0.2, 0.4, 0.2],
        }}
        transition={{ duration: 10, repeat: Infinity }}
      />

      <div className="relative z-10 container mx-auto px-4 py-12 max-w-7xl">
        {/* Luxury Header - Vogue Magazine Style */}
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="text-center mb-16 space-y-6"
        >
          <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-amber-400/30 bg-amber-400/10 backdrop-blur-sm">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-light tracking-[0.2em] text-amber-300 uppercase">
              Premium Weather Intelligence
            </span>
          </div>

          <h1 className="text-7xl md:text-8xl font-serif tracking-tight leading-none">
            <span className="bg-gradient-to-r from-white via-amber-100 to-white bg-clip-text text-transparent">
              Pet Wash™
            </span>
          </h1>
          
          <h2 className="text-3xl md:text-4xl font-light tracking-[0.15em] text-gray-300 uppercase">
            Day Planner
          </h2>

          <p className="text-gray-400 max-w-2xl mx-auto text-lg font-light leading-relaxed">
            Precision weather forecasting powered by Google Cloud™ for the ultimate luxury pet care experience
          </p>
        </motion.div>

        {/* Location Search - Minimalist Luxury */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="mb-12"
        >
          <form onSubmit={handleSearch} className="max-w-xl mx-auto">
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/20 via-yellow-400/20 to-amber-500/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-500" />
              <div className="relative flex items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-2 hover:border-amber-400/30 transition-all duration-300">
                <MapPin className="w-5 h-5 text-amber-400 ml-4" />
                <Input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Enter city name (e.g., Tel Aviv, New York)"
                  className="flex-1 bg-transparent border-none text-white placeholder:text-gray-500 focus-visible:ring-0 text-lg"
                  data-testid="input-location-search"
                />
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-medium rounded-xl px-8"
                  data-testid="button-search-weather"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </div>
          </form>
        </motion.div>

        {/* Loading State - Elegant Skeleton */}
        {isLoading && (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
              {[...Array(7)].map((_, i) => (
                <Skeleton key={i} className="h-64 bg-white/5 rounded-3xl" />
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md mx-auto text-center p-8 bg-red-500/10 border border-red-500/20 rounded-3xl backdrop-blur-xl"
          >
            <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Unable to Fetch Weather</h3>
            <p className="text-gray-400">Please check the location and try again</p>
          </motion.div>
        )}

        {/* Best Wash Day Highlight - Hero Section */}
        <AnimatePresence mode="wait">
          {data && bestWashDay && (
            <motion.div
              key="best-day"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -30 }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
              className="mb-16"
            >
              <div className="relative group">
                {/* Glow Effect */}
                <div className={`absolute inset-0 bg-gradient-to-r ${RATING_GRADIENT[bestWashDay.recommendation.rating]} opacity-20 blur-3xl rounded-[3rem] group-hover:opacity-30 transition-opacity duration-500`} />
                
                <Card className="relative bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-2xl border-2 border-white/20 rounded-[3rem] p-12 overflow-hidden">
                  {/* Pattern Overlay */}
                  <div className="absolute inset-0 opacity-5">
                    <div className="absolute inset-0" style={{
                      backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                      backgroundSize: '30px 30px'
                    }} />
                  </div>

                  <div className="relative z-10 text-center space-y-6">
                    <Badge className={`inline-flex items-center gap-2 px-6 py-2 bg-gradient-to-r ${RATING_GRADIENT[bestWashDay.recommendation.rating]} text-black font-semibold text-lg rounded-full`}>
                      <Star className="w-5 h-5" fill="currentColor" />
                      BEST WASH DAY
                    </Badge>

                    <h3 className="text-5xl font-serif tracking-tight">
                      {bestWashDay.dayOfWeek}
                    </h3>

                    <div className="flex items-center justify-center gap-6 text-6xl">
                      {getWeatherIcon(bestWashDay.weatherCode)}
                      <div className="text-8xl font-light">
                        {bestWashDay.temperature.max}°
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-3xl font-light text-amber-300">
                        {bestWashDay.recommendation.title}
                      </div>
                      <p className="text-xl text-gray-300 max-w-2xl mx-auto font-light">
                        {bestWashDay.recommendation.message}
                      </p>
                    </div>

                    <div className="flex items-center justify-center gap-8 pt-6 border-t border-white/10">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-amber-400">
                          {bestWashDay.washScore}
                        </div>
                        <div className="text-sm text-gray-400 uppercase tracking-wider">
                          Wash Score
                        </div>
                      </div>
                      <div className="h-12 w-px bg-white/10" />
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-400">
                          {bestWashDay.uvIndex}
                        </div>
                        <div className="text-sm text-gray-400 uppercase tracking-wider">
                          UV Index
                        </div>
                      </div>
                      <div className="h-12 w-px bg-white/10" />
                      <div className="text-center">
                        <div className="text-3xl font-bold text-cyan-400">
                          {bestWashDay.precipitationProbability}%
                        </div>
                        <div className="text-sm text-gray-400 uppercase tracking-wider">
                          Rain Chance
                        </div>
                      </div>
                    </div>

                    <Button
                      className="mt-8 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-black font-semibold px-12 py-6 text-lg rounded-2xl shadow-2xl shadow-amber-500/20"
                      data-testid="button-book-best-day"
                    >
                      <Calendar className="w-5 h-5 mr-2" />
                      Book This Premium Wash Day
                    </Button>
                  </div>
                </Card>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 7-Day Forecast - Fashion Magazine Grid */}
        <AnimatePresence mode="wait">
          {data && (
            <motion.div
              key="forecast"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 1 }}
            >
              <div className="text-center mb-10">
                <h3 className="text-3xl font-serif tracking-wide mb-2">
                  7-Day Forecast
                </h3>
                <p className="text-gray-400 font-light flex items-center justify-center gap-2">
                  <MapPin className="w-4 h-4" />
                  {data.location.formattedAddress}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-7 gap-6">
                {data.forecast.map((day, index) => (
                  <motion.div
                    key={day.date}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 * index, duration: 0.6 }}
                    className="relative group"
                    data-testid={`forecast-day-${index}`}
                  >
                    {/* Glow on hover */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${RATING_GRADIENT[day.recommendation.rating]} opacity-0 group-hover:opacity-20 blur-2xl rounded-3xl transition-opacity duration-500`} />
                    
                    <Card className="relative bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/10 group-hover:border-amber-400/30 rounded-3xl p-6 h-full transition-all duration-500 hover:scale-105">
                      {/* Day Name */}
                      <div className="text-center mb-6">
                        <div className="text-sm font-light text-gray-400 uppercase tracking-widest mb-1">
                          {day.dayOfWeek.slice(0, 3)}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>

                      {/* Weather Icon */}
                      <div className="flex justify-center mb-4">
                        {getWeatherIcon(day.weatherCode)}
                      </div>

                      {/* Temperature */}
                      <div className="text-center mb-6">
                        <div className="text-4xl font-light mb-1">
                          {day.temperature.max}°
                        </div>
                        <div className="text-sm text-gray-500">
                          {day.temperature.min}°
                        </div>
                      </div>

                      {/* Wash Score Badge */}
                      <div className="flex justify-center mb-4">
                        <Badge className={`bg-gradient-to-r ${RATING_GRADIENT[day.recommendation.rating]} text-black font-semibold px-4 py-1.5 rounded-full text-sm`}>
                          <TrendingUp className="w-3 h-3 mr-1" />
                          {day.washScore}
                        </Badge>
                      </div>

                      {/* Status Icon */}
                      <div className="flex justify-center mb-3">
                        {day.recommendation.rating === 'excellent' && (
                          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                        )}
                        {day.recommendation.rating === 'good' && (
                          <CheckCircle2 className="w-6 h-6 text-blue-400" />
                        )}
                        {day.recommendation.rating === 'moderate' && (
                          <AlertTriangle className="w-6 h-6 text-amber-400" />
                        )}
                        {day.recommendation.rating === 'poor' && (
                          <XCircle className="w-6 h-6 text-red-400" />
                        )}
                      </div>

                      {/* Condition */}
                      <p className="text-center text-xs text-gray-400 mb-4 font-light">
                        {day.condition.condition}
                      </p>

                      {/* Details */}
                      <div className="space-y-2 text-xs">
                        <div className="flex items-center justify-between text-gray-400">
                          <span className="flex items-center gap-1">
                            <Droplets className="w-3 h-3" />
                            Rain
                          </span>
                          <span className="font-medium">{day.precipitationProbability}%</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-400">
                          <span className="flex items-center gap-1">
                            <ThermometerSun className="w-3 h-3" />
                            UV
                          </span>
                          <span className="font-medium">{day.uvIndex}</span>
                        </div>
                        <div className="flex items-center justify-between text-gray-400">
                          <span className="flex items-center gap-1">
                            <Wind className="w-3 h-3" />
                            Wind
                          </span>
                          <span className="font-medium">{day.windSpeed.toFixed(1)} km/h</span>
                        </div>
                      </div>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Luxury Footer */}
        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 1 }}
            className="text-center mt-16 space-y-4"
          >
            <div className="inline-flex items-center gap-2 px-6 py-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="text-xs font-light tracking-[0.2em] text-gray-400 uppercase">
                Powered by Google Weather API™
              </span>
            </div>
            <p className="text-gray-600 text-xs max-w-md mx-auto font-light leading-relaxed">
              Professional meteorological intelligence for discerning pet parents. 
              Data sourced from {data.provider === 'google' ? 'Google Cloud Weather' : 'Open-Meteo'}.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
