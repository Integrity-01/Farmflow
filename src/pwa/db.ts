const DB_NAME = 'farmflow';
const DB_VERSION = 1;
const STORE = 'sync_queue';

const isBrowser = typeof indexedDB !== 'undefined';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!isBrowser) {
    return Promise.reject(new Error('IndexedDB is not available.'));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE)) {
        const store = database.createObjectStore(STORE, { keyPath: 'uid' });
        store.createIndex('created_at', 'createdAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
    request.onblocked = () => reject(new Error('IndexedDB upgrade was blocked.'));
  });
  return dbPromise;
}

function withRequest<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE, mode);
        const store = transaction.objectStore(STORE);
        const request = fn(store);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
      }),
  );
}

export async function idbStore<T>(record: T): Promise<void> {
  await withRequest('readwrite', (store) => store.put(record));
}

export async function idbGetAll<T>(): Promise<T[]> {
  return withRequest('readonly', (store) => store.getAll());
}

export async function idbDelete(key: string): Promise<void> {
  await withRequest('readwrite', (store) => store.delete(key));
}

export async function idbCount(): Promise<number> {
  return withRequest('readonly', (store) => store.count());
}