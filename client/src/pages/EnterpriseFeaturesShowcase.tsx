import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LuxuryPageWrapper } from '@/components/LuxuryThemeWrapper';
import { Link } from 'wouter';
import {
  Cloud,
  Droplets,
  Wind,
  ThermometerSun,
  Map,
  FileSpreadsheet,
  Brain,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Sparkles,
  Globe,
  BarChart3,
  Leaf,
  Sun,
  Calendar,
  ExternalLink,
  Loader2,
} from 'lucide-react';

export default function EnterpriseFeaturesShowcase() {
  const [selectedCity, setSelectedCity] = useState('Tel Aviv');

  // Demo: Fetch REAL current weather data
  const { data: currentWeatherData, isLoading: weatherLoading, isError: weatherError } = useQuery({
    queryKey: [`/api/weather/forecast?location=${encodeURIComponent(selectedCity)}`],
    enabled: !!selectedCity,
  });

  // Demo: Fetch REAL 7-day forecast
  const { data: forecastData, isLoading: forecastLoading, isError: forecastError } = useQuery({
    queryKey: [`/api/weather/7-day-planner?location=${encodeURIComponent(selectedCity)}&lang=en`],
    enabled: !!selectedCity,
  });

  // Demo: Fetch REAL air quality data
  const { data: airQualityResponse, isLoading: aqiLoading, isError: aqiError } = useQuery({
    queryKey: ['/api/environment/air-quality?lat=32.0853&lng=34.7818'], // Tel Aviv coordinates
  });

  const features = {
    weather: {
      title: 'Multi-Source Weather System',
      icon: <Cloud className="w-6 h-6" />,
      description: '13,000+ API calls/day capacity across 4 premium weather sources',
      sources: [
        { name: 'Open-Meteo', capacity: '10,000 calls/day', status: 'Primary', color: 'default' },
        { name: 'OpenWeatherMap', capacity: '1,000 calls/day', status: 'Backup', color: 'secondary' },
        { name: 'WeatherAPI.com', capacity: '1,000 calls/day', status: 'Alerts', color: 'destructive' },
        { name: 'Visual Crossing', capacity: '1,000 calls/day', status: 'Historical', color: 'outline' },
      ],
      features: [
        '7-14 day forecasts',
        'Hourly predictions',
        'Real-time alerts',
        'Historical analytics',
        'Pet wash recommendations',
      ],
    },
    environment: {
      title: 'Smart Environment Monitoring',
      icon: <Leaf className="w-6 h-6" />,
      description: 'Google Air Quality + Pollen API with Gemini AI insights',
      capabilities: [
        '70+ AQI indexes worldwide',
        'PM2.5, PM10, NO₂, CO, SO₂, O₃ tracking',
        '5-day pollen forecasts',
        '15+ plant species allergen warnings',
        'Gemini 2.5 Flash pet safety recommendations',
      ],
    },
  };

  const getWeatherIcon = (condition: string) => {
    const lower = condition?.toLowerCase() || '';
    if (lower.includes('rain')) return '🌧️';
    if (lower.includes('cloud')) return '☁️';
    if (lower.includes('sun') || lower.includes('clear')) return '☀️';
    if (lower.includes('snow')) return '❄️';
    return '🌤️';
  };

  const getAQIStatus = (aqi: number) => {
    if (aqi <= 50) return { label: 'Good', color: 'bg-green-500', text: 'Excellent for pet activities' };
    if (aqi <= 100) return { label: 'Moderate', color: 'bg-yellow-500', text: 'Acceptable for most pets' };
    if (aqi <= 150) return { label: 'Unhealthy (Sensitive)', color: 'bg-orange-500', text: 'Limit outdoor time' };
    if (aqi <= 200) return { label: 'Unhealthy', color: 'bg-red-500', text: 'Avoid outdoor activities' };
    return { label: 'Very Unhealthy', color: 'bg-purple-500', text: 'Keep pets indoors' };
  };

  return (
    <LuxuryPageWrapper
      variant="dashboard"
      title="🌟 Enterprise Features Showcase"
      subtitle="Production-ready APIs & integrations powering ⁦Pet Wash™⁩ global platform"
    >
      <div className="luxury-bg-mesh p-8 md:p-12 space-y-8">
        {/* Hero Section */}
        <div className="text-center luxury-animate-fade-in mb-8">
          <h1 className="luxury-heading-xl mb-4">
            Enterprise-Grade APIs
          </h1>
          <p className="luxury-text-body max-w-3xl mx-auto">
            Production-ready integrations powering ⁦Pet Wash™⁩ global platform with real-time data and AI insights
          </p>
        </div>

        {/* Hero Stats */}
        <div className="luxury-grid-4 luxury-gap-md">
          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md luxury-animate-slide-up luxury-delay-1 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center luxury-shadow-lg">
                <Cloud className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="luxury-text-small">Weather Capacity</p>
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">13,000+</div>
            <p className="luxury-text-small mt-1">API calls/day</p>
          </div>
          
          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md luxury-animate-slide-up luxury-delay-2 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center luxury-shadow-lg">
                <Leaf className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="luxury-text-small">AQI Coverage</p>
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">70+</div>
            <p className="luxury-text-small mt-1">Air quality indexes</p>
          </div>
          
          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md luxury-animate-slide-up luxury-delay-3 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-400 to-violet-600 flex items-center justify-center luxury-shadow-lg">
                <FileSpreadsheet className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="luxury-text-small">Form Tracking</p>
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">9</div>
            <p className="luxury-text-small mt-1">Platforms integrated</p>
          </div>
          
          <div className="luxury-glass-card luxury-hover-glow luxury-shadow-md luxury-animate-slide-up luxury-delay-4 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center luxury-shadow-lg">
                <Brain className="w-7 h-7 text-white" />
              </div>
              <div>
                <p className="luxury-text-small">AI Insights</p>
              </div>
            </div>
            <div className="luxury-heading-lg luxury-text-gradient">Gemini 2.5</div>
            <p className="luxury-text-small mt-1">Flash powered</p>
          </div>
        </div>

        {/* Main Features Tabs */}
        <Tabs defaultValue="weather" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 lg:grid-cols-6">
            <TabsTrigger value="weather" data-testid="tab-weather">Weather</TabsTrigger>
            <TabsTrigger value="environment" data-testid="tab-environment">Environment</TabsTrigger>
            <TabsTrigger value="maps" data-testid="tab-maps">Maps</TabsTrigger>
            <TabsTrigger value="sheets" data-testid="tab-sheets">Sheets</TabsTrigger>
            <TabsTrigger value="planners" data-testid="tab-planners">Planners</TabsTrigger>
            <TabsTrigger value="ai" data-testid="tab-ai">AI</TabsTrigger>
          </TabsList>

          {/* Weather Tab - SHOW REAL DATA */}
          <TabsContent value="weather" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center luxury-shadow-lg">
                  {features.weather.icon}
                </div>
                <div>
                  <h2 className="luxury-heading-md">{features.weather.title}</h2>
                  <p className="luxury-text-body mt-1">{features.weather.description}</p>
                </div>
              </div>
              
              <div className="space-y-6">
                {/* Weather Sources */}
                <div>
                  <h3 className="luxury-heading-sm mb-4">Premium Weather Sources</h3>
                  <div className="luxury-grid-2 luxury-gap-sm">
                    {features.weather.sources.map((source, index) => (
                      <div key={source.name} className={`luxury-glass-panel luxury-hover-lift p-4 luxury-animate-fade-in luxury-delay-${index + 1}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-gray-900 dark:text-gray-100">{source.name}</h4>
                            <p className="luxury-text-small mt-1">{source.capacity}</p>
                          </div>
                          <Badge variant={source.color as any}>{source.status}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* LIVE WEATHER DATA - VISIBLE TO PARTNERS */}
                <div className="luxury-glass-card luxury-shadow-xl p-6 bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/50 dark:to-cyan-950/50">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-cyan-600 flex items-center justify-center luxury-shadow-lg">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="luxury-heading-md">
                      🌍 Live Weather Data - {selectedCity}
                    </h3>
                  </div>

                  {(weatherLoading || forecastLoading) && (
                    <div className="flex items-center gap-2 text-blue-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Fetching real-time weather data...</span>
                    </div>
                  )}

                  {currentWeatherData?.success && currentWeatherData?.weather ? (
                    <div className="space-y-6">
                      {/* Current Weather */}
                      <div className="luxury-glass-minimal p-6">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="luxury-text-small mb-2">Current Conditions</p>
                            <p className="luxury-heading-xl">
                              {Math.round(currentWeatherData.weather.temperature)}°C
                            </p>
                            <p className="luxury-text-body mt-2">{currentWeatherData.weather.condition}</p>
                          </div>
                          <div className="text-7xl">
                            {getWeatherIcon(currentWeatherData.weather.condition)}
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-4 mt-6">
                          <div className="luxury-glass-panel p-3 text-center">
                            <Droplets className="w-5 h-5 mx-auto mb-2 text-blue-500" />
                            <p className="luxury-text-small">{currentWeatherData.weather.humidity}%</p>
                            <p className="text-xs text-muted-foreground">Humidity</p>
                          </div>
                          <div className="luxury-glass-panel p-3 text-center">
                            <Wind className="w-5 h-5 mx-auto mb-2 text-gray-500" />
                            <p className="luxury-text-small">{currentWeatherData.weather.windSpeed}</p>
                            <p className="text-xs text-muted-foreground">km/h</p>
                          </div>
                          <div className="luxury-glass-panel p-3 text-center">
                            <ThermometerSun className="w-5 h-5 mx-auto mb-2 text-orange-500" />
                            <p className="luxury-text-small">{Math.round(currentWeatherData.weather.feelsLike)}°C</p>
                            <p className="text-xs text-muted-foreground">Feels Like</p>
                          </div>
                        </div>
                      </div>

                      {/* 7-Day Forecast */}
                      {forecastData?.success && forecastData?.forecast && forecastData.forecast.length > 0 ? (
                        <div>
                          <h4 className="luxury-heading-sm mb-4">
                            7-Day Forecast
                          </h4>
                          <div className="grid gap-3 grid-cols-2 md:grid-cols-7">
                            {forecastData.forecast.slice(0, 7).map((day: any, index: number) => (
                              <div key={index} className={`luxury-glass-panel luxury-hover-lift p-4 text-center luxury-animate-scale-in luxury-delay-${index + 1}`}>
                                <p className="luxury-text-small font-semibold mb-2">
                                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                </p>
                                <div className="text-3xl my-3">
                                  {day.condition?.icon || getWeatherIcon(day.condition?.condition || '')}
                                </div>
                                <p className="luxury-text-gradient font-bold text-lg">
                                  {Math.round(day.temperature?.max || 0)}°
                                </p>
                                <p className="luxury-text-small">
                                  {Math.round(day.temperature?.min || 0)}°
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : forecastLoading ? null : (
                        <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                          <CardContent className="p-4 text-center">
                            <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                            <p className="text-sm text-amber-700 dark:text-amber-300">
                              7-day forecast unavailable. Location may not be supported or API credentials needed.
                            </p>
                          </CardContent>
                        </Card>
                      )}

                      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                        <CheckCircle2 className="w-4 h-4" />
                        ✅ Multi-source aggregation active | Data refreshed every 15 minutes
                      </div>
                    </div>
                  ) : !weatherLoading && weatherError ? (
                    <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                      <CardContent className="p-4 text-center">
                        <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                        <p className="text-sm text-red-700 dark:text-red-300">
                          Weather API error. Please check backend configuration and API keys.
                        </p>
                      </CardContent>
                    </Card>
                  ) : !weatherLoading ? (
                    <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                      <CardContent className="p-4 text-center">
                        <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                        <p className="text-sm text-amber-700 dark:text-amber-300">
                          No weather data available for "{selectedCity}". Try a different location or check API configuration.
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Environment Tab - SHOW REAL AQI DATA */}
          <TabsContent value="environment" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center luxury-shadow-lg">
                  {features.environment.icon}
                </div>
                <div>
                  <h2 className="luxury-heading-md">{features.environment.title}</h2>
                  <p className="luxury-text-body mt-1">{features.environment.description}</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="luxury-grid-2 luxury-gap-sm">
                  {features.environment.capabilities.map((cap, index) => (
                    <div key={cap} className={`flex items-center gap-3 luxury-glass-panel p-3 luxury-animate-fade-in luxury-delay-${index + 1}`}>
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                      <span className="luxury-text-small">{cap}</span>
                    </div>
                  ))}
                </div>

                {/* LIVE AIR QUALITY DATA - VISIBLE TO PARTNERS */}
                <div className="luxury-glass-card luxury-shadow-xl p-6 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/50 dark:to-emerald-950/50">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center luxury-shadow-lg">
                      <Leaf className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="luxury-heading-md">
                      🌿 Live Air Quality - Tel Aviv
                    </h3>
                  </div>

                  {aqiLoading && (
                    <div className="flex items-center gap-2 text-green-700">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Fetching real-time air quality data...</span>
                    </div>
                  )}

                  {airQualityResponse?.success && airQualityResponse?.data?.aqi ? (
                    <div className="space-y-6">
                      {/* AQI Score */}
                      <div className="luxury-glass-minimal p-6">
                        <div className="flex items-center justify-between mb-6">
                          <div>
                            <p className="luxury-text-small mb-2">Air Quality Index (US EPA)</p>
                            <p className="luxury-heading-xl">
                              {airQualityResponse.data.aqi}
                            </p>
                            <p className="luxury-text-small mt-2">
                              Dominant: {airQualityResponse.data.dominantPollutant}
                            </p>
                          </div>
                          <div className={`w-20 h-20 rounded-full ${getAQIStatus(airQualityResponse.data.aqi).color} flex items-center justify-center luxury-shadow-xl`}>
                            <span className="text-3xl text-white font-bold">
                              {getAQIStatus(airQualityResponse.data.aqi).label.charAt(0)}
                            </span>
                          </div>
                        </div>
                        <div className="luxury-badge mb-3">
                          {airQualityResponse.data.category}
                        </div>
                        <p className="luxury-text-body">
                          {airQualityResponse.data.healthRecommendations?.generalPopulation || getAQIStatus(airQualityResponse.data.aqi).text}
                        </p>
                      </div>

                      {/* Pollutants Breakdown */}
                      {airQualityResponse.data.pollutants && (
                        <div className="luxury-grid-3 luxury-gap-sm">
                          {Object.entries(airQualityResponse.data.pollutants)
                            .filter(([_, value]) => value != null)
                            .slice(0, 6)
                            .map(([pollutant, value]: [string, any], index: number) => (
                            <div key={pollutant} className={`luxury-glass-panel luxury-hover-lift p-4 text-center luxury-animate-scale-in luxury-delay-${index + 1}`}>
                              <p className="luxury-text-small font-semibold mb-2">{pollutant.toUpperCase()}</p>
                              <p className="luxury-heading-md luxury-text-gradient">
                                {typeof value === 'number' ? value.toFixed(1) : 'N/A'}
                              </p>
                              <p className="luxury-text-small mt-1">
                                μg/m³
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                        <CheckCircle2 className="w-4 h-4" />
                        ✅ Google Air Quality API | Data updated hourly
                      </div>
                    </div>
                  ) : !aqiLoading && aqiError ? (
                    <Card className="bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800">
                      <CardContent className="p-4 text-center">
                        <AlertTriangle className="w-6 h-6 text-red-600 mx-auto mb-2" />
                        <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                          Air Quality API Error
                        </p>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                          Please check Google Air Quality API credentials and configuration.
                        </p>
                      </CardContent>
                    </Card>
                  ) : !aqiLoading ? (
                    <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                      <CardContent className="p-4 text-center">
                        <AlertTriangle className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                        <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                          Air Quality Data Unavailable
                        </p>
                        <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                          This location may not be covered by Google Air Quality API, or credentials may need to be configured.
                        </p>
                      </CardContent>
                    </Card>
                  ) : null}
                </div>

                {/* API Endpoints */}
                <div className="luxury-glass-panel p-6">
                  <h3 className="luxury-heading-sm mb-4">Active Endpoints</h3>
                  <div className="space-y-2 font-mono text-sm">
                    <div className="luxury-text-small">✅ GET /api/environment/air-quality</div>
                    <div className="luxury-text-small">✅ GET /api/environment/pollen</div>
                    <div className="luxury-text-small">✅ GET /api/environment/insights</div>
                    <div className="luxury-text-small">✅ GET /api/environment/combined</div>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Maps Tab */}
          <TabsContent value="maps" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-pink-600 flex items-center justify-center luxury-shadow-lg">
                  <Map className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="luxury-heading-md">Google Maps Integration</h2>
                  <p className="luxury-text-body mt-1">Location services, geocoding, and places autocomplete</p>
                </div>
              </div>
              
              <div className="luxury-grid-2 luxury-gap-sm mb-6">
                {['Google Maps Places API', 'Geocoding & reverse geocoding', 'Places autocomplete UI component', 'Route planning', 'Station location mapping'].map((feature, index) => (
                  <div key={feature} className={`flex items-center gap-3 luxury-glass-panel p-3 luxury-animate-fade-in luxury-delay-${index + 1}`}>
                    <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span className="luxury-text-small">{feature}</span>
                  </div>
                ))}
              </div>

              {/* Sample Integration */}
              <div className="luxury-glass-card luxury-shadow-xl p-6 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/50 dark:to-pink-950/50">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center luxury-shadow-lg">
                    <Map className="w-6 h-6 text-white" />
                  </div>
                  <h4 className="luxury-heading-sm">
                    🗺️ Google Places Autocomplete
                  </h4>
                </div>
                <div className="luxury-glass-minimal p-4 mb-4">
                  <p className="luxury-text-small mb-3">Component used in:</p>
                  <ul className="luxury-text-body space-y-2">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      Gift card delivery addresses
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      Booking location inputs
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      Station finder
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-purple-600 flex-shrink-0" />
                      Service area validation
                    </li>
                  </ul>
                </div>
                <div className="luxury-glass-panel p-3 font-mono text-xs">
                  📁 client/src/components/ui/google-places-autocomplete.tsx
                </div>
              </div>
              
              <div className="luxury-glass-panel p-6">
                <h3 className="luxury-heading-sm mb-4">Integration Files</h3>
                <div className="space-y-2 font-mono text-sm">
                  <div className="luxury-text-small">📁 server/services/location/MapsService.ts</div>
                  <div className="luxury-text-small">📁 server/services/googleMapsPlaces.ts</div>
                  <div className="luxury-text-small">📁 client/src/components/ui/google-places-autocomplete.tsx</div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Sheets Tab */}
          <TabsContent value="sheets" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-violet-600 flex items-center justify-center luxury-shadow-lg">
                  <FileSpreadsheet className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="luxury-heading-md">Google Sheets Integration</h2>
                  <p className="luxury-text-body mt-1">Centralized form submission tracking across all 9 platforms</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div>
                  <h3 className="luxury-heading-sm mb-4">Tracked Form Submissions (9 Platforms)</h3>
                  <div className="luxury-grid-2 luxury-gap-sm">
                    {['K9000 Wash Bookings', 'Sitter Suite Bookings', 'Walk My Pet Bookings', 'PetTrek Bookings', 'Academy Bookings', 'Contact & Inquiries', 'Feedback & Reviews', 'Newsletter Subscriptions', 'Franchise Inquiries'].map((platform, index) => (
                      <div key={platform} className={`flex items-center gap-3 luxury-glass-panel p-3 luxury-animate-fade-in luxury-delay-${index % 5 + 1}`}>
                        <FileSpreadsheet className="w-5 h-5 text-purple-600 flex-shrink-0" />
                        <span className="luxury-text-small">{platform}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="luxury-glass-card luxury-shadow-xl p-6 bg-gradient-to-br from-purple-50/50 to-violet-50/50 dark:from-purple-950/50 dark:to-violet-950/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-violet-600 flex items-center justify-center luxury-shadow-lg">
                      <BarChart3 className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="luxury-heading-sm">
                      Automatic Data Collection
                    </h4>
                  </div>
                  <p className="luxury-text-body mb-4">
                    All form submissions are automatically logged to Google Sheets with timestamps, user info, and submission details for easy management and analysis.
                  </p>
                  <div className="luxury-glass-minimal p-4 font-mono text-sm">
                    📊 Real-time sync | No manual data entry | Centralized analytics
                  </div>
                </div>

                <div className="luxury-glass-panel p-4 font-mono text-sm">
                  📁 server/services/googleSheetsIntegration.ts (425 lines)
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Planners Tab */}
          <TabsContent value="planners" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center luxury-shadow-lg">
                  <Calendar className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="luxury-heading-md">Weather Planner Suite</h2>
                  <p className="luxury-text-body mt-1">Role-aware weather planning with AI recommendations</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="luxury-grid-2 luxury-gap-sm">
                  {[
                    { name: 'Public View', route: '/weather-planner', desc: 'General 7-day forecasts' },
                    { name: 'Client View', route: '/pet-care-planner', desc: 'Pet wash scheduling + loyalty' },
                    { name: 'Employee View', route: '/weather-planner', desc: 'Station-specific forecasts' },
                    { name: 'Executive View', route: '/weather-planner', desc: 'Franchise-wide analytics' },
                    { name: 'Day Planner', route: '/pet-wash-day-planner', desc: 'Best wash day finder' },
                  ].map((view, index) => (
                    <Link key={view.route} href={view.route}>
                      <div className={`luxury-glass-panel luxury-hover-lift cursor-pointer p-5 luxury-animate-scale-in luxury-delay-${index + 1}`} data-testid={`link-${view.name.toLowerCase().replace(/\s+/g, '-')}`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="luxury-heading-sm text-sm mb-1">{view.name}</h4>
                            <p className="luxury-text-small">{view.desc}</p>
                          </div>
                          <ExternalLink className="w-5 h-5 text-purple-600" />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                <div className="luxury-glass-card luxury-shadow-xl p-6 bg-gradient-to-br from-amber-50/50 to-yellow-50/50 dark:from-amber-950/50 dark:to-yellow-950/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center luxury-shadow-lg">
                      <Globe className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="luxury-heading-sm">
                      Multi-Language Support
                    </h4>
                  </div>
                  <p className="luxury-text-body mb-4">
                    All weather planners support 6 languages with RTL layouts:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['English', 'Hebrew', 'Arabic', 'Russian', 'French', 'Spanish'].map((lang) => (
                      <div key={lang} className="luxury-badge">{lang}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-6">
            <div className="luxury-glass-card luxury-shadow-xl p-8">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center luxury-shadow-lg">
                  <Brain className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h2 className="luxury-heading-md">Gemini AI Integration</h2>
                  <p className="luxury-text-body mt-1">Gemini 2.5 Flash for pet care insights and recommendations</p>
                </div>
              </div>
              
              <div className="space-y-6">
                <div className="luxury-grid-2 luxury-gap-sm">
                  {['Pet safety recommendations', 'Environmental risk analysis', 'Wash timing optimization', 'Allergen warnings', 'Activity planning'].map((feature, index) => (
                    <div key={feature} className={`flex items-center gap-3 luxury-glass-panel p-3 luxury-animate-fade-in luxury-delay-${index + 1}`}>
                      <Brain className="w-5 h-5 text-purple-600 flex-shrink-0" />
                      <span className="luxury-text-small">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Sample AI Output */}
                <div className="luxury-glass-card luxury-shadow-xl p-6 bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/50 dark:to-pink-950/50">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-600 flex items-center justify-center luxury-shadow-lg">
                      <Sparkles className="w-6 h-6 text-white" />
                    </div>
                    <h4 className="luxury-heading-sm">
                      Sample AI Recommendation
                    </h4>
                  </div>
                  <div className="luxury-glass-minimal p-5">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                          <p className="luxury-heading-sm text-sm mb-1">High Pollen Alert</p>
                          <p className="luxury-text-small">
                            Grass pollen levels are high today. Consider indoor washing for pets with allergies.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center flex-shrink-0">
                          <CheckCircle2 className="w-5 h-5 text-green-600" />
                        </div>
                        <div>
                          <p className="luxury-heading-sm text-sm mb-1">Optimal Wash Time</p>
                          <p className="luxury-text-small">
                            Best time: 2-4 PM when air quality is good and temperature is ideal for drying.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center flex-shrink-0">
                          <Sun className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="luxury-heading-sm text-sm mb-1">UV Protection</p>
                          <p className="luxury-text-small">
                            UV index is moderate. Safe for outdoor activities but consider shade for light-colored pets.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="luxury-glass-panel p-6">
                  <h4 className="luxury-heading-sm mb-3">
                    Gemini 2.5 Flash Integration
                  </h4>
                  <p className="luxury-text-body">
                    Advanced AI analyzes environmental conditions (weather, air quality, pollen) to provide personalized pet care recommendations, safety warnings, and activity planning.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Documentation Links */}
        <div className="luxury-glass-card luxury-shadow-xl p-8 luxury-animate-fade-in">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center luxury-shadow-lg">
              <FileSpreadsheet className="w-7 h-7 text-white" />
            </div>
            <h2 className="luxury-heading-md">Production Documentation</h2>
          </div>
          <div className="luxury-grid-2 luxury-gap-sm font-mono text-sm">
            <div className="luxury-glass-panel p-3">📄 server/services/MultiSourceWeatherService.ts (395 lines)</div>
            <div className="luxury-glass-panel p-3">📄 server/services/SmartEnvironmentService.ts (516 lines)</div>
            <div className="luxury-glass-panel p-3">📄 server/services/googleSheetsIntegration.ts (425 lines)</div>
            <div className="luxury-glass-panel p-3">📄 server/routes/weather.ts (835 lines)</div>
            <div className="luxury-glass-panel p-3">📄 server/routes/environment.ts (385 lines)</div>
            <div className="luxury-glass-panel p-3">📄 client/src/pages/PetCarePlanner.tsx (697 lines)</div>
            <div className="luxury-glass-panel p-3">📄 client/src/pages/PetWashDayPlanner.tsx (453 lines)</div>
            <div className="luxury-glass-panel p-3">📄 client/src/pages/RoleAwareWeatherPlanner.tsx (85 lines)</div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="luxury-glass-card luxury-shadow-xl text-center p-10 bg-gradient-to-br from-blue-50/50 via-purple-50/50 to-pink-50/50 dark:from-blue-950/50 dark:via-purple-950/50 dark:to-pink-950/50 luxury-animate-scale-in">
          <h3 className="luxury-heading-lg mb-3">🌟 Enterprise-Grade Platform</h3>
          <p className="luxury-text-body mb-6 max-w-2xl mx-auto">
            All APIs tested, documented, and production-ready for global scale
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/weather-planner">
              <button className="luxury-btn-primary luxury-shadow-xl flex items-center gap-2" data-testid="button-try-weather-planner">
                <Calendar className="w-5 h-5" />
                Try Weather Planner
              </button>
            </Link>
            <Link href="/pet-care-planner">
              <button className="luxury-btn-secondary flex items-center gap-2" data-testid="button-try-pet-care">
                <Sparkles className="w-5 h-5" />
                Try Pet Care Planner
              </button>
            </Link>
          </div>
        </div>
      </div>
    </LuxuryPageWrapper>
  );
}
