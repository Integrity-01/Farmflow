import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CloudSun, MapPin, Plus, Sprout } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { weatherApi } from '@/services/weather';
import { canManageFarms } from '@/services/farms';
import { useAuthStore } from '@/store/auth.store';
import type { Farm, FarmWeatherResponse } from '@/types';
import { formatTemp, weatherIcon } from '@/components/weather/labels';

interface FarmWithWeather {
  farm: Farm;
  weather: FarmWeatherResponse['weather'];
  reason?: FarmWeatherResponse['reason'];
}

export function Dashboard() {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const role = useAuthStore((state) => state.user?.role) ?? null;
  const canManage = canManageFarms(role);

  const overviewQuery = useQuery({
    queryKey: ['dashboard-overview'],
    queryFn: async (): Promise<FarmWithWeather[]> => {
      const page = await farmsApi.list({ pageSize: 100 });
      const rows = await Promise.all(
        page.items.slice(0, 10).map(async (farm): Promise<FarmWithWeather> => {
          try {
            const weather = await weatherApi.get(farm.id);
            return { farm, weather: weather.weather, reason: weather.reason };
          } catch {
            return { farm, weather: null, reason: 'UNAVAILABLE' };
          }
        }),
      );
      return rows;
    },
    refetchInterval: 15 * 60 * 1000,
    retry: 0,
    staleTime: 60_000,
  });

  const overviewError =
    overviewQuery.error instanceof ApiError
      ? overviewQuery.error.message
      : overviewQuery.error
        ? 'Could not load your farms.'
        : null;

  const farms = overviewQuery.data ?? [];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            {greeting} 👋
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Here's what's happening on your farm today.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/tasks?new=1">
              <Plus className="size-4" aria-hidden />
              Create task
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/weather">
              <CloudSun className="size-4" aria-hidden />
              Weather
            </Link>
          </Button>
          {canManage ? (
            <Button variant="outline" asChild>
              <Link to="/farms">
                <Sprout className="size-4" aria-hidden />
                Add farm
              </Link>
            </Button>
          ) : null}
        </div>
      </section>

      {overviewError ? (
        <Alert variant="danger">
          <AlertTitle>Could not load your farms</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{overviewError}</p>
            <Button variant="outline" size="sm" onClick={() => void overviewQuery.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <section aria-label="Farms and location">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Farms &amp; location
          </h3>
          {farms.length > 0 ? (
            <Link
              to="/farms"
              className="text-xs font-semibold text-brand-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 rounded"
            >
              View all
            </Link>
          ) : null}
        </div>

        {overviewQuery.isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        ) : farms.length > 0 ? (
          <ul className="space-y-2">
            {farms.map(({ farm, weather, reason }) => (
              <li key={farm.id}>
                <FarmLocationRow farm={farm} weather={weather} reason={reason} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            icon={MapPin}
            title={canManage ? 'No farms yet' : 'No farms to show'}
            description={
              canManage
                ? 'Add your first farm — with its location — to start tracking tasks, inventory and weather.'
                : 'Farms you are part of will appear here.'
            }
            action={
              canManage ? (
                <Button asChild>
                  <Link to="/farms">
                    <Plus className="size-4" aria-hidden />
                    Add your first farm
                  </Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}

function FarmLocationRow({
  farm,
  weather,
  reason,
}: {
  farm: Farm;
  weather: FarmWeatherResponse['weather'];
  reason?: FarmWeatherResponse['reason'];
}) {
  const hasCoords = Boolean(farm.latitude && farm.longitude);
  const locationLine = farm.location
    ? hasCoords
      ? `${farm.location} · ${farm.latitude}, ${farm.longitude}`
      : farm.location
    : hasCoords
      ? `Coordinates ${farm.latitude}, ${farm.longitude}`
      : 'No location set';

  const weatherHint =
    reason === 'NO_COORDINATES'
      ? 'Add coordinates for weather'
      : reason === 'UNAVAILABLE'
        ? 'Weather unavailable'
        : null;

  return (
    <Link
      to="/farms"
      className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          <MapPin className="size-4" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-slate-900">{farm.name}</span>
          <span className="block truncate text-xs text-slate-500">{locationLine}</span>
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {weather ? (
          <span
            className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 text-sm font-semibold text-slate-700"
            title={weather.current.label}
          >
            {(() => {
              const Icon = weatherIcon(weather.current.condition);
              return <Icon className="size-4 text-brand-700" aria-hidden />;
            })()}
            {formatTemp(weather.current.temperature)}
          </span>
        ) : weatherHint ? (
          <span className="hidden text-xs text-slate-400 sm:inline">{weatherHint}</span>
        ) : null}
        <span className="hidden text-xs text-slate-400 md:inline">
          {farm.fieldCount} fields · {farm.pendingTasks} open
        </span>
      </div>
    </Link>
  );
}