import { useState, useEffect } from 'react';

const CACHE_KEY = 'aurora_weather';
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

export function useWeather() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check cache first
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const { data, timestamp } = JSON.parse(cached);
      if (Date.now() - timestamp < CACHE_TTL) {
        setWeather(data);
        setLoading(false);
        return;
      }
    }

    if (!navigator.geolocation) { setLoading(false); return; }

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const key = import.meta.env.VITE_OPENWEATHER_KEY;
          if (!key) { setLoading(false); return; }

          const res  = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${coords.latitude}&lon=${coords.longitude}&appid=${key}&units=metric`
          );
          const data = await res.json();

          const weather = {
            temp:      Math.round(data.main.temp),
            feels:     Math.round(data.main.feels_like),
            condition: data.weather[0].main,
            desc:      data.weather[0].description,
            icon:      data.weather[0].icon,
            city:      data.name,
            humidity:  data.main.humidity,
            wind:      Math.round(data.wind.speed),
          };

          localStorage.setItem(CACHE_KEY, JSON.stringify({ data: weather, timestamp: Date.now() }));
          setWeather(weather);
        } catch (_) {}
        finally { setLoading(false); }
      },
      () => setLoading(false),
      { timeout: 5000 }
    );
  }, []);

  return { weather, loading };
}

// Weather emoji map
export function weatherEmoji(condition) {
  const map = {
    Clear:        '☀️',
    Clouds:       '☁️',
    Rain:         '🌧️',
    Drizzle:      '🌦️',
    Thunderstorm: '⛈️',
    Snow:         '❄️',
    Mist:         '🌫️',
    Fog:          '🌫️',
    Haze:         '🌫️',
    Dust:         '💨',
    Wind:         '💨',
  };
  return map[condition] || '🌤️';
}