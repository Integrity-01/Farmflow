import { RefreshCw, WifiOff } from 'lucide-react';
import { useAppStore } from '@/store/app.store';
import { useSyncStore } from '@/store/sync.store';
import { flushQueue } from '@/pwa/sync';

export function OfflineBanner() {
  const isOnline = useAppStore((state) => state.isOnline);
  const pending = useSyncStore((state) => state.pending);
  const syncing = useSyncStore((state) => state.syncing);

  if (!isOnline) {
    return (
      <div className="fixed inset-x-0 top-16 z-40 flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-sm font-medium text-white">
        <WifiOff className="size-4" aria-hidden />
        {pending > 0
          ? `Offline — ${pending} change${pending === 1 ? '' : 's'} saved here. Will upload automatically when back online.`
          : "Offline — changes will sync when you're back online."}
      </div>
    );
  }

  if (pending === 0) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 top-16 z-40 flex items-center justify-center gap-2 bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
      <RefreshCw className={`size-4 ${syncing ? 'animate-spin' : ''}`} aria-hidden />
      {syncing
        ? `Syncing ${pending} change${pending === 1 ? '' : 's'}…`
        : `${pending} change${pending === 1 ? '' : 's'} saved offline — uploading soon.`}
      {!syncing ? (
        <button
          type="button"
          className="underline underline-offset-2"
          onClick={() => void flushQueue()}
        >
          Sync now
        </button>
      ) : null}
    </div>
  );
}