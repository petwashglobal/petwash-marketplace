package com.petwash.weatherplanner

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory

private const val API_KEY = "YOUR_OPENWEATHER_API_KEY_HERE"

class MainActivity : ComponentActivity() {
    private val retrofit = Retrofit.Builder()
        .baseUrl("https://api.openweathermap.org/")
        .addConverterFactory(MoshiConverterFactory.create())
        .build()
    
    private val weatherService = retrofit.create(WeatherService::class.java)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                WeatherAppScreen(weatherService)
            }
        }
    }
}

fun formatWeatherData(forecast: Forecast): String {
    val plannerAdvice = when {
        forecast.main.temp > 30 -> 
            "🌞 It's very hot! Plan indoor activities or stay hydrated if going out."
        forecast.main.temp > 25 -> 
            "☀️ Warm and pleasant! Perfect for outdoor activities."
        forecast.main.temp > 15 -> 
            "🌤️ Mild weather. Light jacket recommended for evening activities."
        forecast.main.temp > 5 -> 
            "🧥 Cool weather. Dress warmly for outdoor plans."
        else -> 
            "🥶 Cold weather! Plan indoor activities or bundle up."
    }
    
    val rainAdvice = forecast.weather.firstOrNull()?.main?.let { condition ->
        when {
            condition.contains("Rain", ignoreCase = true) -> 
                "\n☔ Rain expected - bring an umbrella!"
            condition.contains("Snow", ignoreCase = true) -> 
                "\n❄️ Snow expected - plan accordingly!"
            condition.contains("Clear", ignoreCase = true) -> 
                "\n✨ Clear skies - great visibility!"
            else -> ""
        }
    } ?: ""
    
    return buildString {
        append("📍 Location: London\n\n")
        append("🌡️ Temperature: ${forecast.main.temp}°C\n")
        append("Feels like: ${forecast.main.feels_like}°C\n\n")
        append("📊 Conditions:\n")
        append("${forecast.weather.firstOrNull()?.description?.capitalize() ?: "N/A"}\n")
        append("Humidity: ${forecast.main.humidity}%\n\n")
        append("🤖 AI Planner:\n")
        append(plannerAdvice)
        append(rainAdvice)
    }
}

suspend fun fetchWeather(service: WeatherService): Result<String> {
    return try {
        val forecast = service.getCurrentWeather(
            lat = 51.5074,
            lon = 0.1278,
            apiKey = API_KEY
        )
        Result.success(formatWeatherData(forecast))
    } catch (e: Exception) {
        Result.failure(e)
    }
}

@Composable
fun WeatherAppScreen(service: WeatherService) {
    var weatherData by remember { mutableStateOf("Loading AI forecast...") }
    var isLoading by remember { mutableStateOf(true) }
    var isError by remember { mutableStateOf(false) }
    val coroutineScope = rememberCoroutineScope()

    fun loadWeather() {
        isLoading = true
        coroutineScope.launch {
            fetchWeather(service).fold(
                onSuccess = { formattedData ->
                    weatherData = formattedData
                    isLoading = false
                    isError = false
                },
                onFailure = { error ->
                    weatherData = "⚠️ Error: ${error.message}\n\n" +
                        "Please check:\n" +
                        "1. Internet connection\n" +
                        "2. API key is configured\n" +
                        "3. API quota not exceeded"
                    isLoading = false
                    isError = true
                }
            )
        }
    }

    LaunchedEffect(Unit) {
        loadWeather()
    }

    Surface(
        modifier = Modifier.fillMaxSize(),
        color = MaterialTheme.colorScheme.background
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            Text(
                text = "AI Weather Planner",
                fontSize = 28.sp,
                fontWeight = FontWeight.Bold,
                color = MaterialTheme.colorScheme.primary,
                modifier = Modifier.padding(bottom = 32.dp)
            )
            
            if (isLoading) {
                CircularProgressIndicator(
                    modifier = Modifier.size(48.dp),
                    color = MaterialTheme.colorScheme.primary
                )
                Spacer(modifier = Modifier.height(16.dp))
            }
            
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(
                    containerColor = if (isError) 
                        MaterialTheme.colorScheme.errorContainer 
                    else 
                        MaterialTheme.colorScheme.surfaceVariant
                )
            ) {
                Text(
                    text = weatherData,
                    fontSize = 16.sp,
                    modifier = Modifier.padding(20.dp),
                    textAlign = TextAlign.Start,
                    lineHeight = 24.sp
                )
            }
            
            if (!isLoading) {
                Spacer(modifier = Modifier.height(24.dp))
                Button(
                    onClick = { loadWeather() },
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("🔄 Refresh Forecast")
                }
            }
        }
    }
}
