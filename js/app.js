import { APP_CONFIG } from "./config.js";
import {
  getPublicHomeData,
  getProducts,
  getProductBySlug,
  incrementProductInterest,
  incrementProductView
} from "./storeApi.js";
import { registerPwa } from "./pwa.js";
import { registerPushButton } from "./push.js";
import { getFutureCartFeatureState, renderAddToCartButton, createFutureCartNotice } from "./cartFuture.js";
import {
  buildWhatsAppLink,
  clearFavorites,
  computeStoreStatus,
  delay,
  escapeHtml,
  formatCurrency,
  getFavorites,
  getHomeCache,
  getPrimaryImage,
  isFavorite,
  parseJsonSafe,
  productBadges,
  qs,
  qsa,
  serializeForm,
  setHomeCache,
  setThemeVariables,
  showToast,
  storeViewedProduct,
  supportsReducedMotion,
  toggleFavorite
} from "./utils.js";

function detectEmbeddedPreview() {
  const params = new URLSearchParams(window.location.search);
  return window.self !== window.top || params.has("embedded_preview");
}

const appState = {
  store: null,
  settings: null,
  sections: [],
  banners: [],
  brands: [],
  categories: [],
  products: [],
  favoriteIds: getFavorites(),
  filters: {
    search: "",
    categoryId: "",
    brandId: "",
    promotionOnly: false,
    newOnly: false,
    priceMin: "",
    priceMax: "",
    sort: "featured"
  },
  pagination: {
    limit: 12,
    offset: 0,
    hasMore: false
  },
  isEmbeddedPreview: detectEmbeddedPreview(),
  isOffline: !navigator.onLine,
  usingCachedData: false,
  currentModalProduct: null,
  carouselCleanup: null,
  sectionNavCleanup: null,
  activeSectionAnchor: "",
  storeStatus: null,
  headerResizeObserver: null
};

async function initApp() {
  bindShellEvents();
  await registerPwa();
  updateHeaderOffset();

  if (APP_CONFIG.SUPABASE_URL.startsWith("COLE_AQUI") || APP_CONFIG.SUPABASE_ANON_KEY.startsWith("COLE_AQUI")) {
    revealStorefrontShell();
    renderSetupRequired();
    return;
  }

  try {
    await loadHomeData();
    await loadCatalogProducts({ reset: true });
    runInitialReveal();
  } catch (error) {
    console.error(error);
    revealStorefrontShell();
    renderFatalState(error);
  }
}

function bindShellEvents() {
  const searchInput = qs("#global-search");
  const filtersForm = qs("#filters-form");

  searchInput?.addEventListener(
    "input",
    debounceSearch(async (event) => {
      appState.filters.search = event.target.value.trim();
      await loadCatalogProducts({ reset: true });
    })
  );

  filtersForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = serializeForm(filtersForm);
    appState.filters = {
      ...appState.filters,
      categoryId: values.categoryId || "",
      brandId: values.brandId || "",
      promotionOnly: Boolean(filtersForm.querySelector("[name='promotionOnly']").checked),
      newOnly: Boolean(filtersForm.querySelector("[name='newOnly']").checked),
      priceMin: values.priceMin || "",
      priceMax: values.priceMax || "",
      sort: values.sort || "featured"
    };
    closeFiltersSheet();
    await loadCatalogProducts({ reset: true });
  });

  qs("#open-filters-button")?.addEventListener("click", openFiltersSheet);
  qs("#close-filters-button")?.addEventListener("click", closeFiltersSheet);
  qs("#reset-sheet-filters-button")?.addEventListener("click", resetFilters);
  qs("#reset-filters-button")?.addEventListener("click", resetFilters);
  qs("#load-more-button")?.addEventListener("click", () => loadCatalogProducts({ reset: false }));
  qs("#clear-favorites-button")?.addEventListener("click", () => {
    clearFavorites();
    appState.favoriteIds = [];
    syncFavoriteButtons();
    renderFavoritesSection();
    showToast("Favoritos limpos neste dispositivo.", "warning");
  });
  qs("#close-product-modal")?.addEventListener("click", closeProductModal);
  qs("#product-modal")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-modal='true']")) closeProductModal();
    const thumbButton = event.target.closest("[data-action='swap-gallery-image']");
    if (thumbButton) swapModalGalleryImage(thumbButton.dataset.imageUrl, thumbButton.dataset.altText);
  });
  qs("#filters-sheet")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-close-sheet='true']")) closeFiltersSheet();
  });

  document.body.addEventListener("click", handleBodyClick);

  window.addEventListener("resize", updateHeaderOffset);
  window.addEventListener("online", handleConnectivityChange);
  window.addEventListener("offline", handleConnectivityChange);
  window.addEventListener("vitrinezap:header-actions-update", applyResponsiveHeaderActions);

  const header = qs(".site-header");
  if (header && "ResizeObserver" in window && !appState.headerResizeObserver) {
    appState.headerResizeObserver = new ResizeObserver(() => updateHeaderOffset());
    appState.headerResizeObserver.observe(header);
  }
}

function debounceSearch(callback) {
  let timerId = 0;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => callback(...args), 240);
  };
}

async function loadHomeData() {
  const offlineBanner = qs("#offline-banner");

  try {
    const home = await getPublicHomeData(APP_CONFIG.STORE_SLUG);
    hydrateHomeState(home, false);
    setHomeCache(home);
    offlineBanner?.classList.toggle("is-hidden", navigator.onLine);
  } catch (error) {
    const cached = getHomeCache();
    if (!cached?.payload) throw error;
    hydrateHomeState(cached.payload, true);
    offlineBanner?.classList.remove("is-hidden");
  }
}

function hydrateHomeState(home, usingCachedData) {
  appState.store = home.store;
  appState.settings = home.settings;
  appState.sections = (home.sections || []).filter((section) => (section.products || []).length);
  appState.banners = home.banners || [];
  appState.brands = home.brands || [];
  appState.categories = home.categories || [];
  appState.usingCachedData = usingCachedData;

  setThemeVariables(home.settings || {}, { context: "storefront" });
  renderStoreFrame();
  renderHero();
  renderDynamicSections();
  renderSectionNavigation();
  renderFilterOptions();
  renderFavoritesSection();

  if (!appState.isEmbeddedPreview) {
    registerPushButton(appState.store.id, {
      enabled: Boolean(appState.settings?.enable_notifications)
    }).catch(() => {});
  }
}

async function runInitialReveal() {
  const loadingScreen = qs("#app-loading-screen");
  const reducedMotion = supportsReducedMotion();
  const introReady = prepareIntroOverlay();

  if (loadingScreen) {
    await delay(reducedMotion ? 0 : 320);
    loadingScreen.classList.add("is-dismissing");
    await delay(reducedMotion ? 0 : 560);
    loadingScreen.remove();
  }

  if (introReady) {
    await finishIntroOverlay();
  } else {
    await waitForStorefrontReady();
    revealStorefrontShell();
  }

  scrollToInitialHashTarget();
}

function revealStorefrontShell() {
  document.body.classList.remove("app-loading");
  document.body.classList.add("app-ready");
  qs("#app-loading-screen")?.remove();
}

function scrollToInitialHashTarget() {
  const hash = window.location.hash;
  if (!hash) return;

  const targetId = hash.slice(1);
  const target = document.getElementById(targetId) || qs(`[data-section-anchor="${targetId}"]`);
  if (!target) return;

  const headerHeight = qs(".site-header")?.offsetHeight || 0;
  const navHeight = qs("#section-nav")?.offsetHeight || 0;
  const targetTop = window.scrollY + target.getBoundingClientRect().top - headerHeight - navHeight - 16;

  window.scrollTo({
    top: Math.max(0, targetTop),
    behavior: supportsReducedMotion() ? "auto" : "smooth"
  });
}

function renderStoreFrame() {
  const logo = appState.store.logo_url || "./assets/icons/icon-192.png";
  qs("#store-logo").src = logo;
  qs("#store-logo").alt = `Logo da loja ${appState.store.name}`;
  qs("#store-name").textContent = appState.store.name;
  qs("#store-slogan").textContent = appState.store.slogan || "Vitrine online integrada ao WhatsApp";
  qs("#footer-store-name").textContent = appState.store.name;
  qs("#footer-store-description").textContent =
    appState.store.description || "Explore os produtos e fale direto com a loja pelo WhatsApp.";

  const status = computeStoreStatus(appState.settings || {});
  appState.storeStatus = status;
  const statusElement = qs("#store-status");
  statusElement.textContent = status.label;
  statusElement.className = status.className;
  setResponsiveHeaderLabel(statusElement, {
    fullLabel: status.label,
    compactLabel: getCompactStatusLabel(status)
  });

  if (appState.isEmbeddedPreview) {
    qs("#install-app-button")?.classList.add("is-hidden");
    qs("#push-button")?.classList.add("is-hidden");
  }

  const defaultWhatsApp = buildWhatsAppLink({
    storeSettings: appState.settings,
    customMessage: appState.settings?.whatsapp_default_message || "Olá! Vim pelo site e gostaria de atendimento."
  });

  qs("#whatsapp-cta").addEventListener("click", () => {
    if (defaultWhatsApp === "#") {
      showToast("Configure o WhatsApp da loja para habilitar esse botão.", "warning");
      return;
    }
    window.open(defaultWhatsApp, "_blank", "noopener");
  });
  setResponsiveHeaderLabel(qs("#whatsapp-cta"), {
    fullLabel: "Falar no WhatsApp",
    compactLabel: "WhatsApp"
  });
  setResponsiveHeaderLabel(qs("#install-app-button"), {
    fullLabel: "Instalar app",
    compactLabel: "App"
  });

  const footerWhatsApp = qs("#footer-whatsapp");
  footerWhatsApp.href = defaultWhatsApp;

  const instagramLink = qs("#footer-instagram");
  if (appState.settings?.instagram_url) {
    instagramLink.href = appState.settings.instagram_url;
    instagramLink.classList.remove("is-hidden");
  }

  applyResponsiveHeaderActions();
}

function renderHero() {
  const heroSection = qs("#hero-section");
  const settings = appState.settings || {};
  const heroMode = settings.hero_mode || "banner";
  const banner = appState.banners[0];
  const heroTheme = normalizeHeroThemeKey(banner?.theme_preset);
  const heroPanelStyle = buildHeroPanelStyle(banner);
  const promoProducts = getFeaturedProducts((product) => product.is_promotion).slice(0, 6);
  const featuredBrands = appState.brands.filter((brand) => brand.is_featured).slice(0, 6);
  const categories = appState.categories.slice(0, 8);

  let asideContent = "";
  let title = banner?.title || appState.store?.name || APP_CONFIG.APP_NAME;
  let subtitle =
    banner?.subtitle ||
    appState.store?.slogan ||
    "Uma vitrine rápida, bonita e pronta para conversar com o cliente no WhatsApp.";

  if (heroMode === "brand_carousel") {
    title = `Marcas que fazem sucesso na ${appState.store.name}`;
    subtitle = "Descubra as marcas em destaque e navegue pelo catálogo sem perder tempo.";
    asideContent = `
      <div class="brand-rail">
        ${featuredBrands
          .map(
            (brand) => `
              <article class="brand-chip">
                <img src="${escapeHtml(brand.logo_url || "./assets/placeholders/product-placeholder.svg")}" alt="${escapeHtml(brand.name)}" />
                <strong>${escapeHtml(brand.name)}</strong>
                <small>Marca disponível na vitrine</small>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  } else if (heroMode === "promotions") {
    title = "Promoções escolhidas para converter rápido";
    subtitle = "Ofertas vivas para o cliente chamar no WhatsApp com uma mensagem pronta.";
    asideContent = `
      <div class="promo-rail">
        ${promoProducts
          .map(
            (product) => `
              <article class="promo-chip">
                <strong>${escapeHtml(product.name)}</strong>
                <small>${formatCurrency(product.price, settings.currency, settings.locale)}</small>
              </article>
            `
          )
          .join("")}
      </div>
    `;
  } else if (heroMode === "categories") {
    title = "Encontre a categoria certa em poucos toques";
    subtitle = "Uma home pensada para facilitar a descoberta dos produtos mais relevantes.";
    asideContent = `
      <div class="category-grid">
        ${categories
          .map(
            (category) => `
              <button class="category-mini-card" type="button" data-action="filter-category" data-category-id="${escapeHtml(category.id)}">
                <strong>${escapeHtml(category.name)}</strong>
                <span>${escapeHtml(category.description || "Ver produtos")}</span>
              </button>
            `
          )
          .join("")}
      </div>
    `;
  } else {
    asideContent = `
      <article class="hero-card">
        <strong>${escapeHtml(banner?.title || "Atendimento ágil")}</strong>
        <p>${escapeHtml(banner?.subtitle || "O cliente navega, escolhe e chama direto no WhatsApp com contexto pronto.")}</p>
      </article>
      <article class="hero-card">
        <strong>Instalável no celular</strong>
        <p>Abra a vitrine como app, receba novidades e navegue mesmo com conexão instável.</p>
      </article>
    `;
  }

  heroSection.innerHTML = `
    <div class="hero-panel hero-panel--${escapeHtml(heroTheme)}" style="${heroPanelStyle}">
      <div class="hero-panel__media" aria-hidden="true"></div>
      <div class="hero-panel__veil" aria-hidden="true"></div>
      <div class="hero-grid">
        <div class="hero-copy">
          <span class="section-kicker">Vitrine em destaque</span>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
          <div class="hero-actions">
            <button class="btn btn-primary" type="button" id="hero-whatsapp-cta">Chamar no WhatsApp</button>
            <a class="btn btn-secondary" href="#all-products-section">Ver produtos</a>
          </div>
        </div>
        <aside class="hero-aside">${asideContent}</aside>
      </div>
    </div>
  `;

  qs("#hero-whatsapp-cta")?.addEventListener("click", () => qs("#whatsapp-cta")?.click());
}

function renderDynamicSections() {
  appState.carouselCleanup?.();

  const root = qs("#dynamic-sections");
  root.innerHTML = appState.sections
    .map((section) => {
      const layout = normalizeSectionLayout(section.layout);
      return `
        <section
          class="container page-section section-layout section-layout--${escapeHtml(layout)}"
          id="section-${escapeHtml(section.slug)}"
          data-section-anchor="${escapeHtml(section.slug)}"
        >
          <div class="section-header">
            <div>
              <span class="section-kicker">${escapeHtml(section.type || "Vitrine")}</span>
              <h2>${escapeHtml(section.title)}</h2>
              ${
                section.description
                  ? `<p class="section-description">${escapeHtml(section.description)}</p>`
                  : ""
              }
            </div>
          </div>
          ${renderSectionProducts(section, layout)}
        </section>
      `;
    })
    .join("");

  setupSectionCarousels();
}

function normalizeSectionLayout(layout) {
  const allowed = new Set(["horizontal_carousel", "grid", "compact_list", "hero_cards"]);
  return allowed.has(layout) ? layout : "horizontal_carousel";
}

function renderSectionProducts(section, layout) {
  const products = section.products || [];

  switch (layout) {
    case "grid":
      return `
        <div class="products-grid products-grid--catalog section-products section-products--grid">
          ${products.map((product) => renderProductCard(product)).join("")}
        </div>
      `;
    case "compact_list":
      return `
        <div class="products-list-compact section-products section-products--compact">
          ${products.map((product) => renderProductCard(product, { variant: "compact" })).join("")}
        </div>
      `;
    case "hero_cards":
      return renderSectionCarouselShell({
        label: section.title,
        railClassName: "products-rail products-hero-rail section-products section-products--hero",
        itemsHtml: products.map((product) => renderProductCard(product, { variant: "hero" })).join("")
      });
    default:
      return renderSectionCarouselShell({
        label: section.title,
        railClassName: "products-rail section-products section-products--carousel",
        itemsHtml: products.map((product) => renderProductCard(product)).join("")
      });
  }
}

function renderSectionCarouselShell({ label, railClassName, itemsHtml }) {
  return `
    <div class="section-carousel-shell" data-carousel-shell>
      <button
        class="carousel-nav carousel-nav--prev is-hidden"
        type="button"
        data-carousel-prev
        aria-label="Ver itens anteriores de ${escapeHtml(label)}"
      >
        <span aria-hidden="true">‹</span>
      </button>
      <div class="section-carousel-viewport" data-carousel-viewport>
        <div class="${railClassName}" data-carousel-rail>
          ${itemsHtml}
        </div>
      </div>
      <button
        class="carousel-nav carousel-nav--next is-hidden"
        type="button"
        data-carousel-next
        aria-label="Ver mais itens de ${escapeHtml(label)}"
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  `;
}

function setupSectionCarousels() {
  appState.carouselCleanup?.();

  const shells = qsa("[data-carousel-shell]");
  if (!shells.length) {
    appState.carouselCleanup = null;
    return;
  }

  const cleanupFns = [];
  const navigationQuery = window.matchMedia("(min-width: 720px)");

  shells.forEach((shell) => {
    const viewport = shell.querySelector("[data-carousel-viewport]");
    const rail = shell.querySelector("[data-carousel-rail]");
    const prevButton = shell.querySelector("[data-carousel-prev]");
    const nextButton = shell.querySelector("[data-carousel-next]");
    const scroller = viewport || rail;

    if (!rail || !scroller || !prevButton || !nextButton) return;

    const updateButtons = () => {
      const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const canScroll = navigationQuery.matches && maxScrollLeft > 6;
      const atStart = scroller.scrollLeft <= 6;
      const atEnd = scroller.scrollLeft >= maxScrollLeft - 6;

      prevButton.classList.toggle("is-hidden", !canScroll || atStart);
      nextButton.classList.toggle("is-hidden", !canScroll || atEnd);
    };

    const scrollByPage = (direction) => {
      const distance = Math.max(scroller.clientWidth * 0.82, 260) * direction;
      scroller.scrollBy({
        left: distance,
        behavior: supportsReducedMotion() ? "auto" : "smooth"
      });
    };

    const handlePrev = () => scrollByPage(-1);
    const handleNext = () => scrollByPage(1);

    prevButton.addEventListener("click", handlePrev);
    nextButton.addEventListener("click", handleNext);
    scroller.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);

    let resizeObserver = null;
    if ("ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => updateButtons());
      resizeObserver.observe(scroller);
      if (rail !== scroller) {
        resizeObserver.observe(rail);
      }
    }

    if (typeof navigationQuery.addEventListener === "function") {
      navigationQuery.addEventListener("change", updateButtons);
    }

    window.requestAnimationFrame(updateButtons);
    window.setTimeout(updateButtons, 120);

    cleanupFns.push(() => {
      prevButton.removeEventListener("click", handlePrev);
      nextButton.removeEventListener("click", handleNext);
      scroller.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
      resizeObserver?.disconnect();
      if (typeof navigationQuery.removeEventListener === "function") {
        navigationQuery.removeEventListener("change", updateButtons);
      }
    });
  });

  appState.carouselCleanup = () => {
    cleanupFns.forEach((cleanup) => cleanup());
  };
}

function renderSectionNavigation() {
  appState.sectionNavCleanup?.();

  const track = qs("#section-nav-track");
  const chips = [];

  if (appState.settings?.enable_favorites && appState.favoriteIds.length) {
    chips.push({ anchor: "favorites", title: "Favoritos" });
  }

  appState.sections.forEach((section) => {
    chips.push({
      anchor: section.slug,
      title: section.title
    });
  });

  chips.push({ anchor: "all-products", title: "Todos os produtos" });

  track.innerHTML = chips
    .map(
      (chip) => `
        <a class="chip" href="#${chip.anchor === "favorites" ? "favorites-section" : chip.anchor === "all-products" ? "all-products-section" : `section-${chip.anchor}`}">
          ${escapeHtml(chip.title)}
        </a>
      `
    )
    .join("");

  setupSectionNavigation();
}

function setupSectionNavigation() {
  const sections = qsa("[data-section-anchor]");
  const chips = qsa("#section-nav-track .chip");
  const track = qs("#section-nav-track");

  if (!sections.length || !chips.length || !track) return;

  const chipMap = new Map(
    chips.map((chip) => {
      const href = chip.getAttribute("href");
      const anchor =
        href === "#favorites-section"
          ? "favorites"
          : href === "#all-products-section"
            ? "all-products"
            : href.replace("#section-", "");
      return [anchor, chip];
    })
  );

  const setActiveAnchor = (anchor) => {
    if (!anchor || appState.activeSectionAnchor === anchor) return;

    appState.activeSectionAnchor = anchor;
    chips.forEach((chip) => chip.classList.remove("is-active"));

    const activeChip = chipMap.get(anchor);
    activeChip?.classList.add("is-active");

    if (activeChip) {
      const trackRect = track.getBoundingClientRect();
      const chipRect = activeChip.getBoundingClientRect();
      const delta = chipRect.left - trackRect.left - trackRect.width / 2 + chipRect.width / 2;
      track.scrollBy({
        left: delta,
        behavior: supportsReducedMotion() ? "auto" : "smooth"
      });
    }

    const href =
      anchor === "favorites"
        ? "#favorites-section"
        : anchor === "all-products"
          ? "#all-products-section"
          : `#section-${anchor}`;
    window.history.replaceState(null, "", href);
  };

  const updateActiveAnchor = () => {
    if (!sections.length) return;

    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 16) {
      setActiveAnchor(sections[sections.length - 1].dataset.sectionAnchor);
      return;
    }

    const headerHeight = qs(".site-header")?.offsetHeight || 0;
    const navHeight = qs("#section-nav")?.offsetHeight || 0;
    const topBoundary = headerHeight + navHeight + 10;
    const focusLine = Math.min(window.innerHeight - 60, topBoundary + Math.max(160, (window.innerHeight - topBoundary) * 0.56));
    const visibleSections = sections
      .map((section) => ({
        section,
        rect: section.getBoundingClientRect()
      }))
      .filter(({ rect }) => rect.bottom > topBoundary && rect.top < window.innerHeight - 24);

    if (!visibleSections.length) return;

    const preferred =
      visibleSections
        .filter(({ rect }) => rect.top <= focusLine)
        .sort((left, right) => right.rect.top - left.rect.top)[0] || visibleSections[visibleSections.length - 1];

    setActiveAnchor(preferred.section.dataset.sectionAnchor);
  };

  const handleChipClick = (event) => {
    event.preventDefault();

    const href = event.currentTarget.getAttribute("href");
    const anchor =
      href === "#favorites-section"
        ? "favorites"
        : href === "#all-products-section"
          ? "all-products"
          : href.replace("#section-", "");
    const target = sections.find((section) => section.dataset.sectionAnchor === anchor);
    if (!target) return;

    const headerHeight = qs(".site-header")?.offsetHeight || 0;
    const navHeight = qs("#section-nav")?.offsetHeight || 0;
    const targetTop = window.scrollY + target.getBoundingClientRect().top - headerHeight - navHeight - 16;

    setActiveAnchor(anchor);
    window.scrollTo({
      top: Math.max(0, targetTop),
      behavior: supportsReducedMotion() ? "auto" : "smooth"
    });
  };

  let frameId = 0;
  const requestUpdate = () => {
    if (frameId) return;
    frameId = window.requestAnimationFrame(() => {
      frameId = 0;
      updateActiveAnchor();
    });
  };

  chips.forEach((chip) => chip.addEventListener("click", handleChipClick));
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", requestUpdate);
  requestUpdate();

  appState.sectionNavCleanup = () => {
    chips.forEach((chip) => chip.removeEventListener("click", handleChipClick));
    window.removeEventListener("scroll", requestUpdate);
    window.removeEventListener("resize", requestUpdate);
    if (frameId) window.cancelAnimationFrame(frameId);
  };
}

function renderFilterOptions() {
  const categorySelect = qs("#filter-category");
  const brandSelect = qs("#filter-brand");

  categorySelect.innerHTML =
    `<option value="">Todas</option>` +
    appState.categories
      .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)}</option>`)
      .join("");

  brandSelect.innerHTML =
    `<option value="">Todas</option>` +
    appState.brands
      .map((brand) => `<option value="${escapeHtml(brand.id)}">${escapeHtml(brand.name)}</option>`)
      .join("");
}

async function loadCatalogProducts({ reset }) {
  if (!appState.store) return;

  const productsGrid = qs("#products-grid");
  const emptyState = qs("#empty-products-state");
  const loadMoreButton = qs("#load-more-button");

  if (reset) {
    appState.pagination.offset = 0;
    appState.products = [];
    emptyState.classList.add("is-hidden");
    productsGrid.innerHTML = `
      <div class="product-skeleton-grid">
        <article class="product-card-skeleton">
          <div class="skeleton skeleton-thumb"></div>
          <div class="skeleton skeleton-chip"></div>
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-copy"></div>
        </article>
        <article class="product-card-skeleton">
          <div class="skeleton skeleton-thumb"></div>
          <div class="skeleton skeleton-chip"></div>
          <div class="skeleton skeleton-title"></div>
          <div class="skeleton skeleton-copy"></div>
        </article>
      </div>
    `;
  }

  try {
    const result = await getProducts({
      storeId: appState.store.id,
      search: appState.filters.search,
      categoryId: appState.filters.categoryId,
      brandId: appState.filters.brandId,
      flags: {
        promotionOnly: appState.filters.promotionOnly,
        newOnly: appState.filters.newOnly
      },
      priceMin: appState.filters.priceMin,
      priceMax: appState.filters.priceMax,
      sort: appState.filters.sort,
      limit: appState.pagination.limit,
      offset: appState.pagination.offset
    });

    appState.products = reset ? result.data : [...appState.products, ...result.data];
    appState.pagination.offset = appState.products.length;
    appState.pagination.hasMore = result.hasMore;

    renderCatalogProducts();
    renderProductsSummary(result.count);
    renderFavoritesSection();
    toggleResetFiltersButton();

    loadMoreButton.classList.toggle("is-hidden", !appState.pagination.hasMore);
  } catch (error) {
    console.error(error);
    productsGrid.innerHTML = "";
    emptyState.innerHTML = `
      <h3>Erro ao carregar produtos</h3>
      <p>Tente novamente em instantes. Se o problema continuar, revise a configuração do Supabase.</p>
    `;
    emptyState.classList.remove("is-hidden");
    loadMoreButton.classList.add("is-hidden");
  }
}

function renderCatalogProducts() {
  const productsGrid = qs("#products-grid");
  const emptyState = qs("#empty-products-state");

  if (!appState.products.length) {
    productsGrid.innerHTML = "";
    emptyState.innerHTML = `
      <h3>${appState.filters.search || hasActiveFilters() ? "Nenhum produto encontrado" : "Loja sem produtos publicados"}</h3>
      <p>${
        appState.filters.search || hasActiveFilters()
          ? "Tente ajustar a busca ou limpar os filtros para ver mais itens."
          : "Assim que o gerente cadastrar produtos ativos, eles aparecerão aqui."
      }</p>
    `;
    emptyState.classList.remove("is-hidden");
    return;
  }

  emptyState.classList.add("is-hidden");
  productsGrid.innerHTML = appState.products.map((product) => renderProductCard(product)).join("");
  syncFavoriteButtons();
}

function renderProductsSummary(totalCount) {
  const summary = qs("#products-summary");
  if (!summary) return;

  const activeParts = [];
  if (appState.filters.search) activeParts.push(`busca por "${appState.filters.search}"`);
  if (appState.filters.categoryId) {
    const category = appState.categories.find((item) => item.id === appState.filters.categoryId);
    if (category) activeParts.push(`categoria ${category.name}`);
  }
  if (appState.filters.brandId) {
    const brand = appState.brands.find((item) => item.id === appState.filters.brandId);
    if (brand) activeParts.push(`marca ${brand.name}`);
  }
  if (appState.filters.promotionOnly) activeParts.push("somente promoções");
  if (appState.filters.newOnly) activeParts.push("somente novidades");

  summary.textContent = activeParts.length
    ? `${totalCount} produto(s) encontrados para ${activeParts.join(", ")}.`
    : `${totalCount} produto(s) disponíveis na vitrine.`;
}

function renderFavoritesSection() {
  const section = qs("#favorites-section");
  const grid = qs("#favorites-grid");

  if (!appState.settings?.enable_favorites || !appState.favoriteIds.length) {
    section.classList.add("is-hidden");
    return;
  }

  const productMap = new Map();
  [...appState.products, ...appState.sections.flatMap((sectionItem) => sectionItem.products || [])].forEach((product) => {
    productMap.set(product.id, product);
  });

  const favoriteProducts = appState.favoriteIds.map((id) => productMap.get(id)).filter(Boolean);

  if (!favoriteProducts.length) {
    section.classList.add("is-hidden");
    return;
  }

  section.classList.remove("is-hidden");
  grid.innerHTML = favoriteProducts.map((product) => renderProductCard(product)).join("");
}

function renderProductCard(product, options = {}) {
  const settings = appState.settings || {};
  const productUrl = `${window.location.origin}${window.location.pathname}#produto-${product.slug}`;
  const whatsappLink = buildWhatsAppLink({
    product,
    storeSettings: settings,
    pageUrl: productUrl
  });
  const badges = productBadges(product);
  const futureCartEnabled = getFutureCartFeatureState(settings);
  const variant = options.variant || "default";
  const cardClassName = ["product-card", variant !== "default" ? `product-card--${variant}` : ""].filter(Boolean).join(" ");

  return `
    <article class="${cardClassName}" data-product-id="${escapeHtml(product.id)}">
      <div class="product-card__media">
        <img
          src="${escapeHtml(getPrimaryImage(product))}"
          alt="${escapeHtml(product.name)}"
          loading="lazy"
        />
        <div class="product-card__badges">
          ${badges
            .map(
              (badge) =>
                `<span class="product-badge ${badge.variant ? `product-badge--${badge.variant}` : ""}">${escapeHtml(badge.label)}</span>`
            )
            .join("")}
        </div>
        ${
          appState.settings?.enable_favorites
            ? `
              <button
                class="favorite-button ${isFavorite(product.id) ? "is-active" : ""}"
                type="button"
                aria-label="Favoritar produto"
                data-action="toggle-favorite"
                data-product-id="${escapeHtml(product.id)}"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20.25 4.5 12.93a4.95 4.95 0 0 1 0-7.08 5.14 5.14 0 0 1 7.2 0L12 6.15l.3-.3a5.14 5.14 0 0 1 7.2 0 4.95 4.95 0 0 1 0 7.08L12 20.25Z"></path>
                </svg>
              </button>
            `
            : ""
        }
      </div>
      <div class="product-card__meta">
        <div class="product-card__eyebrow">
          <span>${escapeHtml(product.brand?.name || "Marca livre")}</span>
          <span>${escapeHtml(product.category?.name || "Categoria")}</span>
        </div>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-card__description">${escapeHtml(product.short_description || "Sem descrição curta.")}</p>
        <div class="price-line">
          <span class="price-current">${formatCurrency(product.price, settings.currency, settings.locale)}</span>
          ${
            product.old_price
              ? `<span class="price-old">${formatCurrency(product.old_price, settings.currency, settings.locale)}</span>`
              : ""
          }
        </div>
      </div>
      <div class="product-card__actions">
        <button class="btn btn-secondary" type="button" data-action="open-product" data-product-slug="${escapeHtml(product.slug)}">
          Ver detalhes
        </button>
        <div class="stacked-actions">
          ${
            product.allow_whatsapp_cta
              ? `<a class="btn btn-primary" href="${whatsappLink}" target="_blank" rel="noreferrer" data-action="whatsapp-product" data-product-id="${escapeHtml(product.id)}">WhatsApp</a>`
              : ""
          }
          <button class="btn btn-ghost" type="button" data-action="interest-product" data-product-id="${escapeHtml(product.id)}">
            Tenho interesse
          </button>
        </div>
        ${futureCartEnabled ? renderAddToCartButton(product) : ""}
      </div>
    </article>
  `;
}

async function openProductModal(slug) {
  const modal = qs("#product-modal");
  const content = qs("#product-modal-content");
  modal.classList.remove("is-hidden");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  content.innerHTML = `
    <div class="product-modal__grid">
      <div class="product-modal__gallery">
        <div class="skeleton skeleton-thumb"></div>
      </div>
      <div class="hero-skeleton">
        <div class="skeleton skeleton-title"></div>
        <div class="skeleton skeleton-copy"></div>
        <div class="skeleton skeleton-copy short"></div>
      </div>
    </div>
  `;

  try {
    const product = await getProductBySlug(appState.store.id, slug);
    appState.currentModalProduct = product;
    storeViewedProduct(product);
    renderProductModal(product);
    incrementProductView(product.id).catch(() => {});
  } catch (error) {
    console.error(error);
    content.innerHTML = `
      <div class="empty-state">
        <h3>Produto indisponível</h3>
        <p>Não foi possível carregar os detalhes agora. Tente novamente em instantes.</p>
      </div>
    `;
  }
}

function renderProductModal(product) {
  const content = qs("#product-modal-content");
  const settings = appState.settings || {};
  const images = product.images?.length
    ? [...product.images].sort((left, right) => (left.sort_order || 0) - (right.sort_order || 0))
    : [{ image_url: "./assets/placeholders/product-placeholder.svg", alt_text: product.name }];
  const mainImage = images[0];
  const whatsappLink = buildWhatsAppLink({
    product,
    storeSettings: settings,
    pageUrl: `${window.location.origin}${window.location.pathname}#produto-${product.slug}`
  });
  const attributes = Object.entries(product.attributes || {});
  const variants = Array.isArray(product.variants) ? product.variants : [];

  content.innerHTML = `
    <div class="product-modal__grid">
      <div class="product-modal__gallery">
        <figure class="product-modal__main-image">
          <img id="modal-main-image" src="${escapeHtml(mainImage.image_url)}" alt="${escapeHtml(mainImage.alt_text || product.name)}" />
        </figure>
        <div class="product-modal__thumbs">
          ${images
            .map(
              (image) => `
                <button
                  class="product-thumb-button"
                  type="button"
                  data-action="swap-gallery-image"
                  data-image-url="${escapeHtml(image.image_url)}"
                  data-alt-text="${escapeHtml(image.alt_text || product.name)}"
                >
                  <img src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.alt_text || product.name)}" />
                </button>
              `
            )
            .join("")}
        </div>
      </div>
      <div class="product-modal__copy">
        <span class="section-kicker">${escapeHtml(product.category?.name || "Detalhes do produto")}</span>
        <h2 id="product-modal-title">${escapeHtml(product.name)}</h2>
        <p class="product-modal__description">${escapeHtml(product.description || product.short_description || "Sem descrição completa no momento.")}</p>
        <div class="price-line">
          <span class="price-current">${formatCurrency(product.price, settings.currency, settings.locale)}</span>
          ${
            product.old_price
              ? `<span class="price-old">${formatCurrency(product.old_price, settings.currency, settings.locale)}</span>`
              : ""
          }
        </div>
        <dl class="product-modal__meta">
          <div>
            <dt>Marca</dt>
            <dd>${escapeHtml(product.brand?.name || "Não informada")}</dd>
          </div>
          <div>
            <dt>Categoria</dt>
            <dd>${escapeHtml(product.category?.name || "Não informada")}</dd>
          </div>
          <div>
            <dt>SKU</dt>
            <dd>${escapeHtml(product.sku || product.slug)}</dd>
          </div>
          <div>
            <dt>Disponibilidade</dt>
            <dd>${escapeHtml(humanizeStock(product))}</dd>
          </div>
        </dl>
        ${
          variants.length
            ? `
              <div>
                <strong>Variações</strong>
                <div class="variation-list">
                  ${variants
                    .map(
                      (variant) =>
                        `<span class="mini-pill">${escapeHtml(variant.name || variant.label || "Variação")}: ${escapeHtml(
                          Array.isArray(variant.options) ? variant.options.join(", ") : String(variant.options || variant.value || "")
                        )}</span>`
                    )
                    .join("")}
                </div>
              </div>
            `
            : ""
        }
        ${
          attributes.length
            ? `
              <div>
                <strong>Características</strong>
                <div class="attribute-list">
                  ${attributes
                    .map(([key, value]) => `<span class="mini-pill">${escapeHtml(key)}: ${escapeHtml(String(value))}</span>`)
                    .join("")}
                </div>
              </div>
            `
            : ""
        }
        <div class="modal-actions">
          ${
            product.allow_whatsapp_cta
              ? `<a class="btn btn-primary" href="${whatsappLink}" target="_blank" rel="noreferrer">Chamar no WhatsApp</a>`
              : ""
          }
          <button class="btn btn-secondary" type="button" data-action="interest-product" data-product-id="${escapeHtml(product.id)}">Tenho interesse</button>
          ${
            getFutureCartFeatureState(settings)
              ? renderAddToCartButton(product)
              : ""
          }
        </div>
      </div>
    </div>
  `;
}

function closeProductModal() {
  const modal = qs("#product-modal");
  modal.classList.add("is-hidden");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function swapModalGalleryImage(imageUrl, altText) {
  const image = qs("#modal-main-image");
  if (!image) return;
  image.src = imageUrl;
  image.alt = altText || appState.currentModalProduct?.name || "Imagem do produto";
}

function openFiltersSheet() {
  const sheet = qs("#filters-sheet");
  sheet.classList.remove("is-hidden");
  sheet.setAttribute("aria-hidden", "false");
  syncFilterForm();
}

function closeFiltersSheet() {
  const sheet = qs("#filters-sheet");
  sheet.classList.add("is-hidden");
  sheet.setAttribute("aria-hidden", "true");
}

function syncFilterForm() {
  const form = qs("#filters-form");
  if (!form) return;
  form.categoryId.value = appState.filters.categoryId;
  form.brandId.value = appState.filters.brandId;
  form.sort.value = appState.filters.sort;
  form.priceMin.value = appState.filters.priceMin;
  form.priceMax.value = appState.filters.priceMax;
  form.querySelector("[name='promotionOnly']").checked = appState.filters.promotionOnly;
  form.querySelector("[name='newOnly']").checked = appState.filters.newOnly;
}

async function resetFilters() {
  appState.filters = {
    search: qs("#global-search")?.value?.trim() || "",
    categoryId: "",
    brandId: "",
    promotionOnly: false,
    newOnly: false,
    priceMin: "",
    priceMax: "",
    sort: "featured"
  };
  syncFilterForm();
  closeFiltersSheet();
  await loadCatalogProducts({ reset: true });
}

function toggleResetFiltersButton() {
  qs("#reset-filters-button")?.classList.toggle("is-hidden", !hasActiveFilters());
}

function hasActiveFilters() {
  return Boolean(
    appState.filters.categoryId ||
      appState.filters.brandId ||
      appState.filters.promotionOnly ||
      appState.filters.newOnly ||
      appState.filters.priceMin ||
      appState.filters.priceMax ||
      appState.filters.sort !== "featured"
  );
}

function handleConnectivityChange() {
  appState.isOffline = !navigator.onLine;
  qs("#offline-banner")?.classList.toggle("is-hidden", navigator.onLine && !appState.usingCachedData);
}

function updateHeaderOffset() {
  const headerHeight = qs(".site-header")?.offsetHeight || 146;
  document.documentElement.style.setProperty("--header-height", `${headerHeight}px`);
  document.documentElement.style.setProperty("--header-offset", `${headerHeight + 76}px`);
  applyResponsiveHeaderActions();
  window.requestAnimationFrame(() => {
    if (appState.sectionNavCleanup) {
      const activeChip = qsa("#section-nav-track .chip.is-active")[0];
      if (!activeChip) return;
      activeChip.classList.remove("is-active");
      appState.activeSectionAnchor = "";
    }
  });
}

function isCompactHeaderViewport() {
  return window.matchMedia("(max-width: 719px)").matches;
}

function getCompactStatusLabel(status) {
  if (!status) return "💬";
  if (status.className.includes("status-pill--warning")) return "🟠";
  if (status.className.includes("status-pill--muted")) return "💬";
  return "🟢";
}

function setResponsiveHeaderLabel(element, { fullLabel, compactLabel }) {
  if (!element) return;
  element.dataset.fullLabel = fullLabel;
  element.dataset.compactLabel = compactLabel || fullLabel;
}

function applyResponsiveHeaderActions() {
  const isCompact = isCompactHeaderViewport();
  [
    qs("#store-status"),
    qs("#whatsapp-cta"),
    qs("#install-app-button"),
    qs("#push-button")
  ]
    .filter(Boolean)
    .forEach((element) => {
      const fullLabel = element.dataset.fullLabel || element.textContent.trim();
      const compactLabel = element.dataset.compactLabel || fullLabel;
      element.textContent = isCompact ? compactLabel : fullLabel;
      element.setAttribute("aria-label", fullLabel);
      element.setAttribute("title", fullLabel);
    });
}

async function handleBodyClick(event) {
  const actionElement = event.target.closest("[data-action]");
  if (!actionElement) return;

  const action = actionElement.dataset.action;

  if (action === "open-product") {
    await openProductModal(actionElement.dataset.productSlug);
    return;
  }

  if (action === "toggle-favorite") {
    const next = toggleFavorite(actionElement.dataset.productId);
    appState.favoriteIds = next;
    syncFavoriteButtons();
    renderFavoritesSection();
    showToast(isFavorite(actionElement.dataset.productId) ? "Produto favoritado." : "Produto removido dos favoritos.");
    return;
  }

  if (action === "interest-product") {
    const product = findKnownProduct(actionElement.dataset.productId);
    await handleProductInterest(product);
    return;
  }

  if (action === "future-add-to-cart") {
    showToast(createFutureCartNotice(), "warning");
    return;
  }

  if (action === "filter-category") {
    appState.filters.categoryId = actionElement.dataset.categoryId;
    syncFilterForm();
    await loadCatalogProducts({ reset: true });
  }
}

async function handleProductInterest(product) {
  if (!product) return;

  try {
    await incrementProductInterest(product.id);
  } catch (error) {
    console.warn("Falha ao registrar interesse", error);
  }

  const link = buildWhatsAppLink({
    product,
    storeSettings: appState.settings,
    pageUrl: `${window.location.origin}${window.location.pathname}#produto-${product.slug}`
  });

  showToast("Interesse registrado. Vamos abrir o WhatsApp para você continuar.");
  if (link !== "#") window.open(link, "_blank", "noopener");
}

function findKnownProduct(productId) {
  return [...appState.products, ...appState.sections.flatMap((section) => section.products || [])].find(
    (product) => product.id === productId
  );
}

function syncFavoriteButtons() {
  qsa("[data-action='toggle-favorite']").forEach((button) => {
    button.classList.toggle("is-active", appState.favoriteIds.includes(button.dataset.productId));
  });
}

function humanizeStock(product) {
  if (product.stock_status === "out_of_stock") return "Indisponível";
  if (product.stock_status === "preorder") return "Sob encomenda";
  if (product.stock_status === "low_stock" || Number(product.stock_quantity) <= 3) return "Últimas unidades";
  return "Disponível";
}

function prepareIntroOverlay() {
  const overlay = qs("#intro-overlay");
  const introMode = appState.settings?.intro_mode || "logo";
  if (introMode === "disabled" || appState.isEmbeddedPreview) {
    overlay.classList.add("is-hidden");
    return false;
  }

  const logo = appState.store?.logo_url || "./assets/icons/icon-192.png";
  overlay.classList.remove("is-hidden");
  overlay.classList.remove("is-dismissing");

  if (introMode === "brand_carousel") {
    overlay.innerHTML = `
      <div class="intro-card">
        <div class="intro-logo-shell">
          <img src="${escapeHtml(logo)}" alt="${escapeHtml(appState.store?.name || APP_CONFIG.APP_NAME)}" />
        </div>
        <p class="section-kicker">Marcas em destaque</p>
        <h1 class="intro-title">${escapeHtml(appState.store?.name || APP_CONFIG.APP_NAME)}</h1>
        <p class="intro-description">${escapeHtml(appState.store?.slogan || "Uma vitrine pensada para encurtar o caminho até a conversa no WhatsApp.")}</p>
        <div class="intro-brand-track">
          ${appState.brands
            .slice(0, 6)
            .map(
              (brand) => `
                <div class="intro-brand-chip">
                  <strong>${escapeHtml(brand.name)}</strong>
                </div>
              `
            )
            .join("")}
        </div>
      </div>
    `;
  } else {
    overlay.innerHTML = `
      <div class="intro-card">
        <div class="intro-logo-shell">
          <img src="${escapeHtml(logo)}" alt="${escapeHtml(appState.store?.name || APP_CONFIG.APP_NAME)}" />
        </div>
        <p class="section-kicker">Bem-vindo</p>
        <h1 class="intro-title">${escapeHtml(appState.store?.name || APP_CONFIG.APP_NAME)}</h1>
        <p class="intro-description">${escapeHtml(appState.store?.slogan || "Seu catálogo digital integrado ao WhatsApp.")}</p>
      </div>
    `;
  }

  return true;
}

async function finishIntroOverlay() {
  const overlay = qs("#intro-overlay");
  const reducedMotion = supportsReducedMotion();

  await delay(reducedMotion ? 250 : 2000);
  await waitForStorefrontReady();
  revealStorefrontShell();
  await delay(reducedMotion ? 0 : 320);
  overlay.classList.add("is-dismissing");
  await delay(reducedMotion ? 0 : 560);
  overlay.classList.add("is-hidden");
  overlay.innerHTML = "";
  return true;
}

async function waitForStorefrontReady() {
  const criticalImages = [
    qs("#store-logo"),
    qs("#hero-section img"),
    ...qsa("#dynamic-sections img, #products-grid img").slice(0, 6)
  ].filter(Boolean);

  await Promise.race([
    Promise.all(criticalImages.map(waitForImageReady)),
    delay(1800)
  ]);
}

function waitForImageReady(image) {
  if (image.complete && image.naturalWidth > 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const finish = () => {
      image.removeEventListener("load", finish);
      image.removeEventListener("error", finish);
      resolve();
    };

    image.addEventListener("load", finish, { once: true });
    image.addEventListener("error", finish, { once: true });
  });
}

function getFeaturedProducts(predicate) {
  return appState.sections.flatMap((section) => section.products || []).filter(predicate);
}

function normalizeHeroThemeKey(theme) {
  const allowed = new Set(["classic-night", "sunset-amber", "ocean-steel", "forest-luxe", "soft-ivory"]);
  return allowed.has(theme) ? theme : "classic-night";
}

function clampHeroValue(value, fallback, min, max) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, numeric));
}

function escapeCssUrl(url) {
  return String(url || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\)/g, "\\)");
}

function buildHeroPanelStyle(banner) {
  const imageUrl = banner?.image_url ? `url("${escapeCssUrl(banner.image_url)}")` : "none";
  const allowedPositions = new Set([
    "center center",
    "top center",
    "bottom center",
    "center left",
    "center right"
  ]);
  const imagePosition = allowedPositions.has(banner?.image_position) ? banner.image_position : "center center";
  const imageFit = banner?.image_fit === "contain" ? "contain" : "cover";
  const brightness = clampHeroValue(banner?.image_brightness, 0.92, 0.4, 1.6);
  const contrast = clampHeroValue(banner?.image_contrast, 1.05, 0.6, 1.8);
  const overlayStrength = clampHeroValue(banner?.overlay_strength, 0.56, 0.08, 0.92);

  return [
    `--hero-bg-image: ${imageUrl}`,
    `--hero-image-position: ${imagePosition}`,
    `--hero-image-fit: ${imageFit}`,
    `--hero-image-brightness: ${brightness}`,
    `--hero-image-contrast: ${contrast}`,
    `--hero-overlay-strength: ${overlayStrength}`
  ].join("; ");
}

function renderSetupRequired() {
  qs("#hero-section").innerHTML = `
    <div class="empty-state">
      <h3>Configuração do Supabase pendente</h3>
      <p>Preencha a URL do projeto e a anon key em <code>js/config.js</code> para carregar a vitrine.</p>
    </div>
  `;
  qs("#dynamic-sections").innerHTML = "";
  qs("#products-grid").innerHTML = "";
}

function renderFatalState(error) {
  const missingSchema =
    error?.code === "PGRST205" ||
    String(error?.message || "").includes("schema cache") ||
    String(error?.message || "").includes("public.stores");

  qs("#hero-section").innerHTML = `
    <div class="empty-state">
      <h3>${missingSchema ? "Banco ainda não configurado" : "Não foi possível carregar a vitrine"}</h3>
      <p>${
        missingSchema
          ? "O projeto Supabase respondeu, mas as tabelas da vitrine ainda não estão disponíveis. Rode o arquivo supabase/schema.sql e depois supabase/seed.sql no SQL Editor."
          : escapeHtml(error.message || "Revise as credenciais do Supabase e o schema do projeto.")
      }</p>
    </div>
  `;
  qs("#dynamic-sections").innerHTML = "";
  qs("#products-grid").innerHTML = "";
}

initApp();
