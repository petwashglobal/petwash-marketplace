# 📱 AI Weather Planner - Android App

A modern Android weather application built with **Kotlin** and **Jetpack Compose** that provides AI-powered daily planning advice based on current weather conditions.

## ✨ Features

- **Real-time Weather Data**: Fetches current weather using OpenWeatherMap API
- **AI Planning Advice**: Smart recommendations based on temperature and conditions
- **Modern UI**: Built with Jetpack Compose and Material Design 3
- **Clean Architecture**: Retrofit for networking, Moshi for JSON parsing
- **Responsive Design**: Beautiful, adaptive layouts

## 🛠️ Tech Stack

- **Language**: Kotlin
- **UI Framework**: Jetpack Compose
- **Networking**: Retrofit 2.9.0
- **JSON Parsing**: Moshi 1.15.0
- **Architecture**: MVVM pattern with coroutines
- **Min SDK**: Android 8.0 (API 26)
- **Target SDK**: Android 14 (API 34)

## 📋 Prerequisites

Before you begin, ensure you have:

1. **Android Studio** (latest version - Arctic Fox or newer)
2. **JDK 8 or higher**
3. **OpenWeatherMap API Key** (free tier works)

## 🚀 Setup Instructions

### Step 1: Get Your API Key

1. Visit [OpenWeatherMap](https://openweathermap.org/api)
2. Create a free account
3. Navigate to **API Keys** section
4. Copy your API key

### Step 2: Configure the API Key

#### Option A: Quick Setup (For Testing)

1. Open `MainActivity.kt`
2. Find this line at the top:
   ```kotlin
   private const val API_KEY = "YOUR_OPENWEATHER_API_KEY_HERE"
   ```
3. Replace with your actual API key:
   ```kotlin
   private const val API_KEY = "abc123def456..."
   ```

#### Option B: Secure Setup (Recommended for Production)

1. Create a file `local.properties` in the project root (if it doesn't exist)
2. Add your API key:
   ```properties
   OPENWEATHER_API_KEY=your_actual_api_key_here
   ```
3. Update `app/build.gradle.kts` to read the key:
   ```kotlin
   android {
       // ... existing config ...
       
       defaultConfig {
           // ... existing config ...
           
           // Read API key from local.properties
           val properties = Properties()
           properties.load(project.rootProject.file("local.properties").inputStream())
           buildConfigField("String", "WEATHER_API_KEY", 
               "\"${properties.getProperty("OPENWEATHER_API_KEY")}\"")
       }
       
       buildFeatures {
           buildConfig = true
       }
   }
   ```
4. Update `MainActivity.kt`:
   ```kotlin
   private const val API_KEY = BuildConfig.WEATHER_API_KEY
   ```

**Important:** The `local.properties` file is already in `.gitignore` and will never be committed to version control, keeping your API key secure.

### Step 3: Open in Android Studio

1. Launch Android Studio
2. Click **Open an existing project**
3. Navigate to the `android-weather-planner` folder
4. Click **OK**
5. Wait for Gradle sync to complete

### Step 4: Run the App

1. Connect an Android device (API 26+) or start an emulator
2. Click the green **Run** button (▶️) in Android Studio
3. Select your device
4. Wait for build and installation

## 📁 Project Structure

```
android-weather-planner/
├── app/
│   ├── build.gradle.kts          # App-level dependencies
│   ├── proguard-rules.pro        # ProGuard configuration
│   └── src/
│       └── main/
│           ├── AndroidManifest.xml
│           ├── java/com/petwash/weatherplanner/
│           │   ├── MainActivity.kt      # Main app entry + UI
│           │   └── WeatherService.kt    # API interface & data models
│           └── res/
│               ├── values/
│               │   ├── strings.xml      # App strings
│               │   └── themes.xml       # Material theme
│               └── xml/
│                   ├── backup_rules.xml
│                   └── data_extraction_rules.xml
├── build.gradle.kts              # Project-level build config
├── settings.gradle.kts           # Gradle settings
├── gradle.properties             # Gradle properties
└── README.md                     # This file
```

## 🔧 Customization

### Change Location

Edit `MainActivity.kt` and modify the coordinates:

```kotlin
val forecast = service.getCurrentWeather(
    lat = 51.5074,  // Your latitude
    lon = 0.1278,   // Your longitude
    apiKey = apiKey
)
```

### Modify AI Advice Logic

Update the temperature thresholds in `MainActivity.kt`:

```kotlin
val plannerAdvice = when {
    forecast.main.temp > 30 -> "Your custom hot weather advice"
    forecast.main.temp > 25 -> "Your custom warm weather advice"
    // ... add more conditions
}
```

### Change Units (Celsius/Fahrenheit)

In `MainActivity.kt`, change the units parameter:

```kotlin
val forecast = service.getCurrentWeather(
    lat = 51.5074,
    lon = 0.1278,
    units = "imperial",  // Use "imperial" for Fahrenheit
    apiKey = apiKey
)
```

## 🐛 Troubleshooting

### "Error: Invalid API key"
- Verify your API key is correct in `MainActivity.kt`
- Check if your key is activated (can take 10 minutes after creation)

### "Network request failed"
- Ensure device has internet connection
- Check `AndroidManifest.xml` has `INTERNET` permission
- Verify firewall isn't blocking the app

### "Build failed" / Gradle errors
- Click **File → Invalidate Caches → Invalidate and Restart**
- Run `./gradlew clean` in Terminal
- Update Android Studio to latest version

### App crashes on startup
- Check Logcat for error messages
- Verify min SDK version matches device (API 26+)
- Ensure all dependencies are synced

## 📱 App Features Explained

### Current Implementation

1. **Loading State**: Shows spinner while fetching data
2. **Weather Display**: Temperature, feels-like, humidity, conditions
3. **AI Advice**: Context-aware planning recommendations
4. **Error Handling**: User-friendly error messages
5. **Refresh Button**: Manual data refresh capability

### Potential Enhancements

- 🗓️ 7-day forecast view
- 📍 GPS-based automatic location detection
- 🔔 Weather alerts and notifications
- 💾 Offline caching with Room database
- 🎨 Custom themes (light/dark mode)
- 🌍 Multiple location support

## 📄 API Information

**OpenWeatherMap Current Weather API**
- Endpoint: `https://api.openweathermap.org/data/2.5/weather`
- Free tier: 60 calls/minute, 1,000,000 calls/month
- Documentation: [OpenWeatherMap Docs](https://openweathermap.org/current)

## 🔐 Security Notes

- **Never commit API keys** to version control
- Consider using BuildConfig or local.properties for API keys
- ProGuard rules included to protect data classes in release builds
- Backup rules configured to exclude sensitive data

## 📞 Support

For issues with:
- **OpenWeatherMap API**: Visit [OpenWeatherMap Support](https://openweathermap.org/faq)
- **Android Studio**: Check [Android Developer Docs](https://developer.android.com)
- **This App**: Create an issue in the project repository

## 📝 License

This project is part of the Pet Wash™ ecosystem.

---

**Built with ❤️ using Modern Android Development practices**
