class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  get length() {
    return this.map.size;
  }

  key(index) {
    return Array.from(this.map.keys())[index] ?? null;
  }

  getItem(key) {
    return this.map.has(String(key)) ? this.map.get(String(key)) : null;
  }

  setItem(key, value) {
    this.map.set(String(key), String(value));
  }

  removeItem(key) {
    this.map.delete(String(key));
  }

  clear() {
    this.map.clear();
  }
}

const localStorage = new MemoryStorage();
const sessionStorage = new MemoryStorage();
globalThis.window = { localStorage, sessionStorage };

const cache = await import(`../js/dataCache.js?test=${Date.now()}`);
const checks = [];

function check(name, condition) {
  checks.push([name, Boolean(condition)]);
}

const storeSlug = "J-Gold-Relojoaria";
const homeKey = cache.buildCacheKey("public", storeSlug, "home");
const catalogKey = cache.buildCacheKey("catalog", storeSlug, "{}");
const productKey = cache.buildCacheKey("product", storeSlug, "produto-x");
const otherStoreKey = cache.buildCacheKey("public", "outra-loja", "home");

check(
  "write local cache",
  cache.writeDataCache(homeKey, { ok: 1 }, { storage: "local", ttlMs: 1000, staleMs: 5000 })
);
check("fresh cache is returned", cache.readDataCache(homeKey, { storage: "local" })?.fresh === true);

cache.writeDataCache(catalogKey, { items: [1] }, { storage: "session", ttlMs: 1000, staleMs: 5000 });
cache.writeDataCache(productKey, { id: 1 }, { storage: "session", ttlMs: 1000, staleMs: 5000 });
cache.writeDataCache(otherStoreKey, { ok: 2 }, { storage: "local", ttlMs: 1000, staleMs: 5000 });
cache.invalidateStorefrontCache(storeSlug);

check("invalidate public cache for target store", cache.readDataCache(homeKey, { storage: "local" }) === null);
check("invalidate catalog session cache", cache.readDataCache(catalogKey, { storage: "session" }) === null);
check("invalidate product session cache", cache.readDataCache(productKey, { storage: "session" }) === null);
check(
  "preserve cache from another store",
  cache.readDataCache(otherStoreKey, { storage: "local" })?.payload?.ok === 2
);

let requestCalls = 0;
const [firstResult, secondResult] = await Promise.all([
  cache.dedupeRequest("same-request", async () => {
    requestCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 25));
    return 7;
  }),
  cache.dedupeRequest("same-request", async () => {
    requestCalls += 1;
    return 9;
  })
]);

check("dedupe executes factory once", requestCalls === 1);
check("dedupe shares same result", firstResult === 7 && secondResult === 7);

cache.writeDataCache(homeKey, { ok: 3 }, { storage: "local", ttlMs: 1000, staleMs: 5000 });
const staleRecord = JSON.parse(localStorage.getItem(homeKey));
staleRecord.expiresAt = Date.now() - 10;
staleRecord.staleUntil = Date.now() + 1000;
localStorage.setItem(homeKey, JSON.stringify(staleRecord));
const staleCache = cache.readDataCache(homeKey, { storage: "local" });

check(
  "stale cache remains available inside stale window",
  staleCache?.stale === true && staleCache?.fresh === false && staleCache?.payload?.ok === 3
);

const expiredRecord = JSON.parse(localStorage.getItem(homeKey));
expiredRecord.expiresAt = Date.now() - 2000;
expiredRecord.staleUntil = Date.now() - 1000;
localStorage.setItem(homeKey, JSON.stringify(expiredRecord));
check("expired stale cache is pruned", cache.readDataCache(homeKey, { storage: "local" }) === null);

for (const [name, passed] of checks) {
  console.log(`${passed ? "PASS" : "FAIL"} ${name}`);
}

const failed = checks.filter(([, passed]) => !passed);
if (failed.length) {
  process.exitCode = 1;
  throw new Error(`${failed.length} cache regression test(s) failed.`);
}

console.log(`PASS ${checks.length}/${checks.length} cache regression checks`);
