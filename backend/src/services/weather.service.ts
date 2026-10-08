import { pool } from '../database/pool.js';
import type { AuthUser } from '../types/auth.js';
import { roleAtLeast } from '../types/auth.js';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

const CACHE_TTL_MS = 15 * 60 * 1000;
const cache = new Map<string, { at: number; data: unknown }>();

type Condition =
  | 'clear'
  | 'partly_cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'thunderstorm';

function conditionFor(code: number): { condition: Condition; label: string } {
  if (code === 0) return { condition: 'clear', label: 'Clear sky' };
  if (code === 1) return { condition: 'clear', label: 'Mainly clear' };
  if (code === 2) return { condition: 'partly_cloudy', label: 'Partly cloudy' };
  if (code === 3) return { condition: 'cloudy', label: 'Overcast' };
  if (code === 45 || code === 48) return { condition: 'fog', label: 'Fog' };
  if (code >= 51 && code <= 57) return { condition: 'drizzle', label: 'Drizzle' };
  if (code >= 61 && code <= 67) return { condition: 'rain', label: 'Rain' };
  if (code >= 71 && code <= 77) return { condition: 'snow', label: 'Snow' };
  if (code >= 80 && code <= 82) return { condition: 'rain', label: 'Rain showers' };
  if (code >= 85 && code <= 86) return { condition: 'snow', label: 'Snow showers' };
  if (code >= 95) return { condition: 'thunderstorm', label: 'Thunderstorm' };
  return { condition: 'cloudy', label: 'Cloudy' };
}

interface FarmInfo {
  id: string;
  name: string;
  location: string | null;
  latitude: string | null;
  longitude: string | null;
  manager_id: string | null;
}

async function resolveFarmWeather(id: string): Promise<FarmInfo | null> {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!isUuid.test(id)) return null;
  const result = await pool.query<FarmInfo>(
    `SELECT id, name, location, latitude, longitude, manager_id FROM farms WHERE id = $1`,
    [id],
  );
  return result.rows[0] ?? null;
}

async function canViewFarm(
  actor: AuthUser,
  farm: { id: string; manager_id: string | null },
): Promise<boolean> {
  if (roleAtLeast(actor.role, 'farm_manager')) return true;
  if (actor.role === 'supervisor' && farm.manager_id === actor.id) return true;
  const linked = await pool.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM workers WHERE user_id = $1 AND farm_id = $2`,
    [actor.id, farm.id],
  );
  return Number(linked.rows[0].count) > 0;
}

interface OpenMeteoPayload {
  current: {
    time: string;
    temperature_2m: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
  };
  daily: {
    time: string[];
    weather_code: number[];
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    precipitation_sum: number[];
    wind_speed_10m_max: number[];
  };
}

function mapPayload(payload: OpenMeteoPayload) {
  const now = conditionFor(payload.current.weather_code);
  const daily = payload.daily.time.map((date, index) => {
    const day = conditionFor(payload.daily.weather_code[index]);
    return {
      date,
      code: payload.daily.weather_code[index],
      condition: day.condition,
      label: day.label,
      tempMax: payload.daily.temperature_2m_max[index],
      tempMin: payload.daily.temperature_2m_min[index],
      precipitationSum: payload.daily.precipitation_sum[index],
      windSpeedMax: payload.daily.wind_speed_10m_max[index],
    };
  });

  return {
    source: 'open-meteo',
    fetchedAt: new Date().toISOString(),
    current: {
      time: payload.current.time,
      temperature: payload.current.temperature_2m,
      humidity: payload.current.relative_humidity_2m,
      precipitation: payload.current.precipitation,
      windSpeed: payload.current.wind_speed_10m,
      code: payload.current.weather_code,
      condition: now.condition,
      label: now.label,
    },
    daily,
  };
}

async function fetchOpenMeteo(lat: number, lon: number): Promise<unknown> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
    timezone: 'auto',
    forecast_days: '7',
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${FORECAST_URL}?${params}`, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Open-Meteo responded ${response.status}`);
    }
    return mapPayload((await response.json()) as OpenMeteoPayload);
  } finally {
    clearTimeout(timeout);
  }
}

export const weatherService = {
  async getWeather(actor: AuthUser, farmId: string) {
    const farm = await resolveFarmWeather(farmId);
    if (!farm) {
      throw new AppError(404, 'This farm could not be found.', 'NOT_FOUND');
    }
    if (!(await canViewFarm(actor, farm))) {
      throw new AppError(403, "You don't have access to this farm.", 'FORBIDDEN');
    }

    const base = {
      farm: {
        id: farm.id,
        name: farm.name,
        location: farm.location,
        latitude: farm.latitude,
        longitude: farm.longitude,
      },
    };

    if (!farm.latitude || !farm.longitude) {
      return { ...base, weather: null, reason: 'NO_COORDINATES' };
    }

    const cached = cache.get(farm.id);
    if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
      return { ...base, weather: cached.data };
    }

    try {
      const data = await fetchOpenMeteo(Number(farm.latitude), Number(farm.longitude));
      cache.set(farm.id, { at: Date.now(), data });
      return { ...base, weather: data };
    } catch (error) {
      logger.warn('Weather fetch failed', { farmId: farm.id, message: (error as Error).message });
      return { ...base, weather: null, reason: 'UNAVAILABLE' };
    }
  },
};

export type WeatherCondition = Condition;