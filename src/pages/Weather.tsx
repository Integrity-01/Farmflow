import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CloudSun, Droplets, MapPin, RefreshCw, Wind } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/Alert';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { ApiError } from '@/services/api';
import { farmsApi } from '@/services/farms';
import { weatherApi } from '@/services/weather';
import { useAuthStore } from '@/store/auth.store';
import { canManageFarms } from '@/services/farms';
import { dayLabel, formatPrecip, formatTemp, weatherIcon } from '@/components/weather/labels';
import { cn } from '@/utils/cn';

const DAY_PERIOD = new Intl.DateTimeFormat(undefined, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

export function Weather() {
  const role = useAuthStore((state) => state.user?.role) ?? null;
  const canManage = canManageFarms(role);

  const [farmId, setFarmId] = useState('');

  const farmsQuery = useQuery({
    queryKey: ['weather-farms'],
    queryFn: () => farmsApi.list({ pageSize: 100 }),
    retry: 0,
  });

  useEffect(() => {
    if (!farmId && farmsQuery.data?.items.length) {
      setFarmId(farmsQuery.data.items[0].id);
    }
  }, [farmsQuery.data, farmId]);

  const weatherQuery = useQuery({
    queryKey: ['weather', farmId],
    queryFn: () => weatherApi.get(farmId),
    enabled: Boolean(farmId),
    refetchInterval: 15 * 60 * 1000,
    retry: 0,
  });

  const selected = useMemo(
    () => farmsQuery.data?.items.find((farm) => farm.id === farmId),
    [farmsQuery.data?.items, farmId],
  );

  const weather = weatherQuery.data?.weather ?? null;
  const reason = weatherQuery.data?.reason;

  const error =
    weatherQuery.error instanceof ApiError
      ? weatherQuery.error.message
      : weatherQuery.error
        ? 'Could not load the weather for this farm.'
        : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Weather</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            Current conditions and a 7-day outlook for your farms
          </p>
        </div>
        <div className="sm:w-64">
          <Select value={farmId} onValueChange={setFarmId} disabled={farmsQuery.isLoading}>
            <SelectTrigger aria-label="Choose a farm">
              <span className="flex items-center gap-2">
                <MapPin className="size-4 text-slate-400" aria-hidden />
                <SelectValue placeholder="Choose a farm" />
              </span>
            </SelectTrigger>
            <SelectContent>
              {farmsQuery.data?.items.map((farm) => (
                <SelectItem key={farm.id} value={farm.id}>
                  {farm.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? (
        <Alert variant="danger">
          <AlertTitle>Could not load weather</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{error}</p>
            <Button variant="outline" size="sm" onClick={() => void weatherQuery.refetch()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {reason === 'NO_COORDINATES' ? (
        <Alert>
          <AlertDescription className="space-y-2">
            <p>
              <span className="font-semibold">{selected?.name}</span> has no coordinates
              set, so live weather can't be fetched.
              {canManage ? ' Add latitude and longitude when editing the farm (e.g. 9.06, 7.49).' : ' Ask a farm manager to add them.'}
            </p>
            <p className="text-xs text-slate-500">
              {selected?.latitude && selected?.longitude
                ? `Current: ${selected.latitude}, ${selected.longitude}`
                : selected?.location
                  ? `Location: ${selected.location}`
                  : 'No location recorded for this farm.'}
            </p>
          </AlertDescription>
        </Alert>
      ) : null}

      {reason === 'UNAVAILABLE' ? (
        <Alert variant="danger">
          <AlertTitle>Weather service unavailable</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>We couldn't reach the weather provider. Check your connection and try again.</p>
            <Button variant="outline" size="sm" onClick={() => void weatherQuery.refetch()}>
              <RefreshCw className="size-4" aria-hidden />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {selected && weather ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="flex size-16 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                  {(() => {
                    const Icon = weatherIcon(weather.current.condition);
                    return <Icon className="size-9" aria-hidden />;
                  })()}
                </span>
                <div>
                  <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold tracking-tight text-slate-900">
                      {formatTemp(weather.current.temperature)}
                    </p>
                    <p className="text-lg font-medium text-slate-500">{weather.current.label}</p>
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {DAY_PERIOD.format(new Date(weather.current.time))}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Metric icon={Droplets} label="Humidity" value={`${Math.round(weather.current.humidity)}%`} />
                <Metric icon={Droplets} label="Precip" value={formatPrecip(weather.current.precipitation)} />
                <Metric icon={Wind} label="Wind" value={`${Math.round(weather.current.windSpeed)} km/h`} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
              7-day outlook
            </h3>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
              {weather.daily.map((day, index) => {
                const Icon = weatherIcon(day.condition);
                return (
                  <div
                    key={day.date}
                    className={cn(
                      'flex flex-col items-center rounded-xl px-2 py-3 text-center',
                      index === 0 ? 'bg-brand-50 ring-1 ring-brand-100' : 'bg-slate-50',
                    )}
                  >
                    <p className="text-xs font-semibold text-slate-500">{dayLabel(day.date, index)}</p>
                    <Icon className="my-2 size-6 text-brand-700" aria-hidden />
                    <p className="text-sm font-bold text-slate-900">
                      {formatTemp(day.tempMax)}
                      <span className="ml-1 font-medium text-slate-400">{formatTemp(day.tempMin)}</span>
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">{formatPrecip(day.precipitationSum)}</p>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      ) : null}

      {!selected && !farmsQuery.isLoading ? (
        <Alert>
          <AlertDescription className="flex items-center gap-2">
            <CloudSun className="size-4 text-slate-400" aria-hidden />
            {farmsQuery.data?.items.length
              ? 'Choose a farm to see its weather forecast.'
              : 'Create a farm with coordinates to see weather forecasts.'}
          </AlertDescription>
        </Alert>
      ) : null}

      {farmsQuery.isLoading || (Boolean(farmId) && weatherQuery.isLoading) ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {[0, 1, 2, 3, 4, 5, 6].map((item) => (
              <Skeleton key={item} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Wind; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
      <Icon className="size-4 shrink-0 text-slate-400" aria-hidden />
      <div>
        <p className="text-sm font-bold leading-tight text-slate-900">{value}</p>
        <p className="text-[11px] leading-tight text-slate-500">{label}</p>
      </div>
    </div>
  );
}