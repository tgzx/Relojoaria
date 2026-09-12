const CACHE_VERSION = 1;
const CACHE_PREFIX = `vitrinezap:data:v${CACHE_VERSION}:`;
const INDEX_KEY = `${CACHE_PREFIX}__index__`;
const inFlightRequests = new Map();

function resolveStorage(kind = "local") {
  if (typeof window === "undefined") return null;
  try {
    return kind === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}

function safeParse(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeIndex(storage, key) {
  if (!storage || storage !== window.localStorage) return;
  const existing = safeParse(storage.getItem(INDEX_KEY)) || [];
  const next = [key, ...existing.filter((item) => item !== key)].slice(0, 40);
  try {
    storage.setItem(INDEX_KEY, JSON.stringify(next));
  } catch {
    // Cache is best-effort only.
  }
}

function removeFromIndex(storage, keys = []) {
  if (!storage || storage !== window.localStorage || !keys.length) return;
  const removed = new Set(keys);
  const existing = safeParse(storage.getItem(INDEX_KEY)) || [];
  const next = existing.filter((key) => !removed.has(key));
  try {
    storage.setItem(INDEX_KEY, JSON.stringify(next));
  } catch {
    // Cache index cleanup is best-effort only.
  }
}

function pruneLocalCache(storage, maxEntries = 24) {
  if (!storage || storage !== window.localStorage) return;
  const existing = safeParse(storage.getItem(INDEX_KEY)) || [];
  if (existing.length <= maxEntries) return;

  const keep = existing.slice(0, maxEntries);
  existing.slice(maxEntries).forEach((key) => {
    try {
      storage.removeItem(key);
    } catch {
      // Ignore quota/storage cleanup failures.
    }
  });

  try {
    storage.setItem(INDEX_KEY, JSON.stringify(keep));
  } catch {
    // Cache is best-effort only.
  }
}

export function cleanupLegacyDataCache() {
  const target = resolveStorage("local");
  if (!target) return;
  try {
    target.removeItem("vz_home_cache");
  } catch {
    // Legacy cleanup is best-effort only.
  }
}

export function buildCacheKey(...parts) {
  return `${CACHE_PREFIX}${parts
    .flat()
    .map((part) => encodeURIComponent(String(part ?? "")))
    .join(":")}`;
}

export function readDataCache(key, { storage = "local" } = {}) {
  const target = resolveStorage(storage);
  if (!target) return null;

  try {
    const record = safeParse(target.getItem(key));
    if (!record || record.version !== CACHE_VERSION || !record.cachedAt) return null;

    const now = Date.now();
    const expiresAt = Number(record.expiresAt || 0);
    const staleUntil = Number(record.staleUntil || expiresAt || 0);

    if (staleUntil && now > staleUntil) {
      target.removeItem(key);
      removeFromIndex(target, [key]);
      return null;
    }

    return {
      payload: record.payload,
      cachedAt: record.cachedAt,
      ageMs: Math.max(0, now - new Date(record.cachedAt).getTime()),
      fresh: !expiresAt || now <= expiresAt,
      stale: Boolean(expiresAt && now > expiresAt && (!staleUntil || now <= staleUntil))
    };
  } catch {
    return null;
  }
}

export function writeDataCache(
  key,
  payload,
  { storage = "local", ttlMs = 5 * 60 * 1000, staleMs = 24 * 60 * 60 * 1000, maxEntries = 24 } = {}
) {
  const target = resolveStorage(storage);
  if (!target) return false;

  const now = Date.now();
  const record = {
    version: CACHE_VERSION,
    cachedAt: new Date(now).toISOString(),
    expiresAt: now + Math.max(0, ttlMs),
    staleUntil: now + Math.max(ttlMs, staleMs),
    payload
  };

  try {
    target.setItem(key, JSON.stringify(record));
    writeIndex(target, key);
    pruneLocalCache(target, maxEntries);
    return true;
  } catch {
    return false;
  }
}

export function removeDataCache(key, { storage = "local" } = {}) {
  const target = resolveStorage(storage);
  if (!target) return;
  try {
    target.removeItem(key);
    removeFromIndex(target, [key]);
  } catch {
    // Cache is best-effort only.
  }
}

export function invalidateDataCachePrefix(prefix, { storage = "local" } = {}) {
  const target = resolveStorage(storage);
  if (!target) return;

  const fullPrefix = prefix.startsWith(CACHE_PREFIX) ? prefix : `${CACHE_PREFIX}${prefix}`;
  try {
    const keys = [];
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (key?.startsWith(fullPrefix)) keys.push(key);
    }
    keys.forEach((key) => target.removeItem(key));
    removeFromIndex(target, keys);
  } catch {
    // Cache invalidation is best-effort only.
  }
}

export function invalidateStorefrontCache(storeSlug = "") {
  const suffix = encodeURIComponent(String(storeSlug || ""));
  invalidateDataCachePrefix(`public:${suffix}`);
  invalidateDataCachePrefix(`catalog:${suffix}`);
  invalidateDataCachePrefix(`product:${suffix}`);
  invalidateDataCachePrefix(`catalog:${suffix}`, { storage: "session" });
  invalidateDataCachePrefix(`product:${suffix}`, { storage: "session" });
}

export async function dedupeRequest(key, factory) {
  if (inFlightRequests.has(key)) {
    return inFlightRequests.get(key);
  }

  const promise = Promise.resolve()
    .then(factory)
    .finally(() => {
      inFlightRequests.delete(key);
    });

  inFlightRequests.set(key, promise);
  return promise;
}
