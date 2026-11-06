// src/services/cache.js
const CACHE_DB_NAME = "hub-animes-public-cache-v1";
const CACHE_STORE = "entries";
export const PUBLIC_CACHE_TTL = 6 * 60 * 60 * 1000;

let cacheDbPromise;

function openCacheDb() {
  if (cacheDbPromise) return cacheDbPromise;
  cacheDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(CACHE_STORE)) {
        req.result.createObjectStore(CACHE_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return cacheDbPromise;
}

export async function cacheGet(key) {
  try {
    const d = await openCacheDb();
    return await new Promise((resolve, reject) => {
      const r = d.transaction(CACHE_STORE, "readonly").objectStore(CACHE_STORE).get(key);
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    });
  } catch (e) {
    return null;
  }
}

export async function cacheSet(key, data) {
  try {
    const d = await openCacheDb();
    await new Promise((resolve, reject) => {
      const tx = d.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).put({ data, savedAt: Date.now() }, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {
    console.warn("Cache local indisponível", e);
  }
}

export async function cacheDelete(key) {
  try {
    const d = await openCacheDb();
    await new Promise((resolve, reject) => {
      const tx = d.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  } catch (e) {}
}

export async function freshOrCached(key, fetcher) {
  const cached = await cacheGet(key);
  if (cached && Date.now() - cached.savedAt < PUBLIC_CACHE_TTL) return cached.data;
  try {
    const fresh = await fetcher();
    await cacheSet(key, fresh);
    return fresh;
  } catch (err) {
    if (cached) return cached.data;
    throw err;
  }
}