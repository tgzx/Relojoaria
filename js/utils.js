const STORAGE_KEYS = {
  favorites: "vz_favorites",
  viewedProducts: "vz_viewed_products",
  homeCache: "vz_home_cache"
};

const DAYS_MAP = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

const STORE_THEME_PRESETS = {
  light: {
    label: "Areia clara",
    colorScheme: "light",
    bgTop: "#fffaf5",
    bg: "#f6efe5",
    bgBottom: "#f7f1ea",
    surface: "rgba(255, 255, 255, 0.9)",
    surfaceStrong: "#ffffff",
    text: "#1f2937",
    textSoft: "#6b7280",
    border: "rgba(17, 24, 39, 0.08)",
    headerBg: "rgba(246, 239, 229, 0.88)",
    headerBorder: "rgba(17, 24, 39, 0.06)",
    mutedBg: "rgba(17, 24, 39, 0.06)",
    mutedBgStrong: "rgba(17, 24, 39, 0.12)",
    footerBg: "#111827",
    footerText: "rgba(255, 255, 255, 0.86)"
  },
  midnight: {
    label: "Noite elegante",
    colorScheme: "dark",
    bgTop: "#0e1525",
    bg: "#111827",
    bgBottom: "#0a1020",
    surface: "rgba(18, 25, 39, 0.9)",
    surfaceStrong: "#182234",
    text: "#f3f6fb",
    textSoft: "#b2bfd3",
    border: "rgba(255, 255, 255, 0.08)",
    headerBg: "rgba(10, 15, 26, 0.86)",
    headerBorder: "rgba(255, 255, 255, 0.06)",
    mutedBg: "rgba(255, 255, 255, 0.08)",
    mutedBgStrong: "rgba(255, 255, 255, 0.14)",
    footerBg: "#050912",
    footerText: "rgba(255, 255, 255, 0.9)"
  },
  ocean: {
    label: "Azul oceano",
    colorScheme: "light",
    bgTop: "#f4fbff",
    bg: "#eaf4f8",
    bgBottom: "#e5eef4",
    surface: "rgba(255, 255, 255, 0.92)",
    surfaceStrong: "#ffffff",
    text: "#173042",
    textSoft: "#5f7384",
    border: "rgba(23, 48, 66, 0.1)",
    headerBg: "rgba(234, 244, 248, 0.9)",
    headerBorder: "rgba(23, 48, 66, 0.08)",
    mutedBg: "rgba(23, 48, 66, 0.06)",
    mutedBgStrong: "rgba(23, 48, 66, 0.12)",
    footerBg: "#173042",
    footerText: "rgba(255, 255, 255, 0.9)"
  },
  forest: {
    label: "Verde ateliê",
    colorScheme: "light",
    bgTop: "#f7fbf5",
    bg: "#edf4ec",
    bgBottom: "#e7efe4",
    surface: "rgba(255, 255, 255, 0.92)",
    surfaceStrong: "#ffffff",
    text: "#24362c",
    textSoft: "#6a7d71",
    border: "rgba(36, 54, 44, 0.08)",
    headerBg: "rgba(237, 244, 236, 0.9)",
    headerBorder: "rgba(36, 54, 44, 0.08)",
    mutedBg: "rgba(36, 54, 44, 0.06)",
    mutedBgStrong: "rgba(36, 54, 44, 0.12)",
    footerBg: "#1b2c22",
    footerText: "rgba(255, 255, 255, 0.88)"
  },
  rose: {
    label: "Rosé editorial",
    colorScheme: "light",
    bgTop: "#fff8fa",
    bg: "#f7ecef",
    bgBottom: "#f3e5e9",
    surface: "rgba(255, 255, 255, 0.92)",
    surfaceStrong: "#ffffff",
    text: "#352735",
    textSoft: "#7d6b7b",
    border: "rgba(53, 39, 53, 0.08)",
    headerBg: "rgba(247, 236, 239, 0.9)",
    headerBorder: "rgba(53, 39, 53, 0.08)",
    mutedBg: "rgba(53, 39, 53, 0.05)",
    mutedBgStrong: "rgba(53, 39, 53, 0.1)",
    footerBg: "#241a28",
    footerText: "rgba(255, 255, 255, 0.9)"
  }
};

export const STORE_THEME_OPTIONS = Object.entries(STORE_THEME_PRESETS).map(([value, config]) => ({
  value,
  label: config.label
}));

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

function clampColorChannel(value) {
  return Math.max(0, Math.min(255, value));
}

function normalizeHexColor(value, fallback) {
  const candidate = String(value || "").trim();
  const safeFallback = String(fallback || "#000000").trim();
  const expanded = candidate.replace(/^#/, "");
  const normalized = expanded.length === 3 ? expanded.split("").map((char) => char + char).join("") : expanded;
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `#${normalized.toLowerCase()}`;
  }
  return safeFallback;
}

function hexToRgb(hex) {
  const safeHex = normalizeHexColor(hex, "#000000").slice(1);
  return {
    r: Number.parseInt(safeHex.slice(0, 2), 16),
    g: Number.parseInt(safeHex.slice(2, 4), 16),
    b: Number.parseInt(safeHex.slice(4, 6), 16)
  };
}

function hexToRgba(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function mixHexColors(colorA, colorB, ratio = 0.5) {
  const safeRatio = Math.max(0, Math.min(1, ratio));
  const left = hexToRgb(colorA);
  const right = hexToRgb(colorB);
  const r = clampColorChannel(Math.round(left.r + (right.r - left.r) * safeRatio));
  const g = clampColorChannel(Math.round(left.g + (right.g - left.g) * safeRatio));
  const b = clampColorChannel(Math.round(left.b + (right.b - left.b) * safeRatio));
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function resolveStoreThemePreset(themeMode = "light") {
  const aliases = {
    dark: "midnight",
    night: "midnight",
    custom: "light"
  };
  const normalizedMode = aliases[themeMode] || themeMode;
  return STORE_THEME_PRESETS[normalizedMode] || STORE_THEME_PRESETS.light;
}

export function getStoreThemeLabel(themeMode = "light") {
  return resolveStoreThemePreset(themeMode).label;
}

export function setThemeVariables(settings = {}, options = {}) {
  const { context = "storefront" } = options;
  const root = document.documentElement;
  const themePreset = resolveStoreThemePreset(settings.theme_mode || "light");
  const primaryColor = normalizeHexColor(settings.primary_color, "#111827");
  const secondaryColor = normalizeHexColor(settings.secondary_color, "#e56b2f");

  root.style.setProperty("--admin-primary", primaryColor);
  root.style.setProperty("--admin-accent", secondaryColor);

  if (context !== "storefront") {
    return;
  }

  const isDarkScheme = themePreset.colorScheme === "dark";
  const accentSoftAlpha = isDarkScheme ? 0.24 : 0.14;
  const primaryGlowAlpha = isDarkScheme ? 0.2 : 0.08;
  const secondaryGlowAlpha = isDarkScheme ? 0.24 : 0.16;
  const chipBg = isDarkScheme ? "rgba(255, 255, 255, 0.94)" : "rgba(255, 255, 255, 0.78)";
  const chipText = isDarkScheme ? "#203047" : themePreset.textSoft;
  const chipBorder = isDarkScheme ? "rgba(255, 255, 255, 0.1)" : "rgba(17, 24, 39, 0.09)";
  const favoriteBg = isDarkScheme ? "rgba(255, 255, 255, 0.96)" : "rgba(255, 255, 255, 0.88)";
  const favoriteFg = isDarkScheme ? "#223247" : themePreset.text;
  const favoriteBorder = isDarkScheme ? "rgba(255, 255, 255, 0.12)" : "rgba(17, 24, 39, 0.06)";

  root.style.colorScheme = themePreset.colorScheme;
  root.style.setProperty("--color-primary", primaryColor);
  root.style.setProperty("--color-secondary", secondaryColor);
  root.style.setProperty("--color-bg-top", themePreset.bgTop);
  root.style.setProperty("--color-bg", themePreset.bg);
  root.style.setProperty("--color-bg-bottom", themePreset.bgBottom);
  root.style.setProperty("--color-surface", themePreset.surface);
  root.style.setProperty("--color-surface-strong", themePreset.surfaceStrong);
  root.style.setProperty("--color-text", themePreset.text);
  root.style.setProperty("--color-text-soft", themePreset.textSoft);
  root.style.setProperty("--color-border", themePreset.border);
  root.style.setProperty("--color-muted-bg", themePreset.mutedBg);
  root.style.setProperty("--color-muted-bg-strong", themePreset.mutedBgStrong);
  root.style.setProperty("--color-header-bg", themePreset.headerBg);
  root.style.setProperty("--color-header-border", themePreset.headerBorder);
  root.style.setProperty("--color-footer-bg", themePreset.footerBg);
  root.style.setProperty("--color-footer-text", themePreset.footerText);
  root.style.setProperty("--color-footer-link", secondaryColor);
  root.style.setProperty("--color-accent-soft", hexToRgba(secondaryColor, accentSoftAlpha));
  root.style.setProperty("--color-page-glow-primary", hexToRgba(secondaryColor, secondaryGlowAlpha));
  root.style.setProperty("--color-page-glow-secondary", hexToRgba(primaryColor, primaryGlowAlpha));
  root.style.setProperty("--color-surface-tint", mixHexColors(themePreset.bgTop, secondaryColor, isDarkScheme ? 0.18 : 0.08));
  root.style.setProperty("--color-chip-bg", chipBg);
  root.style.setProperty("--color-chip-text", chipText);
  root.style.setProperty("--color-chip-border", chipBorder);
  root.style.setProperty("--color-chip-active-bg", primaryColor);
  root.style.setProperty("--color-chip-active-text", "#ffffff");
  root.style.setProperty("--color-favorite-bg", favoriteBg);
  root.style.setProperty("--color-favorite-fg", favoriteFg);
  root.style.setProperty("--color-favorite-border", favoriteBorder);
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
