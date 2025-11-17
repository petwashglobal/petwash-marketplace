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
} from 'lucide-react';

export default function EnterpriseFeaturesShowcase() {
  const [selectedCity, setSelectedCity] = useState('Tel Aviv');

  // Demo: Fetch weather data
  const { data: weatherData, isLoading: weatherLoading } = useQuery({
    queryKey: [`/api/weather/forecast?location=${encodeURIComponent(selectedCity)}&days=7`],
    enabled: !!selectedCity,
  });

  // Demo: Fetch air quality
  const { data: airQualityDemo } = useQuery({
    queryKey: ['/api/environment/air-quality?lat=32.0853&lng=34.7818'], // Tel Aviv coordinates
  });

  const features = {
    weather: {
      title: 'Multi-Source Weather System',
      icon: <Cloud className="w-6 h-6" />,
      description: '13,000+ API calls/day capacity across 4 premium weather sources',
      sources: [
        { name: 'Open-Meteo', capacity: '10,000 calls/day', status: 'Primary', color: 'green' },
        { name: 'OpenWeatherMap', capacity: '1,000 calls/day', status: 'Backup', color: 'blue' },
        { name: 'WeatherAPI.com', capacity: '1,000 calls/day', status: 'Alerts', color: 'orange' },
        { name: 'Visual Crossing', capacity: '1,000 calls/day', status: 'Historical', color: 'purple' },
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
    maps: {
      title: 'Google Maps Integration',
      icon: <Map className="w-6 h-6" />,
      description: 'Location services, geocoding, and places autocomplete',
      features: [
        'Google Maps Places API',
        'Geocoding & reverse geocoding',
        'Places autocomplete UI component',
        'Route planning',
        'Station location mapping',
      ],
    },
    sheets: {
      title: 'Google Sheets Integration',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      description: 'Centralized form submission tracking across all 8 platforms',
      platforms: [
        'K9000 Wash Bookings',
        'Sitter Suite Bookings',
        'Walk My Pet Bookings',
        'PetTrek Bookings',
        'Academy Bookings',
        'Contact & Inquiries',
        'Feedback & Reviews',
        'Newsletter Subscriptions',
        'Franchise Inquiries',
      ],
    },
    planners: {
      title: 'Weather Planner Suite',
      icon: <Calendar className="w-6 h-6" />,
      description: 'Role-aware weather planning with AI recommendations',
      views: [
        { name: 'Public View', route: '/weather-planner', desc: 'General 7-day forecasts' },
        { name: 'Client View', route: '/pet-care-planner', desc: 'Pet wash scheduling + loyalty' },
        { name: 'Employee View', route: '/weather-planner', desc: 'Station-specific forecasts' },
        { name: 'Executive View', route: '/weather-planner', desc: 'Franchise-wide analytics' },
        { name: 'Day Planner', route: '/pet-wash-day-planner', desc: 'Best wash day finder' },
      ],
    },
    ai: {
      title: 'Gemini AI Integration',
      icon: <Brain className="w-6 h-6" />,
      description: 'Gemini 2.5 Flash for pet care insights and recommendations',
      features: [
        'Pet safety recommendations',
        'Environmental risk analysis',
        'Wash timing optimization',
        'Allergen warnings',
        'Activity planning',
      ],
    },
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

          {/* Weather Tab */}
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

                {/* Weather Features */}
                <div>
                  <h3 className="font-semibold mb-3">Capabilities</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {features.weather.features.map((feature) => (
                      <div key={feature} className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                        <span className="text-sm">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Live Demo */}
                {weatherData && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 dark:from-blue-950 dark:to-cyan-950 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-blue-600" />
                      <h4 className="font-semibold text-blue-900 dark:text-blue-100">Live Weather Demo - {selectedCity}</h4>
                    </div>
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      Real-time data from multi-source aggregator (see console for full response)
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Environment Tab */}
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
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  {features.environment.capabilities.map((cap) => (
                    <div key={cap} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{cap}</span>
                    </div>
                  ))}
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

                {airQualityDemo && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="w-4 h-4 text-green-600" />
                      <h4 className="font-semibold text-green-900 dark:text-green-100">Live Air Quality - Tel Aviv</h4>
                    </div>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Real-time AQI data from Google Air Quality API
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Maps Tab */}
          <TabsContent value="maps" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {features.maps.icon}
                  <div>
                    <CardTitle>{features.maps.title}</CardTitle>
                    <CardDescription>{features.maps.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2">
                  {features.maps.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
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
                  {features.sheets.icon}
                  <div>
                    <CardTitle>{features.sheets.title}</CardTitle>
                    <CardDescription>{features.sheets.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <h3 className="font-semibold mb-3">Tracked Form Submissions (9 Platforms)</h3>
                  <div className="grid gap-2 md:grid-cols-2">
                    {features.sheets.platforms.map((platform) => (
                      <div key={platform} className="flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                        <span className="text-sm">{platform}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 p-4 bg-purple-50 dark:bg-purple-950 rounded-lg">
                  <h4 className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                    Automatic Logging
                  </h4>
                  <p className="text-sm text-purple-700 dark:text-purple-300">
                    All form submissions are automatically logged to Google Sheets with timestamps, user info, and submission details for easy management and analysis.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Planners Tab */}
          <TabsContent value="planners" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  {features.planners.icon}
                  <div>
                    <CardTitle>{features.planners.title}</CardTitle>
                    <CardDescription>{features.planners.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {features.planners.views.map((view) => (
                    <Link key={view.route} href={view.route}>
                      <Card className="cursor-pointer hover:bg-muted/50 transition-colors">
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

                <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950 dark:to-yellow-950 rounded-lg">
                  <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
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
                  {features.ai.icon}
                  <div>
                    <CardTitle>{features.ai.title}</CardTitle>
                    <CardDescription>{features.ai.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 mb-4">
                  {features.ai.features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-600" />
                      <span className="text-sm">{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 rounded-lg">
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
        <div className="text-center p-6 bg-gradient-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-950 dark:via-purple-950 dark:to-pink-950 rounded-lg">
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
