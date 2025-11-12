# 🌤️ Google Weather API Testing Guide

**Last Updated:** November 8, 2025  
**Status:** ✅ Live & Operational

---

## 🎯 **Quick Access**

### Web UI (Recommended)
Access the interactive test page at:
```
https://your-app.com/weather-test
```

### API Endpoints
```bash
# Health Check
GET /api/weather-test/health

# Test Specific Location
GET /api/weather-test?lat=-37.8732&lon=145.0210

# Batch Test Multiple Locations
POST /api/weather-test/batch
Content-Type: application/json
{
  "locations": [
    { "lat": 32.0853, "lon": 34.7818, "name": "Tel Aviv, Israel" },
    { "lat": -37.8732, "lon": 145.0210, "name": "Caulfield North, Australia" }
  ]
}
```

---

## ✅ **Replace Python Scripts with Web UI**

The Python scripts you provided can now be replaced with the interactive web UI at `/weather-test`. Here's the comparison:

### Before (Python Script)
```python
import requests
import os

API_KEY = os.environ.get('GOOGLE_WEATHER_API_KEY')
LATITUDE = -37.8732
LONGITUDE = 145.0210
ENDPOINT = "https://weather.googleapis.com/v1/currentConditions:lookup"

# Manual API testing required
response = requests.post(f"{ENDPOINT}?key={API_KEY}", ...)
```

### After (Web UI)
1. Navigate to `/weather-test`
2. Click "Quick Test" button for Caulfield North, Australia
3. View instant results with temperature, humidity, UV index, pollen levels
4. No code required!

---

## 🔧 **Features of the Test UI**

### 1. **Health Check**
- Automatic status check on page load
- Shows Google Weather API vs Open-Meteo fallback
- Response time monitoring
- API key validation

### 2. **Custom Location Testing**
- Enter any latitude/longitude coordinates
- Instant weather data retrieval
- Detailed results display:
  - Temperature (°C)
  - Humidity (%)
  - Wind Speed (km/h)
  - Weather Conditions
  - UV Index (when available)
  - Pollen Levels (when available)

### 3. **Quick Test Buttons**
Pre-configured locations for instant testing:
- ✅ Tel Aviv, Israel (Pet Wash™ HQ)
- ✅ Caulfield North, Australia
- ✅ New York, USA
- ✅ London, UK
- ✅ Tokyo, Japan

### 4. **Real-Time Provider Detection**
- Automatically detects if using Google Weather API or Open-Meteo fallback
- Shows which data source is being used
- Validates API key configuration status

---

## 📊 **API Response Format**

### Success Response
```json
{
  "success": true,
  "provider": "google",
  "location": {
    "latitude": -37.8732,
    "longitude": 145.0210
  },
  "weather": {
    "temperature": 22.5,
    "humidity": 65,
    "windSpeed": 15,
    "description": "Partly Cloudy",
    "uvIndex": 7,
    "pollenLevel": "High",
    "source": "google"
  },
  "test": {
    "googleWeatherApiKey": "✅ Configured",
    "timestamp": "2025-11-08T01:22:00.000Z"
  }
}
```

### Error Response
```json
{
  "success": false,
  "error": "API request failed: 401 Unauthorized",
  "test": {
    "googleWeatherApiKey": "❌ Missing",
    "timestamp": "2025-11-08T01:22:00.000Z"
  }
}
```

---

## 🔐 **Environment Variables**

The test endpoints automatically validate your API key configuration:

```bash
# Required for Google Weather API
GOOGLE_WEATHER_API_KEY=your_api_key_here

# Optional - System falls back to Open-Meteo if not configured
```

**Status Indicators:**
- ✅ Configured - API key is set and valid
- ❌ Missing - API key not found (will use Open-Meteo fallback)

---

## 🌍 **Testing Locations**

### Israel (Pet Wash™ Operations)
```
Tel Aviv: 32.0853, 34.7818
Jerusalem: 31.7683, 35.2137
Haifa: 32.7940, 34.9896
```

### Australia (Your Location)
```
Caulfield North, VIC: -37.8732, 145.0210
Melbourne CBD: -37.8136, 144.9631
Sydney: -33.8688, 151.2093
```

### Global Test Locations
```
New York, USA: 40.7128, -74.0060
London, UK: 51.5074, -0.1278
Tokyo, Japan: 35.6762, 139.6503
Paris, France: 48.8566, 2.3522
Dubai, UAE: 25.2048, 55.2708
```

---

## 📝 **Usage Examples**

### Example 1: Quick Health Check
```bash
curl https://your-app.com/api/weather-test/health
```

**Response:**
```json
{
  "status": "healthy",
  "provider": "google",
  "responseTime": "245ms",
  "googleWeatherApiKey": "✅ Configured",
  "testLocation": "Tel Aviv, Israel (Pet Wash™ HQ)",
  "coordinates": {
    "lat": 32.0853,
    "lon": 34.7818
  },
  "timestamp": "2025-11-08T01:22:00.000Z"
}
```

### Example 2: Test Specific Location
```bash
curl "https://your-app.com/api/weather-test?lat=-37.8732&lon=145.0210"
```

### Example 3: Batch Test Multiple Cities
```bash
curl -X POST https://your-app.com/api/weather-test/batch \
  -H "Content-Type: application/json" \
  -d '{
    "locations": [
      { "lat": 32.0853, "lon": 34.7818, "name": "Tel Aviv" },
      { "lat": -37.8732, "lon": 145.0210, "name": "Melbourne" },
      { "lat": 40.7128, "lon": -74.0060, "name": "New York" }
    ]
  }'
```

---

## 🚀 **Integration with Pet Wash™ Platform**

The Google Weather API is already integrated into:

1. **Unified Location Service** (`server/services/unifiedLocationWeather.ts`)
   - Automatic fallback to Open-Meteo if Google API unavailable
   - Smart caching for performance
   - UV index and pollen level tracking

2. **K9000 Wash Stations**
   - Weather-based wash recommendations
   - "Great day for a wash!" alerts
   - Heat/cold safety warnings

3. **Walk My Pet™**
   - Real-time weather for walk planning
   - Safety alerts (extreme heat, rain, etc.)

4. **PetTrek™**
   - Route planning with weather conditions
   - Driver safety notifications

---

## ✅ **Verification Checklist**

Use this checklist to verify Google Weather API is working:

- [ ] Navigate to `/weather-test` page
- [ ] Health check shows "healthy" status
- [ ] Provider badge shows "🌐 Google Weather" (not fallback)
- [ ] API Key Status shows "✅ Configured"
- [ ] Click "Quick Test" for Tel Aviv, Israel
- [ ] Results show temperature, humidity, wind speed
- [ ] UV Index and Pollen Level displayed (if available)
- [ ] Response time < 1 second

---

## 📚 **Related Documentation**

- **Complete Google APIs Inventory**: `docs/GOOGLE_APIS_COMPLETE_INVENTORY.md`
- **Unified Services Architecture**: `docs/UNIFIED_GOOGLE_SERVICES_ARCHITECTURE.md`
- **Weather Service Source Code**: `server/services/unifiedLocationWeather.ts`
- **Test Route Source Code**: `server/routes/weather-test.ts`
- **Test UI Source Code**: `client/src/pages/WeatherTest.tsx`

---

## 🎯 **Summary**

✅ **Google Weather API** is fully integrated and tested  
✅ **Interactive test UI** available at `/weather-test`  
✅ **3 API endpoints** for programmatic testing  
✅ **Automatic fallback** to Open-Meteo if needed  
✅ **Real-time provider detection** and monitoring  
✅ **No Python scripts required** - everything in the web UI  

**Your Python test scripts can now be retired!** 🎉

The web UI provides everything you need to test and validate the Google Weather API integration, with a much better user experience and real-time feedback.
