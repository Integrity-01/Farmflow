import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  Snowflake,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import type { WeatherCondition } from '@/types';

export function weatherIcon(condition: WeatherCondition): LucideIcon {
  switch (condition) {
    case 'clear':
      return Sun;
    case 'partly_cloudy':
      return CloudSun;
    case 'fog':
      return CloudFog;
    case 'drizzle':
      return CloudDrizzle;
    case 'rain':
      return CloudRain;
    case 'snow':
      return Snowflake;
    case 'thunderstorm':
      return CloudLightning;
    case 'cloudy':
      return Cloud;
  }
}

export function formatTemp(value: number): string {
  return `${Math.round(value)}°`;
}

export function formatPrecip(value: number | undefined): string {
  if (value === undefined || value <= 0) return '—';
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })} mm`;
}

export function dayLabel(date: string, index: number): string {
  if (index === 0) return 'Today';
  return new Intl.DateTimeFormat(undefined, { weekday: 'short' }).format(new Date(`${date}T12:00:00`));
}