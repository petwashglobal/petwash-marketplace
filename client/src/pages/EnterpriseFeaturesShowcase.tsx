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
      subtitle="Production-ready APIs & integrations powering Pet Wash™ global platform"
    >
      <div className="p-6 space-y-6">
        {/* Hero Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-green-200 dark:border-green-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Weather Capacity</CardTitle>
              <Cloud className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">13,000+</div>
              <p className="text-xs text-muted-foreground">API calls/day</p>
            </CardContent>
          </Card>
          
          <Card className="border-blue-200 dark:border-blue-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AQI Coverage</CardTitle>
              <Leaf className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">70+</div>
              <p className="text-xs text-muted-foreground">Air quality indexes</p>
            </CardContent>
          </Card>
          
          <Card className="border-purple-200 dark:border-purple-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Form Tracking</CardTitle>
              <FileSpreadsheet className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">9</div>
              <p className="text-xs text-muted-foreground">Platforms integrated</p>
            </CardContent>
          </Card>
          
          <Card className="border-amber-200 dark:border-amber-800">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">AI Insights</CardTitle>
              <Brain className="h-4 w-4 text-amber-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-amber-600">Gemini 2.5</div>
              <p className="text-xs text-muted-foreground">Flash powered</p>
            </CardContent>
          </Card>
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
          <TabsContent value="weather" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {features.weather.icon}
                  <div>
                    <CardTitle>{features.weather.title}</CardTitle>
                    <CardDescription>{features.weather.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Weather Sources */}
                <div>
                  <h3 className="font-semibold mb-3">Premium Weather Sources</h3>
                  <div className="grid gap-3 md:grid-cols-2">
                    {features.weather.sources.map((source) => (
                      <Card key={source.name} className="bg-muted/50">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{source.name}</h4>
                              <p className="text-sm text-muted-foreground">{source.capacity}</p>
                            </div>
                            <Badge variant={source.color as any}>{source.status}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* LIVE WEATHER DATA - VISIBLE TO PARTNERS */}
                <div className="border-2 border-blue-300 dark:border-blue-700 rounded-lg p-6 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950">
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-blue-600" />
                    <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100">
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
                    <div className="space-y-4">
                      {/* Current Weather */}
                      <Card className="bg-white/80 dark:bg-gray-900/80">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm text-muted-foreground">Current Conditions</p>
                              <p className="text-3xl font-bold">
                                {Math.round(currentWeatherData.weather.temperature)}°C
                              </p>
                              <p className="text-sm mt-1">{currentWeatherData.weather.condition}</p>
                            </div>
                            <div className="text-6xl">
                              {getWeatherIcon(currentWeatherData.weather.condition)}
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-2 mt-4 text-sm">
                            <div>
                              <Droplets className="w-4 h-4 inline mr-1 text-blue-500" />
                              {currentWeatherData.weather.humidity}% humidity
                            </div>
                            <div>
                              <Wind className="w-4 h-4 inline mr-1 text-gray-500" />
                              {currentWeatherData.weather.windSpeed} km/h
                            </div>
                            <div>
                              <ThermometerSun className="w-4 h-4 inline mr-1 text-orange-500" />
                              Feels {Math.round(currentWeatherData.weather.feelsLike)}°C
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* 7-Day Forecast */}
                      {forecastData?.success && forecastData?.forecast && forecastData.forecast.length > 0 ? (
                        <div>
                          <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">
                            7-Day Forecast
                          </h4>
                          <div className="grid gap-2 md:grid-cols-7">
                            {forecastData.forecast.slice(0, 7).map((day: any, index: number) => (
                              <Card key={index} className="bg-white/80 dark:bg-gray-900/80">
                                <CardContent className="p-3 text-center">
                                  <p className="text-xs font-medium">
                                    {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                                  </p>
                                  <div className="text-2xl my-2">
                                    {day.condition?.icon || getWeatherIcon(day.condition?.condition || '')}
                                  </div>
                                  <p className="text-sm font-bold">
                                    {Math.round(day.temperature?.max || 0)}°
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {Math.round(day.temperature?.min || 0)}°
                                  </p>
                                </CardContent>
                              </Card>
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
              </CardContent>
            </Card>
          </TabsContent>

          {/* Environment Tab - SHOW REAL AQI DATA */}
          <TabsContent value="environment" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {features.environment.icon}
                  <div>
                    <CardTitle>{features.environment.title}</CardTitle>
                    <CardDescription>{features.environment.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-2">
                  {features.environment.capabilities.map((cap) => (
                    <div key={cap} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{cap}</span>
                    </div>
                  ))}
                </div>

                {/* LIVE AIR QUALITY DATA - VISIBLE TO PARTNERS */}
                <div className="border-2 border-green-300 dark:border-green-700 rounded-lg p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950">
                  <div className="flex items-center gap-2 mb-4">
                    <Leaf className="w-5 h-5 text-green-600" />
                    <h3 className="text-lg font-bold text-green-900 dark:text-green-100">
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
                    <div className="space-y-4">
                      {/* AQI Score */}
                      <Card className="bg-white/80 dark:bg-gray-900/80">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-4">
                            <div>
                              <p className="text-sm text-muted-foreground">Air Quality Index (US EPA)</p>
                              <p className="text-4xl font-bold">
                                {airQualityResponse.data.aqi}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                Dominant: {airQualityResponse.data.dominantPollutant}
                              </p>
                            </div>
                            <div className={`w-16 h-16 rounded-full ${getAQIStatus(airQualityResponse.data.aqi).color} flex items-center justify-center`}>
                              <span className="text-2xl text-white font-bold">
                                {getAQIStatus(airQualityResponse.data.aqi).label.charAt(0)}
                              </span>
                            </div>
                          </div>
                          <Badge variant="outline" className="mb-2">
                            {airQualityResponse.data.category}
                          </Badge>
                          <p className="text-sm text-muted-foreground">
                            {airQualityResponse.data.healthRecommendations?.generalPopulation || getAQIStatus(airQualityResponse.data.aqi).text}
                          </p>
                        </CardContent>
                      </Card>

                      {/* Pollutants Breakdown */}
                      {airQualityResponse.data.pollutants && (
                        <div className="grid gap-2 md:grid-cols-3">
                          {Object.entries(airQualityResponse.data.pollutants)
                            .filter(([_, value]) => value != null)
                            .slice(0, 6)
                            .map(([pollutant, value]: [string, any]) => (
                            <Card key={pollutant} className="bg-white/80 dark:bg-gray-900/80">
                              <CardContent className="p-3">
                                <p className="text-xs font-medium text-muted-foreground">{pollutant.toUpperCase()}</p>
                                <p className="text-lg font-bold">
                                  {typeof value === 'number' ? value.toFixed(1) : 'N/A'}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  μg/m³
                                </p>
                              </CardContent>
                            </Card>
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
                <div className="mt-4 space-y-2">
                  <h3 className="font-semibold">Active Endpoints</h3>
                  <div className="space-y-1 font-mono text-xs bg-muted p-3 rounded">
                    <div>✅ GET /api/environment/air-quality</div>
                    <div>✅ GET /api/environment/pollen</div>
                    <div>✅ GET /api/environment/insights</div>
                    <div>✅ GET /api/environment/combined</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maps Tab */}
          <TabsContent value="maps" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Map className="w-6 h-6" />
                  <div>
                    <CardTitle>Google Maps Integration</CardTitle>
                    <CardDescription>Location services, geocoding, and places autocomplete</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 mb-6">
                  {['Google Maps Places API', 'Geocoding & reverse geocoding', 'Places autocomplete UI component', 'Route planning', 'Station location mapping'].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Sample Integration */}
                <div className="border-2 border-purple-300 dark:border-purple-700 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3">
                    🗺️ Google Places Autocomplete
                  </h4>
                  <div className="bg-white dark:bg-gray-900 p-4 rounded border-2 border-dashed border-purple-300">
                    <p className="text-sm text-muted-foreground mb-2">Component used in:</p>
                    <ul className="text-sm space-y-1 list-disc list-inside">
                      <li>Gift card delivery addresses</li>
                      <li>Booking location inputs</li>
                      <li>Station finder</li>
                      <li>Service area validation</li>
                    </ul>
                  </div>
                  <div className="mt-4 text-xs font-mono bg-muted p-2 rounded">
                    📁 client/src/components/ui/google-places-autocomplete.tsx
                  </div>
                </div>
                
                <div className="mt-4 space-y-2">
                  <h3 className="font-semibold">Integration Files</h3>
                  <div className="space-y-1 font-mono text-xs bg-muted p-3 rounded">
                    <div>📁 server/services/location/MapsService.ts</div>
                    <div>📁 server/services/googleMapsPlaces.ts</div>
                    <div>📁 client/src/components/ui/google-places-autocomplete.tsx</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sheets Tab */}
          <TabsContent value="sheets" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-6 h-6" />
                  <div>
                    <CardTitle>Google Sheets Integration</CardTitle>
                    <CardDescription>Centralized form submission tracking across all 9 platforms</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h3 className="font-semibold mb-3">Tracked Form Submissions (9 Platforms)</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {['K9000 Wash Bookings', 'Sitter Suite Bookings', 'Walk My Pet Bookings', 'PetTrek Bookings', 'Academy Bookings', 'Contact & Inquiries', 'Feedback & Reviews', 'Newsletter Subscriptions', 'Franchise Inquiries'].map((platform) => (
                      <div key={platform} className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">{platform}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg border-2 border-purple-200 dark:border-purple-800">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5" />
                    Automatic Data Collection
                  </h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300 mb-3">
                    All form submissions are automatically logged to Google Sheets with timestamps, user info, and submission details for easy management and analysis.
                  </p>
                  <div className="bg-white dark:bg-gray-900 p-3 rounded text-xs font-mono">
                    📊 Real-time sync | No manual data entry | Centralized analytics
                  </div>
                </div>

                <div className="mt-4 text-xs font-mono bg-muted p-2 rounded">
                  📁 server/services/googleSheetsIntegration.ts (425 lines)
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Planners Tab */}
          <TabsContent value="planners" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6" />
                  <div>
                    <CardTitle>Weather Planner Suite</CardTitle>
                    <CardDescription>Role-aware weather planning with AI recommendations</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {[
                    { name: 'Public View', route: '/weather-planner', desc: 'General 7-day forecasts' },
                    { name: 'Client View', route: '/pet-care-planner', desc: 'Pet wash scheduling + loyalty' },
                    { name: 'Employee View', route: '/weather-planner', desc: 'Station-specific forecasts' },
                    { name: 'Executive View', route: '/weather-planner', desc: 'Franchise-wide analytics' },
                    { name: 'Day Planner', route: '/pet-wash-day-planner', desc: 'Best wash day finder' },
                  ].map((view) => (
                    <Link key={view.route} href={view.route}>
                      <Card className="cursor-pointer hover:bg-muted/50 transition-colors hover:border-blue-400">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="font-medium">{view.name}</h4>
                              <p className="text-sm text-muted-foreground">{view.desc}</p>
                            </div>
                            <ExternalLink className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>

                <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 rounded-lg border-2 border-amber-200 dark:border-amber-800">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2 flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Multi-Language Support
                  </h4>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                    All weather planners support 6 languages with RTL layouts:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {['English', 'Hebrew', 'Arabic', 'Russian', 'French', 'Spanish'].map((lang) => (
                      <Badge key={lang} variant="outline">{lang}</Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Tab */}
          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Brain className="w-6 h-6" />
                  <div>
                    <CardTitle>Gemini AI Integration</CardTitle>
                    <CardDescription>Gemini 2.5 Flash for pet care insights and recommendations</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 mb-6">
                  {['Pet safety recommendations', 'Environmental risk analysis', 'Wash timing optimization', 'Allergen warnings', 'Activity planning'].map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                {/* Sample AI Output */}
                <div className="border-2 border-purple-300 dark:border-purple-700 rounded-lg p-6 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5" />
                    Sample AI Recommendation
                  </h4>
                  <Card className="bg-white dark:bg-gray-900">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">High Pollen Alert</p>
                            <p className="text-xs text-muted-foreground">
                              Grass pollen levels are high today. Consider indoor washing for pets with allergies.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">Optimal Wash Time</p>
                            <p className="text-xs text-muted-foreground">
                              Best time: 2-4 PM when air quality is good and temperature is ideal for drying.
                            </p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Sun className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="font-medium text-sm">UV Protection</p>
                            <p className="text-xs text-muted-foreground">
                              UV index is moderate. Safe for outdoor activities but consider shade for light-colored pets.
                            </p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="mt-6 p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                    Gemini 2.5 Flash Integration
                  </h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    Advanced AI analyzes environmental conditions (weather, air quality, pollen) to provide personalized pet care recommendations, safety warnings, and activity planning.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Documentation Links */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Production Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 font-mono text-xs">
              <div>📄 server/services/MultiSourceWeatherService.ts (395 lines)</div>
              <div>📄 server/services/SmartEnvironmentService.ts (516 lines)</div>
              <div>📄 server/services/googleSheetsIntegration.ts (425 lines)</div>
              <div>📄 server/routes/weather.ts (835 lines)</div>
              <div>📄 server/routes/environment.ts (385 lines)</div>
              <div>📄 client/src/pages/PetCarePlanner.tsx (697 lines)</div>
              <div>📄 client/src/pages/PetWashDayPlanner.tsx (453 lines)</div>
              <div>📄 client/src/pages/RoleAwareWeatherPlanner.tsx (85 lines)</div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center p-6 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950 dark:via-purple-950 dark:to-pink-950 rounded-lg border-2 border-blue-200 dark:border-blue-800">
          <h3 className="text-2xl font-bold mb-2">🌟 Enterprise-Grade Platform</h3>
          <p className="text-muted-foreground mb-4">
            All APIs tested, documented, and production-ready for global scale
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/weather-planner">
              <Button data-testid="button-try-weather-planner">
                <Calendar className="w-4 h-4 mr-2" />
                Try Weather Planner
              </Button>
            </Link>
            <Link href="/pet-care-planner">
              <Button variant="outline" data-testid="button-try-pet-care">
                <Sparkles className="w-4 h-4 mr-2" />
                Try Pet Care Planner
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </LuxuryPageWrapper>
  );
}
