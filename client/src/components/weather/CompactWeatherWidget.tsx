import { useState, useEffect } from "react";
import { Cloud, Sun, CloudRain, CloudSnow, Wind, Droplets, Thermometer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface WeatherData {
  temperature: number;
  humidity: number;
  windSpeed: number;
  condition: string;
  conditionCode: number;
  location: string;
  timezone: string;
  isDay: boolean;
}

const weatherConditions: Record<number, { icon: typeof Sun; label: string; labelHe: string }> = {
  0: { icon: Sun, label: "Clear", labelHe: "בהיר" },
  1: { icon: Sun, label: "Mostly Clear", labelHe: "בהיר ברובו" },
  2: { icon: Cloud, label: "Partly Cloudy", labelHe: "מעונן חלקית" },
  3: { icon: Cloud, label: "Overcast", labelHe: "מעונן" },
  45: { icon: Cloud, label: "Foggy", labelHe: "ערפילי" },
  48: { icon: Cloud, label: "Fog", labelHe: "ערפל" },
  51: { icon: CloudRain, label: "Light Drizzle", labelHe: "טפטוף קל" },
  53: { icon: CloudRain, label: "Drizzle", labelHe: "טפטוף" },
  55: { icon: CloudRain, label: "Heavy Drizzle", labelHe: "טפטוף כבד" },
  61: { icon: CloudRain, label: "Light Rain", labelHe: "גשם קל" },
  63: { icon: CloudRain, label: "Rain", labelHe: "גשם" },
  65: { icon: CloudRain, label: "Heavy Rain", labelHe: "גשם כבד" },
  71: { icon: CloudSnow, label: "Light Snow", labelHe: "שלג קל" },
  73: { icon: CloudSnow, label: "Snow", labelHe: "שלג" },
  75: { icon: CloudSnow, label: "Heavy Snow", labelHe: "שלג כבד" },
  80: { icon: CloudRain, label: "Showers", labelHe: "ממטרים" },
  81: { icon: CloudRain, label: "Showers", labelHe: "ממטרים" },
  82: { icon: CloudRain, label: "Heavy Showers", labelHe: "ממטרים כבדים" },
  95: { icon: CloudRain, label: "Thunderstorm", labelHe: "סופת רעמים" },
};

interface CompactWeatherWidgetProps {
  latitude?: number;
  longitude?: number;
  locationName?: string;
  variant?: "minimal" | "compact" | "expanded";
  className?: string;
}

export function CompactWeatherWidget({
  latitude = 32.0853,
  longitude = 34.7818,
  locationName = "תל אביב",
  variant = "compact",
  className = "",
}: CompactWeatherWidgetProps) {
  const { data: weather, isLoading, error } = useQuery<WeatherData>({
    queryKey: ["weather", latitude, longitude],
    queryFn: async () => {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day&timezone=auto`
      );
      if (!response.ok) throw new Error("Weather fetch failed");
      const data = await response.json();
      return {
        temperature: Math.round(data.current.temperature_2m),
        humidity: data.current.relative_humidity_2m,
        windSpeed: Math.round(data.current.wind_speed_10m),
        conditionCode: data.current.weather_code,
        condition: weatherConditions[data.current.weather_code]?.label || "Unknown",
        location: locationName,
        timezone: data.timezone,
        isDay: data.current.is_day === 1,
      };
    },
    staleTime: 15 * 60 * 1000,
    refetchInterval: 30 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className={`animate-pulse rounded-2xl bg-white/5 backdrop-blur-xl p-3 ${className}`}>
        <div className="h-8 w-16 bg-white/10 rounded"></div>
      </div>
    );
  }

  if (error || !weather) {
    return null;
  }

  const WeatherIcon = weatherConditions[weather.conditionCode]?.icon || Cloud;
  const conditionHe = weatherConditions[weather.conditionCode]?.labelHe || "לא ידוע";

  if (variant === "minimal") {
    return (
      <div className={`flex items-center gap-2 text-white/80 ${className}`}>
        <WeatherIcon className="h-4 w-4" />
        <span className="text-sm font-light">{weather.temperature}°</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`
          rounded-2xl bg-gradient-to-br from-white/10 to-white/5 
          backdrop-blur-xl border border-white/10 p-3
          shadow-[0_8px_32px_rgba(0,0,0,0.3)]
          ${className}
        `}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-400/20 to-orange-500/20 rounded-full blur-xl"></div>
            <WeatherIcon className="h-8 w-8 text-amber-400 relative z-10" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-extralight text-white">{weather.temperature}</span>
              <span className="text-sm text-white/60">°C</span>
            </div>
            <p className="text-xs text-white/50 truncate">{conditionHe}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`
        rounded-3xl bg-gradient-to-br from-white/10 to-white/5 
        backdrop-blur-xl border border-white/10 p-4
        shadow-[0_8px_32px_rgba(0,0,0,0.3)]
        ${className}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-light text-white/70">{weather.location}</h3>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="text-4xl font-extralight text-white">{weather.temperature}</span>
            <span className="text-lg text-white/60">°C</span>
          </div>
          <p className="text-sm text-white/50 mt-1">{conditionHe}</p>
        </div>
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-400/30 to-orange-500/30 rounded-full blur-2xl scale-150"></div>
          <WeatherIcon className="h-12 w-12 text-amber-400 relative z-10" />
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10">
        <div className="flex items-center gap-2">
          <Droplets className="h-4 w-4 text-blue-400/70" />
          <div>
            <p className="text-xs text-white/40">לחות</p>
            <p className="text-sm text-white/80">{weather.humidity}%</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Wind className="h-4 w-4 text-cyan-400/70" />
          <div>
            <p className="text-xs text-white/40">רוח</p>
            <p className="text-sm text-white/80">{weather.windSpeed} קמ״ש</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PetWalkWeatherAdvisor({
  latitude = 32.0853,
  longitude = 34.7818,
  className = "",
}: {
  latitude?: number;
  longitude?: number;
  className?: string;
}) {
  const { data: weather, isLoading } = useQuery<WeatherData>({
    queryKey: ["weather", latitude, longitude],
    queryFn: async () => {
      const response = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,is_day&timezone=auto`
      );
      if (!response.ok) throw new Error("Weather fetch failed");
      const data = await response.json();
      return {
        temperature: Math.round(data.current.temperature_2m),
        humidity: data.current.relative_humidity_2m,
        windSpeed: Math.round(data.current.wind_speed_10m),
        conditionCode: data.current.weather_code,
        condition: weatherConditions[data.current.weather_code]?.label || "Unknown",
        location: "Israel",
        timezone: data.timezone,
        isDay: data.current.is_day === 1,
      };
    },
    staleTime: 15 * 60 * 1000,
  });

  if (isLoading || !weather) return null;

  const isGoodForWalk = 
    weather.temperature >= 15 && 
    weather.temperature <= 28 && 
    weather.conditionCode < 50 &&
    weather.windSpeed < 30;

  const advisoryMessage = isGoodForWalk
    ? "מזג אוויר מושלם להליכה עם הכלב! 🐕"
    : weather.temperature > 28
    ? "חם מאוד - מומלץ להליכה מוקדמת או מאוחרת 🌡️"
    : weather.conditionCode >= 50
    ? "צפוי גשם - קחו מטריה או דחו את ההליכה ☔"
    : "רוח חזקה - הליכה קצרה מומלצת 💨";

  return (
    <div
      className={`
        rounded-2xl p-3
        ${isGoodForWalk 
          ? "bg-gradient-to-r from-emerald-500/20 to-green-500/20 border border-emerald-500/30" 
          : "bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/30"
        }
        backdrop-blur-xl
        ${className}
      `}
    >
      <div className="flex items-center gap-3">
        <div className="text-2xl">{isGoodForWalk ? "✨" : "⚠️"}</div>
        <div className="flex-1">
          <p className="text-sm font-medium text-white">{advisoryMessage}</p>
          <p className="text-xs text-white/60 mt-0.5">
            {weather.temperature}°C • {weatherConditions[weather.conditionCode]?.labelHe}
          </p>
        </div>
      </div>
    </div>
  );
}

export default CompactWeatherWidget;
