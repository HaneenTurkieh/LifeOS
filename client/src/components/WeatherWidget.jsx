import React, { useEffect, useState } from 'react';
import { Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudFog, Loader2 } from 'lucide-react';

// Hardcoded fallback city (no API key needed for open-meteo.com).
const FALLBACK = { lat: 32.2227, lon: 35.2621, label: 'Nablus' };

function iconForCode(code) {
  if (code === 0) return Sun;
  if ([1, 2, 3].includes(code)) return Cloud;
  if ([45, 48].includes(code)) return CloudFog;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return CloudRain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return CloudSnow;
  if ([95, 96, 99].includes(code)) return CloudLightning;
  return Cloud;
}

export default function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchWeather = async (lat, lon, label) => {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&temperature_unit=celsius`
        );
        const data = await res.json();
        if (!cancelled) {
          setWeather({
            temp: Math.round(data.current.temperature_2m),
            code: data.current.weather_code,
            label,
          });
        }
      } catch {
        if (!cancelled) setWeather(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => fetchWeather(pos.coords.latitude, pos.coords.longitude, 'Your location'),
        () => fetchWeather(FALLBACK.lat, FALLBACK.lon, FALLBACK.label),
        { timeout: 4000 }
      );
    } else {
      fetchWeather(FALLBACK.lat, FALLBACK.lon, FALLBACK.label);
    }

    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <Loader2 size={14} className="animate-spin text-ink/30" />;
  }
  if (!weather) return null;

  const Icon = iconForCode(weather.code);

  return (
    <div className="pill bg-white/60 text-ink/70" title={weather.label}>
      <Icon size={13} /> {weather.temp}°C
    </div>
  );
}