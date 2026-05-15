const STORAGE_KEYS = {
  favorites: "vz_favorites",
  viewedProducts: "vz_viewed_products",
  homeCache: "vz_home_cache"
};

const DAYS_MAP = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export function qs(selector, scope = document) {
  return scope.querySelector(selector);
}

export function qsa(selector, scope = document) {
  return Array.from(scope.querySelectorAll(selector));
}

export function slugify(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function formatCurrency(value, currency = "BRL", locale = "pt-BR") {
  const amount = Number(value || 0);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency
  }).format(amount);
}

export function formatDateTime(value, locale = "pt-BR") {
  if (!value) return "-";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

export function debounce(fn, wait = 250) {
  let timerId = null;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => fn(...args), wait);
  };
}

export function getJSONStorage(key, fallback = null) {
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch (error) {
    console.warn(`Falha ao ler localStorage: ${key}`, error);
    return fallback;
  }
}

export function setJSONStorage(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Falha ao salvar localStorage: ${key}`, error);
  }
}

export function getFavorites() {
  return getJSONStorage(STORAGE_KEYS.favorites, []);
}

export function isFavorite(productId) {
  return getFavorites().includes(productId);
}

export function toggleFavorite(productId) {
  const favorites = new Set(getFavorites());
  if (favorites.has(productId)) {
    favorites.delete(productId);
  } else {
    favorites.add(productId);
  }
  const nextFavorites = Array.from(favorites);
  setJSONStorage(STORAGE_KEYS.favorites, nextFavorites);
  return nextFavorites;
}

export function clearFavorites() {
  setJSONStorage(STORAGE_KEYS.favorites, []);
}

export function storeViewedProduct(product) {
  if (!product?.id) return;
  const viewed = getJSONStorage(STORAGE_KEYS.viewedProducts, []);
  const cleaned = viewed.filter((item) => item.id !== product.id);
  cleaned.unshift({
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    short_description: product.short_description,
    images: product.images || [],
    brand: product.brand || null,
    category: product.category || null,
    viewed_at: new Date().toISOString()
  });
  setJSONStorage(STORAGE_KEYS.viewedProducts, cleaned.slice(0, 12));
}

export function getViewedProducts() {
  return getJSONStorage(STORAGE_KEYS.viewedProducts, []);
}

export function getHomeCache() {
  return getJSONStorage(STORAGE_KEYS.homeCache, null);
}

export function setHomeCache(payload) {
  setJSONStorage(STORAGE_KEYS.homeCache, {
    cached_at: new Date().toISOString(),
    payload
  });
}

export function parseJsonSafe(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch (error) {
    return fallback;
  }
}

export function buildWhatsAppLink({ product, storeSettings, customMessage, pageUrl = window.location.href }) {
  const number = String(storeSettings?.whatsapp_number || "").replace(/\D/g, "");
  const currency = storeSettings?.currency || "BRL";
  const locale = storeSettings?.locale || "pt-BR";

  if (!number) {
    return "#";
  }

  const defaultMessage =
    customMessage ||
    (product
      ? `Olá! Tenho interesse no produto ${product.name}, código ${product.sku || product.slug}, preço ${formatCurrency(product.price, currency, locale)}. Ele ainda está disponível? Link: ${pageUrl}`
      : storeSettings?.whatsapp_default_message || "Olá! Vim pelo site e gostaria de atendimento.");

  return `https://wa.me/${number}?text=${encodeURIComponent(defaultMessage)}`;
}

export function getPrimaryImage(product) {
  const images = Array.isArray(product?.images) ? [...product.images] : [];
  const ordered = images.sort((left, right) => {
    if (left.is_primary && !right.is_primary) return -1;
    if (!left.is_primary && right.is_primary) return 1;
    return (left.sort_order || 0) - (right.sort_order || 0);
  });

  return (
    ordered[0]?.image_url ||
    ordered[0]?.url ||
    "./assets/placeholders/product-placeholder.svg"
  );
}

export function productBadges(product) {
  const badges = [];
  if (product.is_promotion) badges.push({ label: "Promoção", variant: "sale" });
  if (product.is_new) badges.push({ label: "Novidade", variant: "new" });
  if (product.is_best_seller) badges.push({ label: "Mais vendido", variant: "default" });
  if (product.stock_status === "low_stock" || Number(product.stock_quantity) <= 3) {
    badges.push({ label: "Últimas unidades", variant: "warning" });
  }
  return badges;
}

export function normalizeProduct(row = {}) {
  return {
    ...row,
    category: row.category || null,
    brand: row.brand || null,
    images: Array.isArray(row.images) ? row.images : [],
    tags: Array.isArray(row.tags) ? row.tags : [],
    attributes: row.attributes || {},
    variants: Array.isArray(row.variants) ? row.variants : []
  };
}

export function serializeForm(form) {
  return Object.fromEntries(new FormData(form).entries());
}

export function showToast(message, tone = "default") {
  const root = qs("#toast-root");
  if (!root) return;

  const toast = document.createElement("div");
  toast.className = `toast ${tone === "default" ? "" : `toast--${tone}`}`.trim();
  toast.textContent = message;
  root.appendChild(toast);

  window.setTimeout(() => {
    toast.remove();
  }, 3400);
}

export function setThemeVariables(settings = {}) {
  const root = document.documentElement;
  if (settings.primary_color) root.style.setProperty("--color-primary", settings.primary_color);
  if (settings.secondary_color) {
    root.style.setProperty("--color-secondary", settings.secondary_color);
    root.style.setProperty("--admin-accent", settings.secondary_color);
  }
}

export function computeStoreStatus(settings = {}) {
  const hours = settings.business_hours || {};
  const now = new Date();
  const dayKey = DAYS_MAP[now.getDay()];
  const periods = Array.isArray(hours?.[dayKey]) ? hours[dayKey] : [];

  if (!periods.length) {
    return {
      label: "Atendimento via WhatsApp",
      className: "status-pill status-pill--muted"
    };
  }

  const minutes = now.getHours() * 60 + now.getMinutes();
  const isOpen = periods.some((period) => {
    const [startHour = "0", startMinute = "0"] = String(period.start || "").split(":");
    const [endHour = "0", endMinute = "0"] = String(period.end || "").split(":");
    const start = Number(startHour) * 60 + Number(startMinute);
    const end = Number(endHour) * 60 + Number(endMinute);
    return minutes >= start && minutes <= end;
  });

  if (isOpen) {
    return {
      label: "Aberta agora",
      className: "status-pill"
    };
  }

  return {
    label: "Fechada no momento",
    className: "status-pill status-pill--warning"
  };
}

export function supportsReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function delay(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export function buildProductSearchText(product = {}) {
  return [
    product.name,
    product.short_description,
    product.description,
    product.sku,
    product.brand?.name,
    product.category?.name,
    ...(product.tags || [])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export function filterProductsLocally(products = [], search = "") {
  if (!search) return products;
  const needle = search.trim().toLowerCase();
  return products.filter((product) => buildProductSearchText(product).includes(needle));
}

export function renderEmptyState({ title, description, actionLabel, actionId }) {
  return `
    <div class="empty-state">
      <span class="section-kicker">Sem resultados</span>
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
      ${
        actionLabel && actionId
          ? `<button class="btn btn-secondary" type="button" id="${escapeHtml(actionId)}">${escapeHtml(actionLabel)}</button>`
          : ""
      }
    </div>
  `;
}

export function buildStorageFileName(fileName = "arquivo") {
  const sanitized = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]/g, "-");

  return `${Date.now()}-${sanitized}`.replace(/-+/g, "-");
}
