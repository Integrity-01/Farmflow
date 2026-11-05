/**
 * Tenant API responses are cached by the service worker (see public/sw.js).
 * The Cache API keys entries by URL only, so the cache must be dropped
 * whenever the signed-in user or organization changes — otherwise a new
 * session could read another organization's cached data.
 *
 * Matches every `farmflow-api-*` cache so old versions are cleaned up too.
 */
export async function clearApiCache(): Promise<void> {
  if (typeof caches === 'undefined') return;
  try {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((key) => key.startsWith('farmflow-api-')).map((key) => caches.delete(key)),
    );
  } catch {
    // Best effort: failing to clear the cache must not block sign-in.
  }
}
