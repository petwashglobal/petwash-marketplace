/**
 * Google Weather API Test Page
 * 
 * Simple UI for testing Google Weather API integration
 * Accessible at /weather-test (admin/dev only)
 */

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Loader2, Cloud, MapPin, Thermometer, Droplets, Wind, Eye, AlertCircle } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

export default function WeatherTest() {
  const [lat, setLat] = useState('-37.8732');
  const [lon, setLon] = useState('145.0210');

  // Health check query
  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['/api/weather-test/health'],
  });

  // Manual test mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest(`/api/weather-test?lat=${lat}&lon=${lon}`);
      return response;
    },
  });

  const handleTest = () => {
    testMutation.mutate();
  };

  const testLocations = [
    { name: 'Tel Aviv, Israel (HQ)', lat: 32.0853, lon: 34.7818 },
    { name: 'Caulfield North, Australia', lat: -37.8732, lon: 145.0210 },
    { name: 'New York, USA', lat: 40.7128, lon: -74.0060 },
    { name: 'London, UK', lat: 51.5074, lon: -0.1278 },
    { name: 'Tokyo, Japan', lat: 35.6762, lon: 139.6503 },
  ];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold mb-2">Google Weather API Test</h1>
          <p className="text-muted-foreground">
            Test and verify Google Weather API integration for Pet Wash™
          </p>
        </div>

        {/* Health Check Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="w-5 h-5" />
              API Health Check
            </CardTitle>
            <CardDescription>
              Current status of Google Weather API integration
            </CardDescription>
          </CardHeader>
          <CardContent>
            {healthLoading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Checking API health...</span>
              </div>
            ) : healthData ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant={healthData.status === 'healthy' ? 'default' : 'destructive'}>
                    {healthData.status === 'healthy' ? '✅ Healthy' : '❌ Unhealthy'}
                  </Badge>
                  <Badge variant="outline">
                    {healthData.provider === 'google' ? '🌐 Google Weather' : '🔄 Open-Meteo (Fallback)'}
                  </Badge>
                  <Badge variant="outline">
                    Response: {healthData.responseTime}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="font-medium">Test Location:</span> {healthData.testLocation}
                  </div>
                  <div>
                    <span className="font-medium">API Key:</span> {healthData.googleWeatherApiKey}
                  </div>
                  <div className="col-span-2">
                    <span className="font-medium">Coordinates:</span> {healthData.coordinates?.lat}, {healthData.coordinates?.lon}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <span>Failed to fetch health status</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Manual Test Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              Test Custom Location
            </CardTitle>
            <CardDescription>
              Enter coordinates to test weather API for any location
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Latitude</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  placeholder="-37.8732"
                  data-testid="input-test-latitude"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Longitude</label>
                <Input
                  type="number"
                  step="0.0001"
                  value={lon}
                  onChange={(e) => setLon(e.target.value)}
                  placeholder="145.0210"
                  data-testid="input-test-longitude"
                />
              </div>
            </div>

            <Button
              onClick={handleTest}
              disabled={testMutation.isPending}
              className="w-full"
              data-testid="button-test-weather"
            >
              {testMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Testing...
                </>
              ) : (
                <>
                  <Cloud className="mr-2 h-4 w-4" />
                  Test Weather API
                </>
              )}
            </Button>

            {/* Quick Test Buttons */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Quick Tests:</p>
              <div className="grid grid-cols-2 gap-2">
                {testLocations.map((loc) => (
                  <Button
                    key={loc.name}
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLat(loc.lat.toString());
                      setLon(loc.lon.toString());
                    }}
                    data-testid={`button-quick-${loc.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`}
                  >
                    {loc.name}
                  </Button>
                ))}
              </div>
            </div>

            {/* Results */}
            {testMutation.data && (
              <div className="mt-4 p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Test Results</h3>
                  <Badge variant={testMutation.data.success ? 'default' : 'destructive'}>
                    {testMutation.data.success ? '✅ Success' : '❌ Failed'}
                  </Badge>
                </div>

                {testMutation.data.success && testMutation.data.weather && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-4 h-4" />
                      <div>
                        <div className="text-xs text-muted-foreground">Temperature</div>
                        <div className="font-medium">{testMutation.data.weather.temperature}°C</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Droplets className="w-4 h-4" />
                      <div>
                        <div className="text-xs text-muted-foreground">Humidity</div>
                        <div className="font-medium">{testMutation.data.weather.humidity}%</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Wind className="w-4 h-4" />
                      <div>
                        <div className="text-xs text-muted-foreground">Wind Speed</div>
                        <div className="font-medium">{testMutation.data.weather.windSpeed} km/h</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Eye className="w-4 h-4" />
                      <div>
                        <div className="text-xs text-muted-foreground">Conditions</div>
                        <div className="font-medium">{testMutation.data.weather.description}</div>
                      </div>
                    </div>

                    {testMutation.data.weather.uvIndex && (
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-xs text-muted-foreground">UV Index</div>
                          <div className="font-medium">{testMutation.data.weather.uvIndex}</div>
                        </div>
                      </div>
                    )}

                    {testMutation.data.weather.pollenLevel && (
                      <div className="flex items-center gap-2">
                        <div>
                          <div className="text-xs text-muted-foreground">Pollen Level</div>
                          <div className="font-medium">{testMutation.data.weather.pollenLevel}</div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-2 border-t">
                  <div className="text-xs space-y-1">
                    <div><strong>Provider:</strong> {testMutation.data.provider}</div>
                    <div><strong>API Key Status:</strong> {testMutation.data.test?.googleWeatherApiKey}</div>
                    <div><strong>Timestamp:</strong> {new Date(testMutation.data.test?.timestamp || '').toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {testMutation.error && (
              <div className="mt-4 p-4 bg-destructive/10 rounded-lg">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="w-4 h-4" />
                  <span className="font-medium">Error:</span>
                </div>
                <p className="text-sm mt-1">{(testMutation.error as Error).message}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Documentation Card */}
        <Card>
          <CardHeader>
            <CardTitle>API Documentation</CardTitle>
            <CardDescription>
              Available test endpoints for Google Weather API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="font-mono bg-muted p-2 rounded">
              GET /api/weather-test?lat={'{latitude}'}&lon={'{longitude}'}
            </div>
            <div className="font-mono bg-muted p-2 rounded">
              GET /api/weather-test/health
            </div>
            <div className="font-mono bg-muted p-2 rounded">
              POST /api/weather-test/batch
            </div>
            <p className="text-muted-foreground pt-2">
              See <code>server/routes/weather-test.ts</code> for full API documentation
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
