import { APP_CONFIG } from "./config.js";
import { supabase } from "./supabaseClient.js";
import {
  adminBulkUpdateProducts,
  adminCreateAuditLog,
  adminCreateProduct,
  adminDeleteBanner,
  adminDeleteBrand,
  adminDeleteCategory,
  adminDeleteProduct,
  adminDeleteProductImage,
  adminListBanners,
  adminListBrands,
  adminListCategories,
  adminListNotifications,
  adminListProducts,
  adminListPushSubscriptionsSummary,
  adminListSections,
  adminRefreshAutomaticSection,
  adminSaveBanner,
  adminSaveBrand,
  adminSaveCategory,
  adminSaveNotification,
  adminSaveSection,
  adminSaveStoreSettings,
  adminSendNotification,
  adminUpdateProduct,
  adminUpdateProductImage,
  adminUpdateStore,
  createProductImageRecord,
  getCurrentUserProfile,
  getStoreSettings,
  getMyStoreMemberships,
  uploadBannerImage,
  uploadProductImage
} from "./storeApi.js";
import {
  escapeHtml,
  formatCurrency,
  formatDateTime,
  getStoreThemeLabel,
  getPrimaryImage,
  normalizeStoreThemeMode,
  parseJsonSafe,
  qs,
  qsa,
  setThemeVariables,
  STORE_THEME_OPTIONS,
  showToast,
  slugify
} from "./utils.js";

const TABS = [
  { id: "dashboard", label: "Visão geral" },
  { id: "products", label: "Produtos" },
  { id: "sections", label: "Seções" },
  { id: "categories", label: "Categorias" },
  { id: "brands", label: "Marcas" },
  { id: "appearance", label: "Banners" },
  { id: "notifications", label: "Notificações" },
  { id: "automations", label: "Automações" },
  { id: "settings", label: "Configurações" },
  { id: "preview", label: "Pré-visualizar" }
];

const HERO_THEME_OPTIONS = [
  { value: "classic-night", label: "Classic Night" },
  { value: "sunset-amber", label: "Sunset Amber" },
  { value: "ocean-steel", label: "Ocean Steel" },
  { value: "forest-luxe", label: "Forest Luxe" },
  { value: "soft-ivory", label: "Soft Ivory" }
];

const HERO_POSITION_OPTIONS = [
  { value: "center center", label: "Centro" },
  { value: "top center", label: "Topo" },
  { value: "bottom center", label: "Base" },
  { value: "center left", label: "Esquerda" },
  { value: "center right", label: "Direita" }
];

const HERO_FIT_OPTIONS = [
  { value: "cover", label: "Preencher" },
  { value: "contain", label: "Conter" }
];

const BUSINESS_HOURS_DAYS = [
  { key: "monday", label: "Segunda" },
  { key: "tuesday", label: "Terça" },
  { key: "wednesday", label: "Quarta" },
  { key: "thursday", label: "Quinta" },
  { key: "friday", label: "Sexta" },
  { key: "saturday", label: "Sábado" },
  { key: "sunday", label: "Domingo" }
];

const adminState = {
  session: null,
  profile: null,
  membership: null,
  store: null,
  settings: null,
  products: [],
  categories: [],
  brands: [],
  sections: [],
  banners: [],
  notifications: [],
  pushSummary: { count: 0, data: [] },
  editingProduct: null,
  editingSection: null,
  editingCategory: null,
  editingBrand: null,
  editingBanner: null,
  currentAdminTab: "dashboard",
  productEditorStep: 1,
  pendingProductFiles: [],
  pendingBannerFile: null,
  selectedProductIds: [],
  productFilters: {
    search: "",
    status: "",
    categoryId: "",
    brandId: "",
    sectionId: ""
  },
  isLoadingAdminData: false,
  isAdminDataLoadQueued: false,
  hasLoadedAdminData: false,
  lastLoadedUserId: null,
  hasUnsavedAdminFormChanges: false,
  dirtyAdminTab: null,
  pendingBackgroundRender: false,
  isSavingProduct: false,
  productSaveMode: null
};

const openAdminModalKeys = new Set();

let globalDebugHandlersRegistered = false;

function registerGlobalDebugHandlers() {
  if (globalDebugHandlersRegistered) return;
  globalDebugHandlersRegistered = true;

  window.addEventListener("error", (event) => {
    console.error("Erro global capturado", {
      message: event.message,
      source: event.filename,
      line: event.lineno,
      column: event.colno
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Promise rejeitada sem catch", {
      reason: event.reason?.message || String(event.reason)
    });
  }, 0);
}

function resetAdminSessionState() {
  adminState.isLoadingAdminData = false;
  adminState.isAdminDataLoadQueued = false;
  adminState.hasLoadedAdminData = false;
  adminState.lastLoadedUserId = null;
  adminState.hasUnsavedAdminFormChanges = false;
  adminState.dirtyAdminTab = null;
  adminState.pendingBackgroundRender = false;
  openAdminModalKeys.clear();
  syncAdminModalBodyScroll();
}

function syncAdminModalBodyScroll() {
  const shouldLockScroll = openAdminModalKeys.size > 0;
  document.documentElement.style.overflow = shouldLockScroll ? "hidden" : "";
  document.body.style.overflow = shouldLockScroll ? "hidden" : "";
}

function setAdminModalOpen(modalKey, isOpen) {
  if (!modalKey) return;
  if (isOpen) {
    openAdminModalKeys.add(modalKey);
  } else {
    openAdminModalKeys.delete(modalKey);
  }

  syncAdminModalBodyScroll();
}

function markAdminFormDirty(tabId = adminState.currentAdminTab) {
  adminState.hasUnsavedAdminFormChanges = true;
  adminState.dirtyAdminTab = tabId;
}

function clearAdminFormDirty(tabId = null) {
  if (tabId && adminState.dirtyAdminTab && adminState.dirtyAdminTab !== tabId) {
    return;
  }

  adminState.hasUnsavedAdminFormChanges = false;
  adminState.dirtyAdminTab = null;
}

function bindDirtyFormState(selector, tabId = adminState.currentAdminTab) {
  const form = qs(selector);
  if (!form) return;

  const markDirty = () => markAdminFormDirty(tabId);
  form.addEventListener("input", markDirty);
  form.addEventListener("change", markDirty);
}

function renderAdminLayoutFromBackground() {
  if (adminState.hasUnsavedAdminFormChanges && adminState.dirtyAdminTab === adminState.currentAdminTab) {
    adminState.pendingBackgroundRender = true;
    return;
  }

  adminState.pendingBackgroundRender = false;
  renderAdminLayout();
}

function triggerAdminDataLoad() {
  const sessionUserId = adminState.session?.user?.id;
  if (!sessionUserId) {
    return;
  }
  if (adminState.isLoadingAdminData || adminState.isAdminDataLoadQueued) {
    return;
  }
  if (
    adminState.hasLoadedAdminData &&
    adminState.lastLoadedUserId === sessionUserId &&
    adminState.store
  ) {
    return;
  }
  adminState.isAdminDataLoadQueued = true;
  window.setTimeout(() => {
    adminState.isAdminDataLoadQueued = false;
    loadAdminData().catch((error) => {
      console.error("Erro não tratado em loadAdminData", error.message || String(error));
    });
  });
}

async function initAdmin() {
  registerGlobalDebugHandlers();

  if (APP_CONFIG.SUPABASE_URL.startsWith("COLE_AQUI") || APP_CONFIG.SUPABASE_ANON_KEY.startsWith("COLE_AQUI")) {
    renderSetupMessage();
    return;
  }

  supabase.auth.onAuthStateChange((event, session) => {
    adminState.session = session;
    if (!session || event === "SIGNED_OUT") {
      resetAdminSessionState();
      renderLogin();
      return;
    }

    if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") {
      return;
    }

    const sameLoadedUser =
      adminState.hasLoadedAdminData &&
      adminState.lastLoadedUserId === session.user.id &&
      adminState.store;

    if (sameLoadedUser) {
      return;
    }

    if (["SIGNED_IN", "USER_UPDATED", "PASSWORD_RECOVERY"].includes(event) || !adminState.store) {
      adminState.hasLoadedAdminData = false;
      adminState.lastLoadedUserId = null;
      triggerAdminDataLoad();
    }
  });

  await requireAuth();
}

async function requireAuth() {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    resetAdminSessionState();
    renderLogin();
    return;
  }

  adminState.session = data.session;
  if (!data.session) {
    resetAdminSessionState();
    renderLogin();
    return;
  }

  adminState.hasLoadedAdminData = false;
  adminState.lastLoadedUserId = null;
  triggerAdminDataLoad();
}

async function loadAdminData() {
  if (adminState.isLoadingAdminData) {
    return;
  }

  const sessionUserId = adminState.session?.user?.id || null;
  adminState.isLoadingAdminData = true;

  try {
    // Timeout helper
    const withTimeout = (promise, timeoutMs, label) => {
      return Promise.race([
        promise,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`${label} demorou mais de ${timeoutMs / 1000}s`)), timeoutMs)
        )
      ]);
    };

    const profilePromise = withTimeout(getCurrentUserProfile(), 10000, "getCurrentUserProfile");
    const profile = await profilePromise;

    const membershipsPromise = withTimeout(getMyStoreMemberships(), 10000, "getMyStoreMemberships");
    const memberships = await membershipsPromise;

    const membership = memberships.find((item) => ["owner", "manager"].includes(item.role) && item.store?.is_active);
    adminState.profile = profile;
    adminState.membership = membership || null;

    if (!membership) {
      renderAccessDenied();
      return;
    }

    adminState.store = membership.store;

    const settingsPromise = withTimeout(getStoreSettings(membership.store.id).catch(() => null), 10000, "getStoreSettings");
    const productsPromise = withTimeout(adminListProducts(membership.store.id, adminState.productFilters), 10000, "adminListProducts");
    const categoriesPromise = withTimeout(adminListCategories(membership.store.id), 10000, "adminListCategories");
    const brandsPromise = withTimeout(adminListBrands(membership.store.id), 10000, "adminListBrands");
    const sectionsPromise = withTimeout(adminListSections(membership.store.id), 10000, "adminListSections");
    const bannersPromise = withTimeout(adminListBanners(membership.store.id), 10000, "adminListBanners");
    const notificationsPromise = withTimeout(adminListNotifications(membership.store.id), 10000, "adminListNotifications");
    const pushSummaryPromise = withTimeout(adminListPushSubscriptionsSummary(membership.store.id), 10000, "adminListPushSubscriptionsSummary");

    const [settings, productsRes, categories, brands, sections, banners, notifications, pushSummary] = await Promise.all([
      settingsPromise,
      productsPromise,
      categoriesPromise,
      brandsPromise,
      sectionsPromise,
      bannersPromise,
      notificationsPromise,
      pushSummaryPromise
    ]);

    adminState.settings = settings;
    adminState.products = productsRes.data || [];
    adminState.categories = categories || [];
    adminState.brands = brands || [];
    adminState.sections = sections || [];
    adminState.banners = banners || [];
    adminState.notifications = notifications || [];
    adminState.pushSummary = pushSummary || { count: 0, data: [] };
    adminState.hasLoadedAdminData = true;
    adminState.lastLoadedUserId = sessionUserId;

    setThemeVariables(settings || {}, { context: "admin" });
    renderAdminLayoutFromBackground();
  } catch (error) {
    console.error(error);
    renderLoadError(
      error.message || "Não foi possível carregar o painel.",
      () => triggerAdminDataLoad()
    );
  } finally {
    adminState.isLoadingAdminData = false;
  }
}

function renderSetupMessage() {
  qs("#admin-root").innerHTML = `
    <div class="auth-screen">
      <section class="auth-card">
        <span class="section-kicker">Configuração pendente</span>
        <h1>Supabase ainda não configurado</h1>
        <p>Preencha a URL e a anon key em <code>js/config.js</code> para ativar o painel administrativo.</p>
      </section>
    </div>
  `;
}

function renderLogin() {
  qs("#admin-root").innerHTML = `
    <div class="auth-screen">
      <section class="auth-card">
        <span class="section-kicker">VitrineZap Admin</span>
        <h1>Entrar no painel</h1>
        <p>Use seu email e senha cadastrados no Supabase Auth para acessar a gestão da loja.</p>
        <form id="login-form">
          <label class="admin-field">
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" placeholder="gerente@loja.com" />
          </label>
          <label class="admin-field">
            <span>Senha</span>
            <input type="password" name="password" required autocomplete="current-password" placeholder="Sua senha" />
          </label>
          <div class="auth-actions">
            <button class="btn btn-primary" type="submit">Entrar</button>
          </div>
        </form>
      </section>
    </div>
  `;

  qs("#login-form")?.addEventListener("submit", handleLogin);
}

function renderAccessDenied() {
  qs("#admin-root").innerHTML = `
    <div class="access-denied-screen">
      <section class="access-denied-card">
        <span class="section-kicker">Acesso negado</span>
        <h1>Sem permissão para esta loja</h1>
        <p>Seu usuário está autenticado, mas ainda não foi vinculado como owner ou manager em <code>store_members</code>.</p>
        <div class="auth-actions">
          <button class="btn btn-secondary" type="button" id="logout-button">Sair</button>
        </div>
      </section>
    </div>
  `;

  qs("#logout-button")?.addEventListener("click", handleLogout);
}

function renderLoadError(errorMessage, onRetry) {
  qs("#admin-root").innerHTML = `
    <div class="auth-screen">
      <section class="auth-card">
        <span class="section-kicker">Erro de carregamento</span>
        <h1>Não foi possível carregar o painel</h1>
        <p>${errorMessage}</p>
        <div class="auth-actions">
          <button class="btn btn-primary" type="button" id="retry-button">Tentar novamente</button>
          <button class="btn btn-secondary" type="button" id="logout-button">Sair</button>
        </div>
      </section>
    </div>
  `;

  qs("#retry-button")?.addEventListener("click", onRetry);
  qs("#logout-button")?.addEventListener("click", handleLogout);
}

async function handleLogin(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;

  try {
    const email = form.email.value.trim();
    const password = form.password.value;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showToast("Login realizado com sucesso.", "success");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível entrar.", "danger");
  } finally {
    button.disabled = false;
  }
}

async function handleLogout() {
  await supabase.auth.signOut();
  showToast("Sessão encerrada.", "warning");
}

function renderAdminLayout() {
  const root = qs("#admin-root");
  root.innerHTML = `
    <div class="admin-shell">
      <aside class="admin-sidebar">
        <div class="sidebar-copy">
          <span class="section-kicker">VitrineZap Admin</span>
          <h1>${escapeHtml(adminState.store.name)}</h1>
          <p>${escapeHtml(adminState.store.slogan || "Painel mobile-first para gerenciar catálogo, vitrine e notificações.")}</p>
        </div>
        <nav class="sidebar-nav">
          ${renderTabButtons()}
        </nav>
        <div class="sidebar-footer">
          <span class="section-kicker">${escapeHtml(adminState.membership.role)}</span>
          <p>${escapeHtml(adminState.profile?.full_name || adminState.profile?.id || "Usuário logado")}</p>
        </div>
      </aside>

      <main class="admin-main">
        <header class="admin-topbar">
          <div class="topbar-meta">
            <span class="section-kicker">Loja ativa</span>
            <h1>${escapeHtml(getTabLabel(adminState.currentAdminTab))}</h1>
            <p>${escapeHtml(adminState.store.name)} · ${escapeHtml(adminState.store.slug)}</p>
          </div>
          <div class="topbar-actions">
            <button class="btn btn-secondary" type="button" id="quick-new-product">Novo produto</button>
            <button class="btn btn-secondary" type="button" id="open-preview-tab">Abrir site</button>
            <button class="btn btn-ghost" type="button" id="sign-out-button">Sair</button>
          </div>
        </header>

        <section class="admin-content">
          <section class="panel-card">
            <div class="toolbar-actions">${renderTabButtons()}</div>
          </section>
          ${renderCurrentTab()}
        </section>
      </main>
    </div>
  `;

  bindAdminLayoutEvents();
}

function renderTabButtons() {
  return TABS.map(
    (tab) => `
      <button
        class="tab-button ${adminState.currentAdminTab === tab.id ? "is-active" : ""}"
        type="button"
        data-admin-tab="${escapeHtml(tab.id)}"
      >
        ${escapeHtml(tab.label)}
      </button>
    `
  ).join("");
}

function renderCurrentTab() {
  switch (adminState.currentAdminTab) {
    case "products":
      return renderProducts();
    case "sections":
      return renderSectionsManager();
    case "categories":
      return renderCategoriesManager();
    case "brands":
      return renderBrandsManager();
    case "appearance":
      return renderAppearanceManager();
    case "notifications":
      return renderNotifications();
    case "automations":
      return renderAutomations();
    case "settings":
      return renderSettings();
    case "preview":
      return renderPreview();
    case "dashboard":
    default:
      return renderDashboard();
  }
}

function renderDashboard() {
  const activeProducts = adminState.products.filter((product) => product.is_active && !product.is_archived).length;
  const promotions = adminState.products.filter((product) => product.is_promotion).length;
  const lowStock = adminState.products.filter(
    (product) => product.stock_status === "low_stock" || Number(product.stock_quantity) <= 3
  ).length;

  return `
    <section class="stat-grid">
      <article class="stat-card">
        <span class="section-kicker">Catálogo</span>
        <strong>${activeProducts}</strong>
        <p>Produtos ativos na vitrine.</p>
      </article>
      <article class="stat-card">
        <span class="section-kicker">Seções</span>
        <strong>${adminState.sections.length}</strong>
        <p>Blocos organizando a home pública.</p>
      </article>
      <article class="stat-card">
        <span class="section-kicker">Promoções</span>
        <strong>${promotions}</strong>
        <p>Itens marcados com preço especial.</p>
      </article>
      <article class="stat-card">
        <span class="section-kicker">Push</span>
        <strong>${adminState.pushSummary.count}</strong>
        <p>Dispositivos inscritos para novidades.</p>
      </article>
    </section>

    <section class="dashboard-grid">
      <article class="panel-card">
        <span class="section-kicker">Ações rápidas</span>
        <h2>Rotina do gerente</h2>
        <p>Cadastre um novo produto, ajuste a vitrine ou envie uma notificação sem sair do celular.</p>
        <div class="toolbar-actions">
          <button class="btn btn-primary" type="button" id="dashboard-add-product">Cadastrar produto</button>
          <button class="btn btn-secondary" type="button" data-go-tab="sections">Editar seções</button>
          <button class="btn btn-secondary" type="button" data-go-tab="notifications">Criar notificação</button>
        </div>
      </article>

      <article class="panel-card">
        <span class="section-kicker">Saúde do catálogo</span>
        <h2>Pontos de atenção</h2>
        <div class="list-stack">
          <article class="list-item">
            <div>
              <strong class="list-item-title">${lowStock} produto(s) com estoque baixo</strong>
              <span class="list-item-subtitle">Revise as últimas unidades para evitar frustração no WhatsApp.</span>
            </div>
          </article>
          <article class="list-item">
            <div>
              <strong class="list-item-title">${adminState.banners.length} banner(s) configurados</strong>
              <span class="list-item-subtitle">Mantenha o hero da home sempre atualizado com campanhas vivas.</span>
            </div>
          </article>
          <article class="list-item">
            <div>
              <strong class="list-item-title">${adminState.notifications.filter((item) => item.status === "draft").length} notificação(ões) em rascunho</strong>
              <span class="list-item-subtitle">Prontas para disparo quando fizer sentido comercialmente.</span>
            </div>
          </article>
        </div>
      </article>
    </section>

    <section class="two-col-grid">
      <article class="panel-card">
        <span class="section-kicker">Seções recentes</span>
        <h2>Home da vitrine</h2>
        <div class="list-stack">
          ${adminState.sections
            .slice(0, 5)
            .map(
              (section) => `
                <article class="section-card">
                  <div class="section-card__header">
                    <div>
                      <strong class="section-card__title">${escapeHtml(section.title)}</strong>
                      <small>${escapeHtml(section.selection_mode)} · ${escapeHtml(section.layout)}</small>
                    </div>
                    <span class="badge ${section.is_active ? "badge--success" : "badge--muted"}">${section.is_active ? "Ativa" : "Oculta"}</span>
                  </div>
                  <div class="section-card__footer">
                    <button class="btn btn-secondary" type="button" data-edit-section="${escapeHtml(section.id)}">Editar seção</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="panel-card">
        <span class="section-kicker">Últimos produtos</span>
        <h2>Atualizados recentemente</h2>
        <div class="list-stack">
          ${adminState.products
            .slice(0, 5)
            .map(
              (product) => `
                <article class="list-item">
                  <div class="list-item-header">
                    <div>
                      <strong class="list-item-title">${escapeHtml(product.name)}</strong>
                      <span class="list-item-subtitle">${formatCurrency(product.price, adminState.settings?.currency, adminState.settings?.locale)}</span>
                    </div>
                    <span class="badge ${product.is_active ? "badge--success" : "badge--muted"}">${product.is_active ? "Publicado" : "Rascunho"}</span>
                  </div>
                  <div class="list-item-footer">
                    <button class="btn btn-secondary" type="button" data-edit-product="${escapeHtml(product.id)}">Editar</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function renderProducts() {
  const products = getVisibleProducts();

  return `
    <section class="panel-card toolbar">
      <div>
        <span class="section-kicker">Busca e organização</span>
        <h2>Produtos</h2>
      </div>
      <form id="products-filter-form" class="toolbar-filters">
        <label class="admin-field">
          <span>Buscar</span>
          <input type="search" name="search" value="${escapeHtml(adminState.productFilters.search)}" placeholder="Nome do produto" />
        </label>
        <label class="admin-field">
          <span>Status</span>
          <select name="status">
            ${renderOptions(
              [
                { value: "", label: "Todos" },
                { value: "active", label: "Ativos" },
                { value: "inactive", label: "Inativos" },
                { value: "archived", label: "Arquivados" }
              ],
              adminState.productFilters.status
            )}
          </select>
        </label>
        <label class="admin-field">
          <span>Categoria</span>
          <select name="categoryId">
            ${renderEntityOptions(adminState.categories, adminState.productFilters.categoryId, "Todas")}
          </select>
        </label>
        <label class="admin-field">
          <span>Marca</span>
          <select name="brandId">
            ${renderEntityOptions(adminState.brands, adminState.productFilters.brandId, "Todas")}
          </select>
        </label>
        <label class="admin-field">
          <span>Seção</span>
          <select name="sectionId">
            ${renderEntityOptions(adminState.sections, adminState.productFilters.sectionId, "Todas")}
          </select>
        </label>
      </form>
      <div class="toolbar-actions">
        <button class="btn btn-primary" type="button" id="open-new-product">Novo produto</button>
        <button class="btn btn-secondary" type="button" id="reload-products">Atualizar lista</button>
      </div>
    </section>

    ${
      adminState.selectedProductIds.length
        ? `
          <section class="bulk-toolbar">
            <div class="bulk-summary">${adminState.selectedProductIds.length} item(ns) selecionado(s)</div>
            <div class="bulk-actions">
              <button class="btn btn-secondary" type="button" data-bulk-action="activate">Ativar</button>
              <button class="btn btn-secondary" type="button" data-bulk-action="deactivate">Desativar</button>
              <button class="btn btn-secondary" type="button" data-bulk-action="promotion">Promoção</button>
              <button class="btn btn-secondary" type="button" data-bulk-action="featured">Destaque</button>
              <button class="btn btn-danger" type="button" data-bulk-action="archive">Arquivar</button>
            </div>
          </section>
        `
        : ""
    }

    <section class="table-card">
      <header>
        <span class="section-kicker">Lista operacional</span>
        <h2>${products.length} produto(s)</h2>
      </header>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th><input type="checkbox" id="select-all-products" ${products.length && adminState.selectedProductIds.length === products.length ? "checked" : ""} /></th>
              <th>Produto</th>
              <th>Preço</th>
              <th>Status</th>
              <th>Flags</th>
              <th>Atualizado</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${
              products.length
                ? products
                    .map(
                      (product) => `
                        <tr>
                          <td>
                            <input type="checkbox" data-select-product="${escapeHtml(product.id)}" ${adminState.selectedProductIds.includes(product.id) ? "checked" : ""} />
                          </td>
                          <td>
                            <div class="product-line">
                              <img class="product-thumb" src="${escapeHtml(getPrimaryImage(product))}" alt="${escapeHtml(product.name)}" />
                              <div class="product-line__copy">
                                <strong>${escapeHtml(product.name)}</strong>
                                <small>${escapeHtml(product.sku || product.slug)} · ${escapeHtml(product.category?.name || "Sem categoria")}</small>
                              </div>
                            </div>
                          </td>
                          <td>${formatCurrency(product.price, adminState.settings?.currency, adminState.settings?.locale)}</td>
                          <td>${renderProductStatusBadge(product)}</td>
                          <td>${renderFlagBadges(product)}</td>
                          <td>${formatDateTime(product.updated_at, adminState.settings?.locale || "pt-BR")}</td>
                          <td>
                            <div class="inline-actions">
                              <button class="btn btn-secondary" type="button" data-edit-product="${escapeHtml(product.id)}">Editar</button>
                              <button class="btn btn-secondary" type="button" data-duplicate-product="${escapeHtml(product.id)}">Duplicar</button>
                              <button class="btn btn-danger" type="button" data-delete-product="${escapeHtml(product.id)}">Excluir</button>
                            </div>
                          </td>
                        </tr>
                      `
                    )
                    .join("")
                : `
                  <tr>
                    <td colspan="7">
                      <div class="empty-card">
                        <span class="section-kicker">Catálogo vazio</span>
                        <h2>Nenhum produto encontrado</h2>
                        <p>Revise os filtros ou crie seu primeiro item agora.</p>
                      </div>
                    </td>
                  </tr>
                `
            }
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function renderSectionsManager() {
  const section = adminState.editingSection || createEmptySectionDraft();

  return `
    <section class="manager-grid">
      <article class="panel-card">
        <div class="section-card__header">
          <div>
            <span class="section-kicker">Home pública</span>
            <h2>Seções da vitrine</h2>
          </div>
          <button class="btn btn-primary" type="button" id="new-section-button">Nova seção</button>
        </div>
        <div class="list-stack">
          ${adminState.sections
            .map(
              (item) => `
                <article class="section-card">
                  <div class="section-card__header">
                    <div>
                      <strong class="section-card__title">${escapeHtml(item.title)}</strong>
                      <small>${escapeHtml(item.selection_mode)} · ${escapeHtml(item.layout)}</small>
                    </div>
                    <span class="badge ${item.is_active ? "badge--success" : "badge--muted"}">${item.is_active ? "Ativa" : "Oculta"}</span>
                  </div>
                  <div class="section-card__footer">
                    <button class="btn btn-secondary" type="button" data-edit-section="${escapeHtml(item.id)}">Editar</button>
                    ${
                      item.selection_mode === "automatic"
                        ? `<button class="btn btn-secondary" type="button" data-refresh-section="${escapeHtml(item.id)}">Atualizar regra</button>`
                        : ""
                    }
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="panel-card">
        <span class="section-kicker">Configuração</span>
        <h2>${section.id ? "Editar seção" : "Nova seção"}</h2>
        <form id="section-form" class="section-form">
          <input type="hidden" name="id" value="${escapeHtml(section.id || "")}" />
          <label class="admin-field">
            <span>Título</span>
            <input type="text" name="title" value="${escapeHtml(section.title || "")}" required />
          </label>
          <label class="admin-field">
            <span>Slug</span>
            <input type="text" name="slug" value="${escapeHtml(section.slug || "")}" />
          </label>
          <label class="admin-field">
            <span>Descrição</span>
            <textarea name="description">${escapeHtml(section.description || "")}</textarea>
          </label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Tipo</span>
              <input type="text" name="type" value="${escapeHtml(section.type || "custom")}" />
            </label>
            <label class="admin-field">
              <span>Ordem</span>
              <input type="number" name="sort_order" value="${escapeHtml(section.sort_order ?? 0)}" />
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Modo</span>
              <select name="selection_mode">
                ${renderOptions(
                  [
                    { value: "manual", label: "Manual" },
                    { value: "automatic", label: "Automático" }
                  ],
                  section.selection_mode || "manual"
                )}
              </select>
            </label>
            <label class="admin-field">
              <span>Layout</span>
              <select name="layout">
                ${renderOptions(
                  [
                    { value: "horizontal_carousel", label: "Carrossel" },
                    { value: "grid", label: "Grade" },
                    { value: "compact_list", label: "Lista compacta" },
                    { value: "hero_cards", label: "Cards hero" }
                  ],
                  section.layout || "horizontal_carousel"
                )}
              </select>
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Regra automática</span>
              <select name="automatic_rule">
                ${renderOptions(
                  [
                    { value: "", label: "Sem regra" },
                    { value: "featured", label: "Destaques" },
                    { value: "promotion", label: "Promoções" },
                    { value: "newest", label: "Novidades" },
                    { value: "best_seller", label: "Mais vendidos" },
                    { value: "low_stock", label: "Últimas unidades" },
                    { value: "category", label: "Por categoria" },
                    { value: "brand", label: "Por marca" },
                    { value: "custom_query", label: "Consulta customizada" }
                  ],
                  section.automatic_rule || ""
                )}
              </select>
            </label>
            <label class="admin-field">
              <span>Atualização</span>
              <select name="refresh_frequency">
                ${renderOptions(
                  [
                    { value: "manual", label: "Manual" },
                    { value: "daily", label: "Diária" },
                    { value: "weekly", label: "Semanal" }
                  ],
                  section.refresh_frequency || "manual"
                )}
              </select>
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Máximo de itens</span>
              <input type="number" name="max_items" value="${escapeHtml(section.max_items ?? 12)}" />
            </label>
            <label class="admin-field admin-field--switch">
              <span>Seção ativa</span>
              <input type="checkbox" name="is_active" ${section.is_active !== false ? "checked" : ""} />
            </label>
          </div>
          <label class="admin-field">
            <span>Parâmetros da regra automática (JSON)</span>
            <textarea name="automatic_params">${escapeHtml(
              JSON.stringify(section.automatic_params || {}, null, 2)
            )}</textarea>
          </label>
          <label class="admin-field">
            <span>Produtos manuais</span>
            <div class="selection-list">
              ${adminState.products
                .slice(0, 30)
                .map((product) => {
                  const selectedIds = (section.section_products || []).map((item) => item.product_id);
                  return `
                    <label class="selection-chip">
                      <input type="checkbox" name="selectedProductIds" value="${escapeHtml(product.id)}" ${
                        selectedIds.includes(product.id) ? "checked" : ""
                      } />
                      ${escapeHtml(product.name)}
                    </label>
                  `;
                })
                .join("")}
            </div>
          </label>
          <div class="toolbar-actions">
            <button class="btn btn-primary" type="submit">Salvar seção</button>
            ${
              section.id && section.selection_mode === "automatic"
                ? `<button class="btn btn-secondary" type="button" id="refresh-current-section">Atualizar agora</button>`
                : ""
            }
          </div>
        </form>
      </article>
    </section>
  `;
}

function renderCategoriesManager() {
  const category = adminState.editingCategory || createEmptyCategoryDraft();

  return `
    <section class="manager-grid">
      <article class="panel-card">
        <span class="section-kicker">Organização</span>
        <h2>Categorias</h2>
        <div class="list-stack">
          ${adminState.categories
            .map(
              (item) => `
                <article class="list-item">
                  <div class="list-item-header">
                    <div>
                      <strong class="list-item-title">${escapeHtml(item.name)}</strong>
                      <span class="list-item-subtitle">${escapeHtml(item.slug)}</span>
                    </div>
                    <span class="badge ${item.is_active ? "badge--success" : "badge--muted"}">${item.is_active ? "Ativa" : "Oculta"}</span>
                  </div>
                  <div class="list-item-footer">
                    <button class="btn btn-secondary" type="button" data-edit-category="${escapeHtml(item.id)}">Editar</button>
                    <button class="btn btn-danger" type="button" data-delete-category="${escapeHtml(item.id)}">Excluir</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="panel-card">
        <span class="section-kicker">Cadastro rápido</span>
        <h2>${category.id ? "Editar categoria" : "Nova categoria"}</h2>
        <form id="category-form" class="grid-form">
          <input type="hidden" name="id" value="${escapeHtml(category.id || "")}" />
          <label class="admin-field">
            <span>Nome</span>
            <input type="text" name="name" value="${escapeHtml(category.name || "")}" required />
          </label>
          <label class="admin-field">
            <span>Slug</span>
            <input type="text" name="slug" value="${escapeHtml(category.slug || "")}" />
          </label>
          <label class="admin-field">
            <span>Descrição</span>
            <textarea name="description">${escapeHtml(category.description || "")}</textarea>
          </label>
          <label class="admin-field">
            <span>URL da imagem</span>
            <input type="url" name="image_url" value="${escapeHtml(category.image_url || "")}" />
          </label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Ordem</span>
              <input type="number" name="sort_order" value="${escapeHtml(category.sort_order ?? 0)}" />
            </label>
            <label class="admin-field admin-field--switch">
              <span>Categoria ativa</span>
              <input type="checkbox" name="is_active" ${category.is_active !== false ? "checked" : ""} />
            </label>
          </div>
          <div class="toolbar-actions">
            <button class="btn btn-primary" type="submit">Salvar categoria</button>
            <button class="btn btn-secondary" type="button" id="reset-category-form">Nova</button>
          </div>
        </form>
      </article>
    </section>
  `;
}

function renderBrandsManager() {
  const brand = adminState.editingBrand || createEmptyBrandDraft();

  return `
    <section class="manager-grid">
      <article class="panel-card">
        <span class="section-kicker">Identidade comercial</span>
        <h2>Marcas</h2>
        <div class="list-stack">
          ${adminState.brands
            .map(
              (item) => `
                <article class="list-item">
                  <div class="list-item-header">
                    <div>
                      <strong class="list-item-title">${escapeHtml(item.name)}</strong>
                      <span class="list-item-subtitle">${escapeHtml(item.slug)}</span>
                    </div>
                    <span class="badge ${item.is_featured ? "badge--warning" : "badge--muted"}">${item.is_featured ? "Destaque" : "Normal"}</span>
                  </div>
                  <div class="list-item-footer">
                    <button class="btn btn-secondary" type="button" data-edit-brand="${escapeHtml(item.id)}">Editar</button>
                    <button class="btn btn-danger" type="button" data-delete-brand="${escapeHtml(item.id)}">Excluir</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </article>

      <article class="panel-card">
        <span class="section-kicker">Cadastro rápido</span>
        <h2>${brand.id ? "Editar marca" : "Nova marca"}</h2>
        <form id="brand-form" class="grid-form">
          <input type="hidden" name="id" value="${escapeHtml(brand.id || "")}" />
          <label class="admin-field">
            <span>Nome</span>
            <input type="text" name="name" value="${escapeHtml(brand.name || "")}" required />
          </label>
          <label class="admin-field">
            <span>Slug</span>
            <input type="text" name="slug" value="${escapeHtml(brand.slug || "")}" />
          </label>
          <label class="admin-field">
            <span>Logo URL</span>
            <input type="url" name="logo_url" value="${escapeHtml(brand.logo_url || "")}" />
          </label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Ordem</span>
              <input type="number" name="sort_order" value="${escapeHtml(brand.sort_order ?? 0)}" />
            </label>
            <label class="admin-field admin-field--switch">
              <span>Marca em destaque</span>
              <input type="checkbox" name="is_featured" ${brand.is_featured ? "checked" : ""} />
            </label>
          </div>
          <label class="admin-field admin-field--switch">
            <span>Marca ativa</span>
            <input type="checkbox" name="is_active" ${brand.is_active !== false ? "checked" : ""} />
          </label>
          <div class="toolbar-actions">
            <button class="btn btn-primary" type="submit">Salvar marca</button>
            <button class="btn btn-secondary" type="button" id="reset-brand-form">Nova</button>
          </div>
        </form>
      </article>
    </section>
  `;
}

function renderAppearanceManager() {
  const banner = adminState.editingBanner || createEmptyBannerDraft();
  const hasDraftContent = Boolean(banner.id || banner.title || banner.subtitle || banner.image_url);
  const previewBanner = hasDraftContent ? banner : adminState.banners[0] || createEmptyBannerDraft();
  const previewTheme = normalizeHeroThemeKey(previewBanner.theme_preset);
  const previewStyle = buildHeroPreviewStyle(previewBanner);

  return `
    <section class="settings-grid">
      <article class="panel-card">
        <span class="section-kicker">Campanhas visuais</span>
        <h2>${banner.id ? "Editar banner" : "Novo banner"}</h2>
        <p class="muted-copy">Defina a foto, o tema e o enquadramento da tarja principal da home sem depender do Supabase manualmente.</p>
        <form id="banner-form" class="grid-form">
          <input type="hidden" name="id" value="${escapeHtml(banner.id || "")}" />
          <label class="admin-field">
            <span>Título</span>
            <input type="text" name="title" value="${escapeHtml(banner.title || "")}" />
          </label>
          <label class="admin-field">
            <span>Subtítulo</span>
            <textarea name="subtitle">${escapeHtml(banner.subtitle || "")}</textarea>
          </label>
          <label class="admin-field">
            <span>Imagem</span>
            <input type="url" name="image_url" value="${escapeHtml(banner.image_url || "")}" placeholder="https://..." />
          </label>
          <label class="admin-field">
            <span>Upload de imagem</span>
            <input type="file" id="banner-upload-input" accept=".jpg,.jpeg,.png,.webp" />
          </label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Tema de fundo</span>
              <select name="theme_preset">
                ${renderOptions(HERO_THEME_OPTIONS, normalizeHeroThemeKey(banner.theme_preset))}
              </select>
            </label>
            <label class="admin-field">
              <span>Enquadramento</span>
              <select name="image_position">
                ${renderOptions(HERO_POSITION_OPTIONS, banner.image_position || "center center")}
              </select>
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Ajuste da foto</span>
              <select name="image_fit">
                ${renderOptions(HERO_FIT_OPTIONS, banner.image_fit || "cover")}
              </select>
            </label>
            <label class="admin-field">
              <span>Escurecimento da camada</span>
              <input
                type="range"
                name="overlay_strength"
                min="0.08"
                max="0.92"
                step="0.02"
                value="${escapeHtml(String(Number(banner.overlay_strength ?? 0.56).toFixed(2)))}"
              />
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Brilho da foto</span>
              <input
                type="range"
                name="image_brightness"
                min="0.40"
                max="1.60"
                step="0.05"
                value="${escapeHtml(String(Number(banner.image_brightness ?? 0.92).toFixed(2)))}"
              />
            </label>
            <label class="admin-field">
              <span>Contraste da foto</span>
              <input
                type="range"
                name="image_contrast"
                min="0.60"
                max="1.80"
                step="0.05"
                value="${escapeHtml(String(Number(banner.image_contrast ?? 1.05).toFixed(2)))}"
              />
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Link alvo</span>
              <input type="url" name="target_url" value="${escapeHtml(banner.target_url || "")}" />
            </label>
            <label class="admin-field">
              <span>Tipo</span>
              <input type="text" name="target_type" value="${escapeHtml(banner.target_type || "hero")}" />
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Ordem</span>
              <input type="number" name="sort_order" value="${escapeHtml(banner.sort_order ?? 0)}" />
            </label>
            <label class="admin-field admin-field--switch">
              <span>Banner ativo</span>
              <input type="checkbox" name="is_active" ${banner.is_active !== false ? "checked" : ""} />
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Início</span>
              <input type="datetime-local" name="starts_at" value="${toDateTimeLocal(banner.starts_at)}" />
            </label>
            <label class="admin-field">
              <span>Fim</span>
              <input type="datetime-local" name="ends_at" value="${toDateTimeLocal(banner.ends_at)}" />
            </label>
          </div>
          <div class="toolbar-actions">
            <button class="btn btn-primary" type="submit">Salvar banner</button>
            <button class="btn btn-secondary" type="button" id="reset-banner-form">Novo</button>
          </div>
        </form>
      </article>

      <article class="preview-card">
        <span class="section-kicker">Prévia</span>
        <h2>Visual da home</h2>
        <p>Veja rapidamente como o topo da vitrine vai aparecer para o cliente.</p>
        <div class="editor-preview">
          <div class="editor-preview-card editor-preview-card--hero hero-theme-preview--${escapeHtml(previewTheme)}" style="${previewStyle}">
            <div class="editor-preview-hero-media" aria-hidden="true"></div>
            <div class="editor-preview-hero-veil" aria-hidden="true"></div>
            <div class="editor-preview-hero-copy">
              <span class="section-kicker">Hero da vitrine</span>
              <img src="${escapeHtml(previewBanner?.image_url || adminState.store.logo_url || "./assets/placeholders/product-placeholder.svg")}" alt="Prévia do banner" />
            </div>
            <strong>${escapeHtml(previewBanner?.title || adminState.store.name)}</strong>
            <p>${escapeHtml(previewBanner?.subtitle || adminState.store.slogan || "Configure um banner ou use o logo da loja como destaque inicial.")}</p>
          </div>
        </div>
        <div class="list-stack">
          ${adminState.banners
            .map(
              (item) => `
                <article class="list-item">
                  <div class="list-item-header">
                    <div>
                      <strong class="list-item-title">${escapeHtml(item.title || "Banner sem título")}</strong>
                      <span class="list-item-subtitle">${escapeHtml(item.target_type || "hero")} · ${escapeHtml(item.theme_preset || "classic-night")}</span>
                    </div>
                    <span class="badge ${item.is_active ? "badge--success" : "badge--muted"}">${item.is_active ? "Ativo" : "Oculto"}</span>
                  </div>
                  <div class="list-item-footer">
                    <button class="btn btn-secondary" type="button" data-edit-banner="${escapeHtml(item.id)}">Editar</button>
                    <button class="btn btn-danger" type="button" data-delete-banner="${escapeHtml(item.id)}">Excluir</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function renderNotifications() {
  const targetOptions = getNotificationTargetOptions();
  return `
    <section class="settings-grid">
      <article class="panel-card">
        <span class="section-kicker">Push notifications</span>
        <h2>Criar notificação</h2>
        <p>${adminState.settings?.enable_notifications ? "O recurso está habilitado para a loja." : "As notificações estão desativadas na configuração pública da loja."}</p>
        <form id="notification-form" class="notification-form">
          <label class="admin-field">
            <span>Título</span>
            <input type="text" name="title" required placeholder="Novidades na vitrine" />
          </label>
          <label class="admin-field">
            <span>Mensagem</span>
            <textarea name="body" required placeholder="Confira os itens que acabaram de entrar."></textarea>
          </label>
          <label class="admin-field">
            <span>URL alvo</span>
            <input type="text" name="target_url" list="notification-target-options" placeholder="URL completa, ./index.html ou seção da vitrine" />
            <datalist id="notification-target-options">
              ${targetOptions
                .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
                .join("")}
            </datalist>
            <p class="muted-copy">Deixe em branco para abrir a página inicial. As seções abaixo são carregadas da vitrine atual.</p>
          </label>
          <label class="admin-field">
            <span>Imagem opcional</span>
            <input type="url" name="image_url" placeholder="https://..." />
          </label>
          <div class="notification-actions">
            <button class="btn btn-primary" type="submit">Salvar notificação</button>
          </div>
        </form>
      </article>

      <article class="panel-card">
        <span class="section-kicker">Base instalada</span>
        <h2>${adminState.pushSummary.count} dispositivo(s) inscrito(s)</h2>
        <p>O pedido de permissão é progressivo e só aparece quando o cliente clicar no botão da vitrine.</p>
        <div class="list-stack">
          ${adminState.notifications
            .map(
              (item) => `
                <article class="list-item">
                  <div class="list-item-header">
                    <div>
                      <strong class="list-item-title">${escapeHtml(item.title)}</strong>
                      <span class="list-item-subtitle">${escapeHtml(item.body)}</span>
                    </div>
                    <span class="badge ${
                      item.status === "sent" ? "badge--success" : item.status === "draft" ? "badge--muted" : "badge--warning"
                    }">${escapeHtml(item.status)}</span>
                  </div>
                  <div class="list-item-footer">
                    <button class="btn btn-secondary" type="button" data-send-notification="${escapeHtml(item.id)}">Enviar</button>
                  </div>
                </article>
              `
            )
            .join("")}
        </div>
      </article>
    </section>
  `;
}

function getNotificationTargetOptions() {
  const options = [{ value: "./index.html", label: "Página inicial" }];

  if (adminState.settings?.enable_favorites) {
    options.push({ value: "#favorites-section", label: "Favoritos" });
  }

  adminState.sections
    .filter((section) => section?.slug && section.is_active !== false)
    .forEach((section) => {
      options.push({
        value: `#section-${section.slug}`,
        label: section.title || section.slug
      });
    });

  options.push({ value: "#all-products-section", label: "Todos os produtos" });

  return options;
}

function renderAutomations() {
  const automaticSections = adminState.sections.filter((section) => section.selection_mode === "automatic");

  return `
    <section class="panel-card">
      <div class="section-card__header">
        <div>
          <span class="section-kicker">Atualização inteligente</span>
          <h2>Automações da vitrine</h2>
          <p class="muted-copy">No MVP, as regras automáticas podem ser reprocessadas quando o gerente abre o painel.</p>
        </div>
        <button class="btn btn-primary" type="button" id="refresh-stale-sections">Atualizar seções vencidas</button>
      </div>
      <div class="list-stack">
        ${automaticSections
          .map((section) => {
            const stale = isSectionStale(section);
            return `
              <article class="section-card">
                <div class="section-card__header">
                  <div>
                    <strong class="section-card__title">${escapeHtml(section.title)}</strong>
                    <small>${escapeHtml(section.automatic_rule || "sem regra")} · ${escapeHtml(section.refresh_frequency)}</small>
                  </div>
                  <span class="badge ${stale ? "badge--warning" : "badge--success"}">${stale ? "Atualizar" : "Em dia"}</span>
                </div>
                <div class="section-card__footer">
                  <button class="btn btn-secondary" type="button" data-refresh-section="${escapeHtml(section.id)}">Reprocessar agora</button>
                </div>
              </article>
            `;
          })
          .join("")}
      </div>
    </section>
  `;
}

function renderSettings() {
  const store = adminState.store || {};
  const settings = adminState.settings || {};
  const businessHours = normalizeBusinessHours(settings.business_hours);

  return `
    <section class="settings-grid">
      <article class="panel-card">
        <span class="section-kicker">Dados da loja</span>
        <h2>Configurações públicas</h2>
        <form id="settings-form" class="settings-form">
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Nome da loja</span>
              <input type="text" name="store_name" value="${escapeHtml(store.name || "")}" required />
            </label>
            <label class="admin-field">
              <span>Slug</span>
              <input type="text" name="slug" value="${escapeHtml(store.slug || "")}" required />
            </label>
          </div>
          <label class="admin-field">
            <span>Slogan</span>
            <input type="text" name="slogan" value="${escapeHtml(store.slogan || "")}" />
          </label>
          <label class="admin-field">
            <span>Descrição</span>
            <textarea name="description">${escapeHtml(store.description || "")}</textarea>
          </label>
          <label class="admin-field">
            <span>Logo URL</span>
            <input type="url" name="logo_url" value="${escapeHtml(store.logo_url || "")}" />
          </label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>WhatsApp</span>
              <input type="text" name="whatsapp_number" value="${escapeHtml(settings.whatsapp_number || "")}" placeholder="5511999999999" />
            </label>
            <label class="admin-field">
              <span>Instagram</span>
              <input type="url" name="instagram_url" value="${escapeHtml(settings.instagram_url || "")}" />
            </label>
          </div>
          <label class="admin-field">
            <span>Mensagem padrão do WhatsApp</span>
            <textarea name="whatsapp_default_message">${escapeHtml(settings.whatsapp_default_message || "")}</textarea>
          </label>
          <label class="admin-field">
            <span>Endereço</span>
            <textarea name="address">${escapeHtml(settings.address || "")}</textarea>
          </label>
          <label class="admin-field">
            <span>Horários (JSON)</span>
            <textarea name="business_hours">${escapeHtml(JSON.stringify(settings.business_hours || defaultBusinessHours(), null, 2))}</textarea>
          </label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Cor primária</span>
              <input type="color" name="primary_color" value="${escapeHtml(settings.primary_color || "#111827")}" />
            </label>
            <label class="admin-field">
              <span>Cor secundária</span>
              <input type="color" name="secondary_color" value="${escapeHtml(settings.secondary_color || "#e56b2f")}" />
            </label>
          </div>
          <label class="admin-field">
            <span>Tema base da vitrine</span>
            <select name="theme_mode">
              ${renderOptions(STORE_THEME_OPTIONS, normalizeStoreThemeMode(settings.theme_mode || "light"))}
            </select>
            <small class="muted-copy">Escolha a atmosfera da vitrine. As cores acima refinam os destaques e o contraste do tema.</small>
          </label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Intro mode</span>
              <select name="intro_mode">
                ${renderOptions(
                  [
                    { value: "logo", label: "Logo" },
                    { value: "brand_carousel", label: "Carrossel de marcas" },
                    { value: "disabled", label: "Desabilitado" }
                  ],
                  settings.intro_mode || "logo"
                )}
              </select>
            </label>
            <label class="admin-field">
              <span>Hero mode</span>
              <select name="hero_mode">
                ${renderOptions(
                  [
                    { value: "banner", label: "Banner único" },
                    { value: "brand_carousel", label: "Marcas" },
                    { value: "promotions", label: "Promoções" },
                    { value: "categories", label: "Categorias" }
                  ],
                  settings.hero_mode || "banner"
                )}
              </select>
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Moeda</span>
              <input type="text" name="currency" value="${escapeHtml(settings.currency || "BRL")}" />
            </label>
            <label class="admin-field">
              <span>Locale</span>
              <input type="text" name="locale" value="${escapeHtml(settings.locale || "pt-BR")}" />
            </label>
          </div>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field admin-field--switch">
              <span>Ativar notificações</span>
              <input type="checkbox" name="enable_notifications" ${settings.enable_notifications !== false ? "checked" : ""} />
            </label>
            <label class="admin-field admin-field--switch">
              <span>Ativar favoritos</span>
              <input type="checkbox" name="enable_favorites" ${settings.enable_favorites !== false ? "checked" : ""} />
            </label>
          </div>
          <label class="admin-field admin-field--switch">
            <span>Liberar feature flag de carrinho futuro</span>
            <input type="checkbox" name="enable_future_cart_flag" ${settings.enable_future_cart_flag ? "checked" : ""} />
          </label>
          <div class="toolbar-actions">
            <button class="btn btn-primary" type="submit">Salvar configurações</button>
          </div>
        </form>
      </article>

      <article class="preview-card">
        <span class="section-kicker">Resumo</span>
        <h2>Estado atual da loja</h2>
        <div class="list-stack">
          <article class="list-item">
            <div>
              <strong class="list-item-title">WhatsApp</strong>
              <span class="list-item-subtitle">${escapeHtml(settings.whatsapp_number || "Não configurado")}</span>
            </div>
          </article>
          <article class="list-item">
            <div>
              <strong class="list-item-title">Intro</strong>
              <span class="list-item-subtitle">${escapeHtml(settings.intro_mode || "logo")}</span>
            </div>
          </article>
          <article class="list-item">
            <div>
              <strong class="list-item-title">Hero</strong>
              <span class="list-item-subtitle">${escapeHtml(settings.hero_mode || "banner")}</span>
            </div>
          </article>
          <article class="list-item">
            <div>
              <strong class="list-item-title">Tema</strong>
              <span class="list-item-subtitle">${escapeHtml(getStoreThemeLabel(settings.theme_mode || "light"))}</span>
            </div>
          </article>
          <article class="list-item">
            <div>
              <strong class="list-item-title">Notificações</strong>
              <span class="list-item-subtitle">${settings.enable_notifications ? "Ligadas" : "Desligadas"}</span>
            </div>
          </article>
        </div>
      </article>
    </section>
  `;
}

function renderPreview() {
  return `
    <section class="preview-card">
      <span class="section-kicker">Validação visual</span>
      <h2>Pré-visualizar site</h2>
      <p>Use este iframe para revisar rapidamente a home pública enquanto cadastra produtos e banners.</p>
      <iframe class="preview-frame" src="./index.html" title="Prévia do site público"></iframe>
    </section>
  `;
}

function bindAdminLayoutEvents() {
  qsa("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      clearAdminFormDirty();
      adminState.pendingBackgroundRender = false;
      adminState.currentAdminTab = button.dataset.adminTab;
      renderAdminLayout();
    });
  });

  qs("#sign-out-button")?.addEventListener("click", handleLogout);
  qs("#quick-new-product")?.addEventListener("click", () => openProductEditor());
  qs("#open-preview-tab")?.addEventListener("click", () => window.open("./index.html", "_blank", "noopener"));
  qs("#dashboard-add-product")?.addEventListener("click", () => openProductEditor());

  const previewFrame = qs(".preview-frame");
  if (previewFrame) {
    previewFrame.src = "./index.html?embedded_preview=1";
    previewFrame.loading = "lazy";
    const previewIntro = previewFrame.previousElementSibling;
    if (previewIntro?.tagName === "P") {
      previewIntro.textContent =
        "A prévia embutida desativa os prompts de instalação para ficar mais estável enquanto você cadastra produtos e banners.";
    }

    const previewActions = document.createElement("div");
    previewActions.className = "preview-actions";
    previewActions.innerHTML = `
      <button class="btn btn-secondary" type="button" id="reload-preview-iframe">Atualizar prévia</button>
      <button class="btn btn-primary" type="button" id="open-preview-external-inline">Abrir em nova aba</button>
    `;
    previewFrame.parentElement?.insertBefore(previewActions, previewFrame);

    qs("#reload-preview-iframe")?.addEventListener("click", () => {
      previewFrame.src = "./index.html?embedded_preview=1&t=" + Date.now();
    });
    qs("#open-preview-external-inline")?.addEventListener("click", () => window.open("./index.html", "_blank", "noopener"));
  }

  qsa("[data-go-tab]").forEach((button) =>
    button.addEventListener("click", () => {
      clearAdminFormDirty();
      adminState.pendingBackgroundRender = false;
      adminState.currentAdminTab = button.dataset.goTab;
      renderAdminLayout();
    })
  );

  bindProductsTab();
  bindSectionTab();
  bindCategoryTab();
  bindBrandTab();
  bindAppearanceTab();
  bindNotificationsTab();
  bindSettingsTab();
  bindAutomationTab();
}

function bindProductsTab() {
  const filterForm = qs("#products-filter-form");
  filterForm?.addEventListener("input", debounceAdmin(async () => {
    const data = new FormData(filterForm);
    adminState.productFilters = {
      search: String(data.get("search") || ""),
      status: String(data.get("status") || ""),
      categoryId: String(data.get("categoryId") || ""),
      brandId: String(data.get("brandId") || ""),
      sectionId: String(data.get("sectionId") || "")
    };
    await refreshProducts();
  }));

  qs("#open-new-product")?.addEventListener("click", () => openProductEditor());
  qs("#reload-products")?.addEventListener("click", refreshProducts);

  qs("#select-all-products")?.addEventListener("change", (event) => {
    adminState.selectedProductIds = event.currentTarget.checked ? getVisibleProducts().map((product) => product.id) : [];
    renderAdminLayout();
  });

  qsa("[data-select-product]").forEach((input) =>
    input.addEventListener("change", () => {
      const id = input.dataset.selectProduct;
      if (input.checked) {
        adminState.selectedProductIds = Array.from(new Set([...adminState.selectedProductIds, id]));
      } else {
        adminState.selectedProductIds = adminState.selectedProductIds.filter((item) => item !== id);
      }
      renderAdminLayout();
    })
  );

  qsa("[data-edit-product]").forEach((button) =>
    button.addEventListener("click", () => openProductEditor(button.dataset.editProduct))
  );
  qsa("[data-duplicate-product]").forEach((button) =>
    button.addEventListener("click", () => duplicateProduct(button.dataset.duplicateProduct))
  );
  qsa("[data-delete-product]").forEach((button) =>
    button.addEventListener("click", () => deleteProduct(button.dataset.deleteProduct))
  );

  qsa("[data-bulk-action]").forEach((button) =>
    button.addEventListener("click", () => applyBulkAction(button.dataset.bulkAction))
  );
}

function bindSectionTab() {
  bindDirtyFormState("#section-form", "sections");
  qs("#new-section-button")?.addEventListener("click", () => {
    clearAdminFormDirty("sections");
    adminState.editingSection = createEmptySectionDraft();
    renderAdminLayout();
  });

  qsa("[data-edit-section]").forEach((button) =>
    button.addEventListener("click", () => {
      clearAdminFormDirty("sections");
      adminState.currentAdminTab = "sections";
      adminState.editingSection = structuredClone(
        adminState.sections.find((item) => item.id === button.dataset.editSection) || createEmptySectionDraft()
      );
      renderAdminLayout();
    })
  );

  qsa("[data-refresh-section]").forEach((button) =>
    button.addEventListener("click", () => refreshSection(button.dataset.refreshSection))
  );

  qs("#refresh-current-section")?.addEventListener("click", () => {
    if (adminState.editingSection?.id) refreshSection(adminState.editingSection.id);
  });

  qs("#section-form")?.addEventListener("submit", saveSection);
}

function bindCategoryTab() {
  bindDirtyFormState("#category-form", "categories");
  qs("#category-form")?.addEventListener("submit", saveCategory);
  qs("#reset-category-form")?.addEventListener("click", () => {
    clearAdminFormDirty("categories");
    adminState.editingCategory = createEmptyCategoryDraft();
    renderAdminLayout();
  });
  qsa("[data-edit-category]").forEach((button) =>
    button.addEventListener("click", () => {
      clearAdminFormDirty("categories");
      adminState.editingCategory = structuredClone(
        adminState.categories.find((item) => item.id === button.dataset.editCategory) || createEmptyCategoryDraft()
      );
      renderAdminLayout();
    })
  );
  qsa("[data-delete-category]").forEach((button) =>
    button.addEventListener("click", () => removeCategory(button.dataset.deleteCategory))
  );
}

function bindBrandTab() {
  bindDirtyFormState("#brand-form", "brands");
  qs("#brand-form")?.addEventListener("submit", saveBrand);
  qs("#reset-brand-form")?.addEventListener("click", () => {
    clearAdminFormDirty("brands");
    adminState.editingBrand = createEmptyBrandDraft();
    renderAdminLayout();
  });
  qsa("[data-edit-brand]").forEach((button) =>
    button.addEventListener("click", () => {
      clearAdminFormDirty("brands");
      adminState.editingBrand = structuredClone(
        adminState.brands.find((item) => item.id === button.dataset.editBrand) || createEmptyBrandDraft()
      );
      renderAdminLayout();
    })
  );
  qsa("[data-delete-brand]").forEach((button) =>
    button.addEventListener("click", () => removeBrand(button.dataset.deleteBrand))
  );
}

function bindAppearanceTab() {
  bindDirtyFormState("#banner-form", "appearance");
  qs("#banner-form")?.addEventListener("submit", saveBanner);
  qs("#banner-upload-input")?.addEventListener("change", (event) => {
    adminState.pendingBannerFile = event.currentTarget.files?.[0] || null;
    markAdminFormDirty("appearance");
  });
  qs("#reset-banner-form")?.addEventListener("click", () => {
    clearAdminFormDirty("appearance");
    adminState.editingBanner = createEmptyBannerDraft();
    adminState.pendingBannerFile = null;
    renderAdminLayout();
  });
  qsa("[data-edit-banner]").forEach((button) =>
    button.addEventListener("click", () => {
      clearAdminFormDirty("appearance");
      adminState.editingBanner = structuredClone(
        adminState.banners.find((item) => item.id === button.dataset.editBanner) || createEmptyBannerDraft()
      );
      renderAdminLayout();
    })
  );
  qsa("[data-delete-banner]").forEach((button) =>
    button.addEventListener("click", () => removeBanner(button.dataset.deleteBanner))
  );
}

function bindNotificationsTab() {
  bindDirtyFormState("#notification-form", "notifications");
  qs("#notification-form")?.addEventListener("submit", saveNotification);
  qsa("[data-send-notification]").forEach((button) =>
    button.addEventListener("click", () => sendNotification(button.dataset.sendNotification))
  );
}

function bindSettingsTab() {
  bindDirtyFormState("#settings-form", "settings");
  qs("#settings-form")?.addEventListener("submit", saveSettings);
  mountBusinessHoursEditor();
  qs("#open-business-hours-editor")?.addEventListener("click", openBusinessHoursEditor);
}

function bindAutomationTab() {
  qs("#refresh-stale-sections")?.addEventListener("click", () => refreshStaleSections(false));
}

async function refreshProducts() {
  const response = await adminListProducts(adminState.store.id, adminState.productFilters);
  adminState.products = response.data || [];
  adminState.selectedProductIds = adminState.selectedProductIds.filter((id) =>
    adminState.products.some((product) => product.id === id)
  );
  renderAdminLayout();
}

function getVisibleProducts() {
  const sectionId = adminState.productFilters.sectionId;
  if (!sectionId) return adminState.products;
  const productIds = (adminState.sections.find((section) => section.id === sectionId)?.section_products || []).map(
    (item) => item.product_id
  );
  return adminState.products.filter((product) => productIds.includes(product.id));
}

function openProductEditor(productId = null) {
  adminState.productEditorStep = 1;
  adminState.pendingProductFiles = [];
  adminState.editingProduct = productId
    ? structuredClone(adminState.products.find((product) => product.id === productId))
    : createEmptyProductDraft();

  setAdminModalOpen("product-editor", true);
  renderProductEditor();
}

function renderProductEditor() {
  const draft = adminState.editingProduct || createEmptyProductDraft();
  const isSavingProduct = adminState.isSavingProduct;
  const isSavingDraft = isSavingProduct && adminState.productSaveMode === "draft";
  const isPublishingProduct = isSavingProduct && adminState.productSaveMode === "publish";
  let root = qs("#admin-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "admin-modal-root";
    document.body.appendChild(root);
  }
  const currentImage = getPrimaryImage(draft);

  root.innerHTML = `
    <div class="editor-backdrop" id="editor-backdrop"></div>
    <section class="editor-shell ${isSavingProduct ? "is-busy" : ""}" role="dialog" aria-modal="true" aria-labelledby="product-editor-title" aria-busy="${isSavingProduct ? "true" : "false"}">
      <header class="editor-header">
        <div>
          <span class="section-kicker">Cadastro em etapas</span>
          <h2 id="product-editor-title">${draft.id ? "Editar produto" : "Novo produto"}</h2>
        </div>
        <button class="btn btn-ghost" type="button" id="close-editor-button" ${isSavingProduct ? "disabled" : ""}>Fechar</button>
      </header>
      <div class="editor-body">
        <div class="editor-progress">
          <div class="editor-progress__bar" style="width: ${(adminState.productEditorStep / 5) * 100}%"></div>
        </div>
        <div class="editor-stepper">
          ${[1, 2, 3, 4, 5]
            .map(
              (step) => `
                <button class="${adminState.productEditorStep === step ? "is-active" : ""}" type="button" data-editor-step="${step}" ${isSavingProduct ? "disabled" : ""}>
                  Etapa ${step}
                </button>
              `
            )
            .join("")}
        </div>
        <div class="editor-content">
          <form id="product-editor-form" class="panel-form">
            <input type="hidden" name="id" value="${escapeHtml(draft.id || "")}" />
            <div class="editor-step ${adminState.productEditorStep === 1 ? "is-active" : ""}" data-step="1">
              <label class="admin-field">
                <span>Nome *</span>
                <input type="text" name="name" value="${escapeHtml(draft.name || "")}" required />
              </label>
              <div class="inline-grid inline-grid--2">
                <label class="admin-field">
                  <span>Slug</span>
                  <input type="text" name="slug" value="${escapeHtml(draft.slug || "")}" />
                </label>
                <label class="admin-field">
                  <span>SKU</span>
                  <input type="text" name="sku" value="${escapeHtml(draft.sku || "")}" />
                </label>
              </div>
              <label class="admin-field">
                <span>Descrição curta</span>
                <textarea name="short_description">${escapeHtml(draft.short_description || "")}</textarea>
              </label>
              <label class="admin-field">
                <span>Descrição completa</span>
                <textarea name="description">${escapeHtml(draft.description || "")}</textarea>
              </label>
            </div>

            <div class="editor-step ${adminState.productEditorStep === 2 ? "is-active" : ""}" data-step="2">
              <div class="inline-grid inline-grid--2">
                <label class="admin-field">
                  <span>Preço *</span>
                  <input type="number" min="0" step="0.01" name="price" value="${escapeHtml(draft.price ?? 0)}" required />
                </label>
                <label class="admin-field">
                  <span>Preço antigo</span>
                  <input type="number" min="0" step="0.01" name="old_price" value="${escapeHtml(draft.old_price ?? "")}" />
                </label>
              </div>
              <div class="inline-grid inline-grid--2">
                <label class="admin-field">
                  <span>Custo (privado)</span>
                  <input type="number" min="0" step="0.01" name="cost_price" value="${escapeHtml(draft.cost_price ?? "")}" />
                </label>
                <label class="admin-field">
                  <span>Estoque</span>
                  <input type="number" min="0" step="1" name="stock_quantity" value="${escapeHtml(draft.stock_quantity ?? 0)}" />
                </label>
              </div>
              <label class="admin-field">
                <span>Status de estoque</span>
                <select name="stock_status">
                  ${renderOptions(
                    [
                      { value: "in_stock", label: "Em estoque" },
                      { value: "low_stock", label: "Estoque baixo" },
                      { value: "out_of_stock", label: "Sem estoque" },
                      { value: "preorder", label: "Pré-venda" }
                    ],
                    draft.stock_status || "in_stock"
                  )}
                </select>
              </label>
            </div>

            <div class="editor-step ${adminState.productEditorStep === 3 ? "is-active" : ""}" data-step="3">
              <div class="inline-grid inline-grid--2">
                <label class="admin-field">
                  <span>Categoria</span>
                  <select name="category_id">
                    ${renderEntityOptions(adminState.categories, draft.category_id || "", "Selecione")}
                  </select>
                </label>
                <label class="admin-field">
                  <span>Marca</span>
                  <select name="brand_id">
                    ${renderEntityOptions(adminState.brands, draft.brand_id || "", "Selecione")}
                  </select>
                </label>
              </div>
              <label class="admin-field">
                <span>Tags (separadas por vírgula)</span>
                <input type="text" name="tags" value="${escapeHtml((draft.tags || []).join(", "))}" />
              </label>
              <label class="admin-field">
                <span>Características (JSON)</span>
                <textarea name="attributes">${escapeHtml(JSON.stringify(draft.attributes || {}, null, 2))}</textarea>
              </label>
              <label class="admin-field">
                <span>Variações simples (JSON)</span>
                <textarea name="variants">${escapeHtml(JSON.stringify(draft.variants || [], null, 2))}</textarea>
              </label>
              <label class="admin-field">
                <span>Ordem</span>
                <input type="number" name="sort_order" value="${escapeHtml(draft.sort_order ?? 0)}" />
              </label>
            </div>

            <div class="editor-step ${adminState.productEditorStep === 4 ? "is-active" : ""}" data-step="4">
              <label class="admin-field">
                <span>Novas imagens</span>
                <input type="file" id="product-images-input" multiple accept=".jpg,.jpeg,.png,.webp" ${isSavingProduct ? "disabled" : ""} />
              </label>
              ${
                adminState.pendingProductFiles.length
                  ? `
                    <div class="list-stack">
                      ${adminState.pendingProductFiles
                        .map(
                          (file, index) => `
                            <article class="list-item">
                              <div class="list-item-header">
                                <div>
                                  <strong>${escapeHtml(file.name)}</strong>
                                  <span class="list-item-subtitle">
                                    ${escapeHtml(formatFileSize(file.size))}
                                    ${
                                      !(draft.images || []).some((image) => image.is_primary) && index === 0
                                        ? " · Sera a principal se nao houver outra definida."
                                        : ""
                                    }
                                  </span>
                                </div>
                                <button
                                  class="btn btn-danger"
                                  type="button"
                                  data-remove-pending-image="${escapeHtml(getPendingProductFileKey(file))}"
                                  ${isSavingProduct ? "disabled" : ""}
                                >
                                  Remover da fila
                                </button>
                              </div>
                            </article>
                          `
                        )
                        .join("")}
                    </div>
                  `
                  : `<span class="list-item-subtitle">Nenhum arquivo selecionado ainda. As imagens serao enviadas quando voce salvar o produto.</span>`
              }
              <div class="list-stack">
                ${(draft.images || [])
                  .map(
                    (image) => `
                      <article class="list-item">
                        <div class="product-line">
                          <img class="product-thumb" src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.alt_text || draft.name || "Imagem do produto")}" />
                          <div class="product-line__copy">
                            <strong>${escapeHtml(image.alt_text || draft.name || "Imagem")}</strong>
                            <small>${image.is_primary ? "Imagem principal" : "Imagem auxiliar"}</small>
                          </div>
                        </div>
                        <div class="list-item-footer">
                          <button class="btn btn-secondary" type="button" data-primary-image="${escapeHtml(image.id)}" ${isSavingProduct ? "disabled" : ""}>Definir principal</button>
                          <button class="btn btn-danger" type="button" data-delete-image="${escapeHtml(image.id)}" ${isSavingProduct ? "disabled" : ""}>Remover</button>
                        </div>
                      </article>
                    `
                  )
                  .join("")}
              </div>
            </div>

            <div class="editor-step ${adminState.productEditorStep === 5 ? "is-active" : ""}" data-step="5">
              <label class="admin-field admin-field--switch">
                <span>Produto ativo</span>
                <input type="checkbox" name="is_active" ${draft.is_active ? "checked" : ""} />
              </label>
              <label class="admin-field admin-field--switch">
                <span>Destaque</span>
                <input type="checkbox" name="is_featured" ${draft.is_featured ? "checked" : ""} />
              </label>
              <label class="admin-field admin-field--switch">
                <span>Promoção</span>
                <input type="checkbox" name="is_promotion" ${draft.is_promotion ? "checked" : ""} />
              </label>
              <label class="admin-field admin-field--switch">
                <span>Novidade</span>
                <input type="checkbox" name="is_new" ${draft.is_new ? "checked" : ""} />
              </label>
              <label class="admin-field admin-field--switch">
                <span>Mais vendido</span>
                <input type="checkbox" name="is_best_seller" ${draft.is_best_seller ? "checked" : ""} />
              </label>
              <label class="admin-field admin-field--switch">
                <span>CTA para WhatsApp</span>
                <input type="checkbox" name="allow_whatsapp_cta" ${draft.allow_whatsapp_cta !== false ? "checked" : ""} />
              </label>
            </div>
          </form>

          <aside class="editor-preview">
            <span class="section-kicker">Prévia do card</span>
            <div class="editor-preview-card">
              <div class="editor-preview-media">
                <img src="${escapeHtml(currentImage)}" alt="Prévia do produto" />
              </div>
              <strong>${escapeHtml(draft.name || "Nome do produto")}</strong>
              <span>${escapeHtml(draft.brand?.name || adminState.brands.find((brand) => brand.id === draft.brand_id)?.name || "Marca")}</span>
              <p>${escapeHtml(draft.short_description || "Descrição curta para o cliente bater o olho e entender o produto.")}</p>
              <strong>${formatCurrency(draft.price || 0, adminState.settings?.currency, adminState.settings?.locale)}</strong>
            </div>
          </aside>
        </div>
      </div>
      <footer class="editor-footer">
        <div class="editor-footer-actions">
          <button class="btn btn-ghost" type="button" id="editor-cancel-button" ${isSavingProduct ? "disabled" : ""}>Cancelar</button>
          <button class="btn btn-secondary" type="button" id="editor-prev-button" ${adminState.productEditorStep === 1 || isSavingProduct ? "disabled" : ""}>Voltar</button>
          <button class="btn btn-secondary" type="button" id="editor-next-button" ${adminState.productEditorStep === 5 || isSavingProduct ? "disabled" : ""}>Próximo</button>
          <button class="btn btn-secondary ${isSavingDraft ? "is-loading" : ""}" type="button" id="save-draft-product" ${isSavingProduct ? "disabled" : ""}>
            ${
              isSavingDraft
                ? `<span class="btn__content"><span class="btn-spinner" aria-hidden="true"></span><span>Salvando...</span></span>`
                : "Salvar rascunho"
            }
          </button>
          <button class="btn btn-primary ${isPublishingProduct ? "is-loading" : ""}" type="button" id="save-publish-product" ${isSavingProduct ? "disabled" : ""}>
            ${
              isPublishingProduct
                ? `<span class="btn__content"><span class="btn-spinner" aria-hidden="true"></span><span>Publicando...</span></span>`
                : "Salvar e publicar"
            }
          </button>
        </div>
      </footer>
    </section>
  `;

  bindProductEditorEvents();
}

function bindProductEditorEvents() {
  qs("#editor-backdrop")?.addEventListener("click", closeProductEditor);
  qs("#close-editor-button")?.addEventListener("click", closeProductEditor);
  qs("#editor-cancel-button")?.addEventListener("click", closeProductEditor);
  qs("#editor-prev-button")?.addEventListener("click", () => changeProductEditorStep(-1));
  qs("#editor-next-button")?.addEventListener("click", () => changeProductEditorStep(1));
  qs("#save-draft-product")?.addEventListener("click", () => saveProduct(false));
  qs("#save-publish-product")?.addEventListener("click", () => saveProduct(true));
  qs("#product-images-input")?.addEventListener("change", (event) => {
    persistEditorDraftFromDom();
    queuePendingProductFiles(Array.from(event.currentTarget.files || []));
    event.currentTarget.value = "";
    renderProductEditor();
  });
  qs("#product-editor-form [name='name']")?.addEventListener("input", (event) => {
    const slugInput = qs("#product-editor-form [name='slug']");
    if (!slugInput.value.trim()) slugInput.value = slugify(event.currentTarget.value);
  });
  qsa("[data-editor-step]").forEach((button) =>
    button.addEventListener("click", () => {
      persistEditorDraftFromDom();
      adminState.productEditorStep = Number(button.dataset.editorStep);
      renderProductEditor();
    })
  );
  qsa("[data-delete-image]").forEach((button) =>
    button.addEventListener("click", () => removeExistingProductImage(button.dataset.deleteImage))
  );
  qsa("[data-primary-image]").forEach((button) =>
    button.addEventListener("click", () => setPrimaryProductImage(button.dataset.primaryImage))
  );
  qsa("[data-remove-pending-image]").forEach((button) =>
    button.addEventListener("click", () => removePendingProductFile(button.dataset.removePendingImage))
  );
}

function getPendingProductFileKey(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function queuePendingProductFiles(files = []) {
  const existingKeys = new Set(adminState.pendingProductFiles.map((file) => getPendingProductFileKey(file)));

  files.forEach((file) => {
    if (!(file instanceof File)) return;
    const key = getPendingProductFileKey(file);
    if (existingKeys.has(key)) return;
    existingKeys.add(key);
    adminState.pendingProductFiles.push(file);
  });
}

function removePendingProductFile(fileKey) {
  adminState.pendingProductFiles = adminState.pendingProductFiles.filter(
    (file) => getPendingProductFileKey(file) !== fileKey
  );
  renderProductEditor();
}

function formatFileSize(size = 0) {
  if (!Number.isFinite(size) || size <= 0) return "Arquivo sem tamanho informado";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getProductImageUploadErrorMessage(error, fileName = "") {
  const rawMessage = error?.message || "Falha desconhecida ao enviar a imagem.";
  const message = rawMessage.toLowerCase();

  if (message.includes("bucket") && message.includes("not found")) {
    return "Crie o bucket 'product-images' no Supabase antes de enviar imagens de produto.";
  }

  if (message.includes("row-level security") || message.includes("not allowed")) {
    return "O Supabase bloqueou o upload da imagem. Revise as policies do bucket 'product-images'.";
  }

  if (message.includes("mime") || message.includes("content type")) {
    return `O arquivo ${fileName || "selecionado"} nao foi aceito pelo Supabase.`;
  }

  if (message.includes("product_images") || message.includes("foreign key")) {
    return `A imagem subiu, mas nao foi vinculada ao produto${fileName ? ` (${fileName})` : ""}. Revise a tabela product_images e as policies.`;
  }

  return fileName ? `Falha ao enviar ${fileName}: ${rawMessage}` : rawMessage;
}

function persistEditorDraftFromDom() {
  const form = qs("#product-editor-form");
  if (!form) return;

  const data = new FormData(form);
  adminState.editingProduct = {
    ...(adminState.editingProduct || createEmptyProductDraft()),
    id: String(data.get("id") || "") || null,
    store_id: adminState.store.id,
    name: String(data.get("name") || ""),
    slug: String(data.get("slug") || ""),
    sku: String(data.get("sku") || ""),
    short_description: String(data.get("short_description") || ""),
    description: String(data.get("description") || ""),
    price: Number(data.get("price") || 0),
    old_price: data.get("old_price") ? Number(data.get("old_price")) : null,
    cost_price: data.get("cost_price") ? Number(data.get("cost_price")) : null,
    stock_quantity: Number(data.get("stock_quantity") || 0),
    stock_status: String(data.get("stock_status") || "in_stock"),
    category_id: String(data.get("category_id") || "") || null,
    brand_id: String(data.get("brand_id") || "") || null,
    tags: String(data.get("tags") || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    attributes: parseJsonSafe(String(data.get("attributes") || "{}"), {}),
    variants: parseJsonSafe(String(data.get("variants") || "[]"), []),
    sort_order: Number(data.get("sort_order") || 0),
    is_active: form.querySelector("[name='is_active']")?.checked || false,
    is_featured: form.querySelector("[name='is_featured']")?.checked || false,
    is_new: form.querySelector("[name='is_new']")?.checked || false,
    is_best_seller: form.querySelector("[name='is_best_seller']")?.checked || false,
    is_promotion: form.querySelector("[name='is_promotion']")?.checked || false,
    allow_whatsapp_cta: form.querySelector("[name='allow_whatsapp_cta']")?.checked ?? true,
    images: adminState.editingProduct?.images || []
  };
}

function changeProductEditorStep(delta) {
  if (adminState.isSavingProduct) return;
  persistEditorDraftFromDom();
  adminState.productEditorStep = Math.max(1, Math.min(5, adminState.productEditorStep + delta));
  renderProductEditor();
}

function closeProductEditor(force = false) {
  if (adminState.isSavingProduct && !force) return;
  adminState.editingProduct = null;
  adminState.pendingProductFiles = [];
  adminState.isSavingProduct = false;
  adminState.productSaveMode = null;
  qs("#admin-modal-root").innerHTML = "";
  setAdminModalOpen("product-editor", false);
}

async function saveProduct(publish) {
  if (adminState.isSavingProduct) return;
  persistEditorDraftFromDom();
  const draft = adminState.editingProduct;
  let savedProduct = null;

  if (!draft.name.trim()) {
    showToast("Nome do produto é obrigatório.", "warning");
    return;
  }

  draft.slug = draft.slug || slugify(draft.name);

  if (publish && (draft.price === null || draft.price === undefined || Number.isNaN(Number(draft.price)))) {
    showToast("Informe um preço válido antes de publicar.", "warning");
    return;
  }

  if (publish && !draft.images?.length && !adminState.pendingProductFiles.length) {
    const proceed = window.confirm("Este produto será publicado sem imagem. Deseja continuar mesmo assim?");
    if (!proceed) return;
  }

  const payload = {
    ...draft,
    store_id: adminState.store.id,
    slug: draft.slug,
    is_active: publish ? true : false,
    is_archived: false
  };

  adminState.isSavingProduct = true;
  adminState.productSaveMode = publish ? "publish" : "draft";
  renderProductEditor();

  try {
    savedProduct = draft.id
      ? await adminUpdateProduct(draft.id, payload)
      : await adminCreateProduct(payload);

    adminState.editingProduct = {
      ...draft,
      ...savedProduct,
      images: Array.isArray(savedProduct.images) ? savedProduct.images : draft.images || []
    };

    if (adminState.pendingProductFiles.length) {
      const createdImages = await uploadProductImages(savedProduct);
      adminState.editingProduct.images = [...(adminState.editingProduct.images || []), ...createdImages];
      adminState.pendingProductFiles = [];
    }

    await adminCreateAuditLog({
      store_id: adminState.store.id,
      user_id: adminState.profile.id,
      action: draft.id ? "product.update" : "product.create",
      entity_type: "products",
      entity_id: savedProduct.id,
      metadata: { publish }
    }).catch(() => {});

    showToast(publish ? "Produto salvo e publicado." : "Produto salvo como rascunho.", "success");
    closeProductEditor(true);
    await refreshAllData();
  } catch (error) {
    console.error(error);
    if (savedProduct?.id) {
      adminState.editingProduct = {
        ...(adminState.editingProduct || draft),
        ...savedProduct,
        images: adminState.editingProduct?.images || savedProduct.images || []
      };
      adminState.isSavingProduct = false;
      adminState.productSaveMode = null;
      renderProductEditor();
      showToast(
        error.message || "Produto salvo, mas houve um problema ao enviar ou vincular a imagem.",
        "danger"
      );
      return;
    }
    adminState.isSavingProduct = false;
    adminState.productSaveMode = null;
    showToast(error.message || "Não foi possível salvar o produto.", "danger");
  }
}

async function uploadProductImages(product) {
  const existingImages = [...(adminState.editingProduct?.images || product.images || [])];
  const createdImages = [];
  const filesToUpload = [...adminState.pendingProductFiles];

  for (let index = 0; index < filesToUpload.length; index += 1) {
    const file = filesToUpload[index];
    try {
      const upload = await uploadProductImage(file, adminState.store.id, product.id);
      const createdImage = await createProductImageRecord({
        store_id: adminState.store.id,
        product_id: product.id,
        image_url: upload.publicUrl,
        storage_path: upload.path,
        alt_text: product.name,
        is_primary: !existingImages.some((image) => image.is_primary) && index === 0,
        sort_order: existingImages.length
      });

      createdImages.push(createdImage);
      existingImages.push(createdImage);

      if (adminState.editingProduct) {
        adminState.editingProduct.images = [...existingImages];
      }

      adminState.pendingProductFiles = adminState.pendingProductFiles.filter(
        (pendingFile) => getPendingProductFileKey(pendingFile) !== getPendingProductFileKey(file)
      );
    } catch (error) {
      throw new Error(getProductImageUploadErrorMessage(error, file?.name));
    }
  }

  return createdImages;
}

async function setPrimaryProductImage(imageId) {
  const draft = adminState.editingProduct;
  const images = draft.images || [];
  await Promise.all(
    images.map((image) =>
      adminUpdateProductImage(image.id, {
        is_primary: image.id === imageId
      })
    )
  );
  draft.images = images.map((image) => ({
    ...image,
    is_primary: image.id === imageId
  }));
  showToast("Imagem principal atualizada.", "success");
  renderProductEditor();
}

async function removeExistingProductImage(imageId) {
  const proceed = window.confirm("Remover esta imagem do produto?");
  if (!proceed) return;
  const currentImages = [...(adminState.editingProduct.images || [])];
  const removedImage = currentImages.find((image) => image.id === imageId);
  let remainingImages = currentImages.filter((image) => image.id !== imageId);

  if (removedImage?.is_primary && remainingImages.length) {
    remainingImages = remainingImages.map((image, index) => ({
      ...image,
      is_primary: index === 0
    }));
  }

  adminState.editingProduct.images = remainingImages;
  renderProductEditor();

  try {
    await adminDeleteProductImage(imageId);

    if (removedImage?.is_primary && remainingImages.length) {
      await adminUpdateProductImage(remainingImages[0].id, { is_primary: true });
    }

    showToast("Imagem removida.", "warning");
  } catch (error) {
    console.error(error);
    adminState.editingProduct.images = currentImages;
    renderProductEditor();
    showToast(error.message || "NÃ£o foi possÃ­vel remover a imagem.", "danger");
  }
}

async function duplicateProduct(productId) {
  const source = adminState.products.find((item) => item.id === productId);
  if (!source) return;

  try {
    const duplicated = await adminCreateProduct({
      ...source,
      id: undefined,
      name: `${source.name} (Cópia)`,
      slug: `${source.slug}-copia-${Date.now()}`,
      is_active: false
    });

    await Promise.all(
      (source.images || []).map((image, index) =>
        createProductImageRecord({
          store_id: adminState.store.id,
          product_id: duplicated.id,
          image_url: image.image_url,
          storage_path: image.storage_path || null,
          alt_text: image.alt_text,
          is_primary: image.is_primary,
          sort_order: image.sort_order ?? index
        })
      )
    );

    showToast("Produto duplicado como rascunho.", "success");
    await refreshAllData();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível duplicar o produto.", "danger");
  }
}

async function deleteProduct(productId) {
  const proceed = window.confirm("Excluir este produto permanentemente?");
  if (!proceed) return;
  await adminDeleteProduct(productId);
  showToast("Produto excluído.", "warning");
  await refreshAllData();
}

async function applyBulkAction(action) {
  if (!adminState.selectedProductIds.length) return;

  const patchMap = {
    activate: { is_active: true, is_archived: false },
    deactivate: { is_active: false },
    promotion: { is_promotion: true },
    featured: { is_featured: true },
    archive: { is_active: false, is_archived: true }
  };

  await adminBulkUpdateProducts(adminState.selectedProductIds, patchMap[action] || {});
  adminState.selectedProductIds = [];
  showToast("Ação em massa aplicada.", "success");
  await refreshAllData();
}

async function saveSection(event) {
  event.preventDefault();
  clearAdminFormDirty("sections");
  const form = event.currentTarget;
  const formData = new FormData(form);
  const selectedProductIds = formData.getAll("selectedProductIds").map(String);

  const payload = {
    id: String(formData.get("id") || "") || undefined,
    store_id: adminState.store.id,
    title: String(formData.get("title") || "").trim(),
    slug: String(formData.get("slug") || "").trim() || slugify(String(formData.get("title") || "")),
    description: String(formData.get("description") || ""),
    type: String(formData.get("type") || "custom"),
    is_active: form.querySelector("[name='is_active']").checked,
    sort_order: Number(formData.get("sort_order") || 0),
    selection_mode: String(formData.get("selection_mode") || "manual"),
    automatic_rule: String(formData.get("automatic_rule") || "") || null,
    automatic_params: parseJsonSafe(String(formData.get("automatic_params") || "{}"), {}),
    max_items: Number(formData.get("max_items") || 12),
    layout: String(formData.get("layout") || "horizontal_carousel"),
    refresh_frequency: String(formData.get("refresh_frequency") || "manual"),
    selectedProductIds,
    refreshNow: String(formData.get("selection_mode") || "manual") === "automatic"
  };

  await adminSaveSection(payload);
  showToast("Seção salva com sucesso.", "success");
  adminState.editingSection = createEmptySectionDraft();
  await refreshAllData();
  adminState.currentAdminTab = "sections";
}

async function refreshSection(sectionId) {
  await adminRefreshAutomaticSection(sectionId);
  showToast("Seção automática atualizada.", "success");
  await refreshAllData();
}

async function refreshStaleSections(silent) {
  const staleSections = adminState.sections.filter(isSectionStale);
  if (!staleSections.length) return;

  for (const section of staleSections) {
    await adminRefreshAutomaticSection(section.id).catch(() => {});
  }

  if (!silent) showToast("Seções automáticas reprocessadas.", "success");
  const refreshedSections = await adminListSections(adminState.store.id);
  adminState.sections = refreshedSections;
  if (!silent) renderAdminLayout();
}

function isSectionStale(section) {
  if (section.selection_mode !== "automatic") return false;
  if (section.refresh_frequency === "manual") return false;
  if (!section.last_refreshed_at) return true;

  const last = new Date(section.last_refreshed_at).getTime();
  const diffDays = (Date.now() - last) / (1000 * 60 * 60 * 24);

  if (section.refresh_frequency === "daily") return diffDays >= 1;
  if (section.refresh_frequency === "weekly") return diffDays >= 7;
  return false;
}

async function saveCategory(event) {
  event.preventDefault();
  clearAdminFormDirty("categories");
  const form = event.currentTarget;
  const data = new FormData(form);
  await adminSaveCategory({
    id: String(data.get("id") || "") || undefined,
    store_id: adminState.store.id,
    name: String(data.get("name") || "").trim(),
    slug: String(data.get("slug") || "").trim() || slugify(String(data.get("name") || "")),
    description: String(data.get("description") || ""),
    image_url: String(data.get("image_url") || ""),
    is_active: form.querySelector("[name='is_active']").checked,
    sort_order: Number(data.get("sort_order") || 0)
  });
  showToast("Categoria salva.", "success");
  adminState.editingCategory = createEmptyCategoryDraft();
  adminState.categories = await adminListCategories(adminState.store.id);
  renderAdminLayout();
}

async function removeCategory(categoryId) {
  if (!window.confirm("Excluir esta categoria?")) return;
  await adminDeleteCategory(categoryId);
  showToast("Categoria excluída.", "warning");
  adminState.categories = await adminListCategories(adminState.store.id);
  renderAdminLayout();
}

async function saveBrand(event) {
  event.preventDefault();
  clearAdminFormDirty("brands");
  const form = event.currentTarget;
  const data = new FormData(form);
  await adminSaveBrand({
    id: String(data.get("id") || "") || undefined,
    store_id: adminState.store.id,
    name: String(data.get("name") || "").trim(),
    slug: String(data.get("slug") || "").trim() || slugify(String(data.get("name") || "")),
    logo_url: String(data.get("logo_url") || ""),
    is_featured: form.querySelector("[name='is_featured']").checked,
    is_active: form.querySelector("[name='is_active']").checked,
    sort_order: Number(data.get("sort_order") || 0)
  });
  showToast("Marca salva.", "success");
  adminState.editingBrand = createEmptyBrandDraft();
  adminState.brands = await adminListBrands(adminState.store.id);
  renderAdminLayout();
}

async function removeBrand(brandId) {
  if (!window.confirm("Excluir esta marca?")) return;
  await adminDeleteBrand(brandId);
  showToast("Marca excluída.", "warning");
  adminState.brands = await adminListBrands(adminState.store.id);
  renderAdminLayout();
}

async function saveBanner(event) {
  event.preventDefault();
  clearAdminFormDirty("appearance");
  const form = event.currentTarget;
  const data = new FormData(form);
  let imageUrl = String(data.get("image_url") || "");

  if (adminState.pendingBannerFile) {
    const upload = await uploadBannerImage(adminState.pendingBannerFile, adminState.store.id);
    imageUrl = upload.publicUrl;
  }

  await adminSaveBanner({
    id: String(data.get("id") || "") || undefined,
    store_id: adminState.store.id,
    title: String(data.get("title") || ""),
    subtitle: String(data.get("subtitle") || ""),
    image_url: imageUrl,
    theme_preset: normalizeHeroThemeKey(String(data.get("theme_preset") || "classic-night")),
    image_position: String(data.get("image_position") || "center center"),
    image_fit: String(data.get("image_fit") || "cover"),
    image_brightness: Number(data.get("image_brightness") || 0.92),
    image_contrast: Number(data.get("image_contrast") || 1.05),
    overlay_strength: Number(data.get("overlay_strength") || 0.56),
    target_url: String(data.get("target_url") || ""),
    target_type: String(data.get("target_type") || "hero"),
    is_active: form.querySelector("[name='is_active']").checked,
    sort_order: Number(data.get("sort_order") || 0),
    starts_at: String(data.get("starts_at") || "") || null,
    ends_at: String(data.get("ends_at") || "") || null
  });

  showToast("Banner salvo com sucesso.", "success");
  adminState.pendingBannerFile = null;
  adminState.editingBanner = createEmptyBannerDraft();
  adminState.banners = await adminListBanners(adminState.store.id);
  renderAdminLayout();
}

async function removeBanner(bannerId) {
  if (!window.confirm("Excluir este banner?")) return;
  await adminDeleteBanner(bannerId);
  showToast("Banner excluído.", "warning");
  adminState.banners = await adminListBanners(adminState.store.id);
  renderAdminLayout();
}

async function saveNotification(event) {
  event.preventDefault();
  clearAdminFormDirty("notifications");
  const form = event.currentTarget;
  const data = new FormData(form);
  const targetUrl = String(data.get("target_url") || "").trim();

  await adminSaveNotification({
    store_id: adminState.store.id,
    title: String(data.get("title") || "").trim(),
    body: String(data.get("body") || "").trim(),
    target_url: targetUrl || "./index.html",
    image_url: String(data.get("image_url") || ""),
    status: "draft",
    created_by: adminState.profile.id
  });
  showToast("Notificação salva em rascunho.", "success");
  adminState.notifications = await adminListNotifications(adminState.store.id);
  renderAdminLayout();
}

async function sendNotification(notificationId) {
  if (!adminState.settings?.enable_notifications) {
    showToast("Ative notificações nas configurações da loja antes de enviar.", "warning");
    return;
  }

  try {
    const result = await adminSendNotification(notificationId);
    if (result?.sent > 0) {
      showToast(`Notificação enviada para ${result.sent} dispositivo(s).`, "success");
    } else {
      showToast(result?.message || "Nenhum dispositivo inscrito para receber notificações.", "warning");
    }
  } catch (error) {
    console.error(error);
    await adminSaveNotification({
      id: notificationId,
      status: "failed",
      sent_at: null
    }).catch((updateError) => console.warn("Não foi possível marcar a notificação como falha.", updateError));
    showToast(error.message || "Não foi possível enviar a notificação.", "danger");
  }

  adminState.notifications = await adminListNotifications(adminState.store.id);
  renderAdminLayout();
}

async function saveSettings(event) {
  event.preventDefault();
  clearAdminFormDirty("settings");
  const form = event.currentTarget;
  const data = new FormData(form);

  const storePayload = {
    name: String(data.get("store_name") || "").trim(),
    slug: String(data.get("slug") || "").trim() || slugify(String(data.get("store_name") || "")),
    slogan: String(data.get("slogan") || ""),
    description: String(data.get("description") || ""),
    logo_url: String(data.get("logo_url") || "")
  };

  const settingsPayload = {
    store_id: adminState.store.id,
    whatsapp_number: String(data.get("whatsapp_number") || ""),
    whatsapp_default_message: String(data.get("whatsapp_default_message") || ""),
    instagram_url: String(data.get("instagram_url") || ""),
    address: String(data.get("address") || ""),
    business_hours: parseJsonSafe(String(data.get("business_hours") || "{}"), defaultBusinessHours()),
    primary_color: String(data.get("primary_color") || "#111827"),
    secondary_color: String(data.get("secondary_color") || "#e56b2f"),
    theme_mode: String(data.get("theme_mode") || "light"),
    intro_mode: String(data.get("intro_mode") || "logo"),
    hero_mode: String(data.get("hero_mode") || "banner"),
    enable_notifications: form.querySelector("[name='enable_notifications']").checked,
    enable_favorites: form.querySelector("[name='enable_favorites']").checked,
    enable_future_cart_flag: form.querySelector("[name='enable_future_cart_flag']").checked,
    currency: String(data.get("currency") || "BRL"),
    locale: String(data.get("locale") || "pt-BR")
  };

  await adminUpdateStore(adminState.store.id, storePayload);
  adminState.settings = await adminSaveStoreSettings(settingsPayload);
  adminState.store = {
    ...adminState.store,
    ...storePayload
  };
  setThemeVariables(adminState.settings, { context: "admin" });
  showToast("Configurações salvas.", "success");
  renderAdminLayout();
}

async function refreshAllData() {
  const [productsRes, categories, brands, sections, banners, notifications, pushSummary] = await Promise.all([
    adminListProducts(adminState.store.id, adminState.productFilters),
    adminListCategories(adminState.store.id),
    adminListBrands(adminState.store.id),
    adminListSections(adminState.store.id),
    adminListBanners(adminState.store.id),
    adminListNotifications(adminState.store.id),
    adminListPushSubscriptionsSummary(adminState.store.id)
  ]);

  adminState.products = productsRes.data || [];
  adminState.categories = categories || [];
  adminState.brands = brands || [];
  adminState.sections = sections || [];
  adminState.banners = banners || [];
  adminState.notifications = notifications || [];
  adminState.pushSummary = pushSummary || { count: 0, data: [] };
  adminState.pendingBackgroundRender = false;

  renderAdminLayout();
}

function renderOptions(options, selectedValue) {
  return options
    .map(
      (option) =>
        `<option value="${escapeHtml(option.value)}" ${option.value === selectedValue ? "selected" : ""}>${escapeHtml(option.label)}</option>`
    )
    .join("");
}

function renderEntityOptions(items, selectedValue, defaultLabel) {
  return [
    `<option value="">${escapeHtml(defaultLabel)}</option>`,
    ...items.map(
      (item) =>
        `<option value="${escapeHtml(item.id)}" ${item.id === selectedValue ? "selected" : ""}>${escapeHtml(item.name || item.title)}</option>`
    )
  ].join("");
}

function renderProductStatusBadge(product) {
  if (product.is_archived) return '<span class="badge badge--danger">Arquivado</span>';
  if (product.is_active) return '<span class="badge badge--success">Publicado</span>';
  return '<span class="badge badge--muted">Rascunho</span>';
}

function renderFlagBadges(product) {
  const flags = [];
  if (product.is_featured) flags.push("Destaque");
  if (product.is_promotion) flags.push("Promo");
  if (product.is_new) flags.push("Novo");
  if (product.is_best_seller) flags.push("Venda");
  return flags.length ? flags.join(" · ") : "—";
}

function normalizeHeroThemeKey(theme) {
  const allowed = new Set(HERO_THEME_OPTIONS.map((option) => option.value));
  return allowed.has(theme) ? theme : "classic-night";
}

function clampPreviewValue(value, fallback, min, max) {
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

function buildHeroPreviewStyle(banner = {}) {
  const imageUrl = banner?.image_url ? `url("${escapeCssUrl(banner.image_url)}")` : "none";
  const imagePosition = HERO_POSITION_OPTIONS.some((option) => option.value === banner?.image_position)
    ? banner.image_position
    : "center center";
  const imageFit = HERO_FIT_OPTIONS.some((option) => option.value === banner?.image_fit) ? banner.image_fit : "cover";
  const brightness = clampPreviewValue(banner?.image_brightness, 0.92, 0.4, 1.6);
  const contrast = clampPreviewValue(banner?.image_contrast, 1.05, 0.6, 1.8);
  const overlayStrength = clampPreviewValue(banner?.overlay_strength, 0.56, 0.08, 0.92);

  return [
    `--hero-bg-image: ${imageUrl}`,
    `--hero-image-position: ${imagePosition}`,
    `--hero-image-fit: ${imageFit}`,
    `--hero-image-brightness: ${brightness}`,
    `--hero-image-contrast: ${contrast}`,
    `--hero-overlay-strength: ${overlayStrength}`
  ].join("; ");
}

function getTabLabel(tabId) {
  return TABS.find((item) => item.id === tabId)?.label || "Painel";
}

function createEmptyProductDraft() {
  return {
    id: null,
    store_id: adminState.store?.id,
    name: "",
    slug: "",
    sku: "",
    short_description: "",
    description: "",
    price: 0,
    old_price: null,
    cost_price: null,
    category_id: "",
    brand_id: "",
    stock_quantity: 0,
    stock_status: "in_stock",
    is_active: false,
    is_featured: false,
    is_new: false,
    is_best_seller: false,
    is_promotion: false,
    allow_whatsapp_cta: true,
    tags: [],
    attributes: {},
    variants: [],
    sort_order: 0,
    images: []
  };
}

function createEmptySectionDraft() {
  return {
    id: null,
    title: "",
    slug: "",
    description: "",
    type: "custom",
    is_active: true,
    sort_order: 0,
    selection_mode: "manual",
    automatic_rule: "",
    automatic_params: {},
    max_items: 12,
    layout: "horizontal_carousel",
    refresh_frequency: "manual",
    section_products: []
  };
}

function createEmptyCategoryDraft() {
  return {
    id: null,
    name: "",
    slug: "",
    description: "",
    image_url: "",
    sort_order: 0,
    is_active: true
  };
}

function createEmptyBrandDraft() {
  return {
    id: null,
    name: "",
    slug: "",
    logo_url: "",
    sort_order: 0,
    is_featured: false,
    is_active: true
  };
}

function createEmptyBannerDraft() {
  return {
    id: null,
    title: "",
    subtitle: "",
    image_url: "",
    theme_preset: "classic-night",
    image_position: "center center",
    image_fit: "cover",
    image_brightness: 0.92,
    image_contrast: 1.05,
    overlay_strength: 0.56,
    target_url: "",
    target_type: "hero",
    is_active: true,
    sort_order: 0,
    starts_at: null,
    ends_at: null
  };
}

function defaultBusinessHours() {
  return {
    monday: [{ start: "09:00", end: "18:00" }],
    tuesday: [{ start: "09:00", end: "18:00" }],
    wednesday: [{ start: "09:00", end: "18:00" }],
    thursday: [{ start: "09:00", end: "18:00" }],
    friday: [{ start: "09:00", end: "18:00" }],
    saturday: [{ start: "09:00", end: "13:00" }],
    sunday: []
  };
}

function toDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function debounceAdmin(callback) {
  let timerId = 0;
  return (...args) => {
    window.clearTimeout(timerId);
    timerId = window.setTimeout(() => callback(...args), 260);
  };
}

function normalizeBusinessHours(sourceValue) {
  const parsed = parseJsonSafe(sourceValue, null);
  const source =
    parsed && typeof parsed === "object" && Object.keys(parsed).length ? parsed : defaultBusinessHours();

  return BUSINESS_HOURS_DAYS.reduce((accumulator, day) => {
    const periods = Array.isArray(source?.[day.key]) ? source[day.key] : [];
    accumulator[day.key] = periods
      .map((period) => ({
        start: normalizeTimeValue(period?.start, "09:00"),
        end: normalizeTimeValue(period?.end, "18:00")
      }))
      .filter((period) => isBusinessHoursRangeValid(period.start, period.end))
      .slice(0, 2);

    return accumulator;
  }, {});
}

function normalizeTimeValue(value, fallback) {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value || "").trim());
  return match ? `${match[1]}:${match[2]}` : fallback;
}

function getBusinessHoursDayDraft(periods = []) {
  const firstPeriod = periods[0] || { start: "09:00", end: "18:00" };
  const secondPeriod = periods[1] || { start: "13:00", end: "18:00" };

  return {
    closed: !periods.length,
    split: periods.length > 1,
    morningStart: normalizeTimeValue(firstPeriod.start, "09:00"),
    morningEnd: normalizeTimeValue(firstPeriod.end, "18:00"),
    afternoonStart: normalizeTimeValue(secondPeriod.start, "13:00"),
    afternoonEnd: normalizeTimeValue(secondPeriod.end, "18:00")
  };
}

function formatBusinessHoursPeriods(periods = []) {
  if (!periods.length) return "Fechado";
  return periods.map((period) => `${period.start} as ${period.end}`).join(" • ");
}

function renderBusinessHoursSummary(hours) {
  const normalized = normalizeBusinessHours(hours);

  return BUSINESS_HOURS_DAYS.map(
    (day) => `
      <article class="business-hours-summary__row">
        <strong>${escapeHtml(day.label)}</strong>
        <span>${escapeHtml(formatBusinessHoursPeriods(normalized[day.key]))}</span>
      </article>
    `
  ).join("");
}

function buildBusinessHoursCompactLabel(hours) {
  const normalized = normalizeBusinessHours(hours);
  const openDays = BUSINESS_HOURS_DAYS.filter((day) => normalized[day.key]?.length);
  if (!openDays.length) return "Nenhum horario definido";
  return `${openDays.length} dia(s) com expediente definido`;
}

function isBusinessHoursRangeValid(start, end) {
  return timeToMinutes(start) < timeToMinutes(end);
}

function timeToMinutes(value) {
  const [hour = "0", minute = "0"] = String(value || "").split(":");
  return Number(hour) * 60 + Number(minute);
}

function mountBusinessHoursEditor() {
  const hoursField = qs("#settings-form textarea[name='business_hours']");
  if (!hoursField) return;

  const wrapper = hoursField.closest(".admin-field");
  if (!wrapper) return;

  const normalized = normalizeBusinessHours(hoursField.value);
  hoursField.value = JSON.stringify(normalized);
  hoursField.classList.add("is-hidden");
  hoursField.setAttribute("aria-hidden", "true");

  const label = wrapper.querySelector("span");
  if (label) {
    label.textContent = "Horarios de funcionamento";
  }

  let card = wrapper.querySelector(".business-hours-card");
  if (!card) {
    card = document.createElement("section");
    card.className = "business-hours-card";
    wrapper.appendChild(card);
  }

  card.innerHTML = `
    <div class="business-hours-card__header">
      <div>
        <strong class="list-item-title">Expediente da loja</strong>
        <p class="muted-copy">Defina um turno simples ou dois turnos com pausa para almoco.</p>
      </div>
      <button class="btn btn-secondary" type="button" id="open-business-hours-editor">Editar horarios</button>
    </div>
    <div id="business-hours-summary" class="business-hours-summary">
      ${renderBusinessHoursSummary(normalized)}
    </div>
  `;
}

function openBusinessHoursEditor() {
  const hoursField = qs("#settings-form textarea[name='business_hours']");
  if (!hoursField) return;

  setAdminModalOpen("hours-editor", true);
  const normalized = normalizeBusinessHours(hoursField.value);
  let modalRoot = qs("#admin-hours-modal-root");
  if (!modalRoot) {
    modalRoot = document.createElement("div");
    modalRoot.id = "admin-hours-modal-root";
    document.body.appendChild(modalRoot);
  }

  modalRoot.innerHTML = `
    <div class="editor-backdrop" id="hours-editor-backdrop"></div>
    <section class="editor-shell hours-editor-shell" role="dialog" aria-modal="true" aria-labelledby="hours-editor-title">
      <header class="editor-header">
        <div>
          <span class="section-kicker">Atendimento da loja</span>
          <h2 id="hours-editor-title">Horarios de funcionamento</h2>
        </div>
        <button class="btn btn-ghost" type="button" id="close-hours-editor">Fechar</button>
      </header>
      <div class="editor-body hours-editor-body">
        <p class="muted-copy">Escolha um horario continuo ou ative a pausa de almoco para cadastrar dois turnos no mesmo dia.</p>
        <div class="hours-editor-grid">
          ${BUSINESS_HOURS_DAYS.map((day) => {
            const draft = getBusinessHoursDayDraft(normalized[day.key]);
            return `
              <article class="hours-day-card ${draft.closed ? "is-closed" : ""} ${draft.split ? "has-split" : ""}" data-hours-day="${escapeHtml(day.key)}">
                <div class="hours-day-card__header">
                  <strong>${escapeHtml(day.label)}</strong>
                  <label class="hours-day-toggle">
                    <input type="checkbox" data-hours-closed ${draft.closed ? "checked" : ""} />
                    <span>Fechado</span>
                  </label>
                </div>
                <div class="hours-day-card__body">
                  <label class="hours-day-split">
                    <input type="checkbox" data-hours-split ${draft.split ? "checked" : ""} ${draft.closed ? "disabled" : ""} />
                    <span>Com pausa para almoco</span>
                  </label>
                  <div class="hours-time-grid">
                    <label class="admin-field">
                      <span>Inicio</span>
                      <input type="time" data-hours-morning-start value="${escapeHtml(draft.morningStart)}" ${draft.closed ? "disabled" : ""} />
                    </label>
                    <label class="admin-field">
                      <span>Fim</span>
                      <input type="time" data-hours-morning-end value="${escapeHtml(draft.morningEnd)}" ${draft.closed ? "disabled" : ""} />
                    </label>
                  </div>
                  <div class="hours-time-grid hours-time-grid--split">
                    <label class="admin-field">
                      <span>Retorno</span>
                      <input type="time" data-hours-afternoon-start value="${escapeHtml(draft.afternoonStart)}" ${draft.closed || !draft.split ? "disabled" : ""} />
                    </label>
                    <label class="admin-field">
                      <span>Encerramento</span>
                      <input type="time" data-hours-afternoon-end value="${escapeHtml(draft.afternoonEnd)}" ${draft.closed || !draft.split ? "disabled" : ""} />
                    </label>
                  </div>
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </div>
      <footer class="editor-footer">
        <div class="editor-footer-actions">
          <button class="btn btn-secondary" type="button" id="cancel-hours-editor">Cancelar</button>
          <button class="btn btn-primary" type="button" id="apply-hours-editor">Aplicar horarios</button>
        </div>
      </footer>
    </section>
  `;

  qsa("[data-hours-day]", modalRoot).forEach(syncBusinessHoursDayCard);
  qs("#hours-editor-backdrop")?.addEventListener("click", closeBusinessHoursEditor);
  qs("#close-hours-editor")?.addEventListener("click", closeBusinessHoursEditor);
  qs("#cancel-hours-editor")?.addEventListener("click", closeBusinessHoursEditor);
  qs("#apply-hours-editor")?.addEventListener("click", applyBusinessHoursEditor);

  modalRoot.addEventListener("change", (event) => {
    const card = event.target.closest("[data-hours-day]");
    if (!card) return;
    syncBusinessHoursDayCard(card);
  });
}

function syncBusinessHoursDayCard(card) {
  const closedInput = qs("[data-hours-closed]", card);
  const splitInput = qs("[data-hours-split]", card);
  const morningStart = qs("[data-hours-morning-start]", card);
  const morningEnd = qs("[data-hours-morning-end]", card);
  const afternoonStart = qs("[data-hours-afternoon-start]", card);
  const afternoonEnd = qs("[data-hours-afternoon-end]", card);
  const isClosed = Boolean(closedInput?.checked);
  const hasSplit = Boolean(splitInput?.checked) && !isClosed;

  card.classList.toggle("is-closed", isClosed);
  card.classList.toggle("has-split", hasSplit);

  if (splitInput) splitInput.disabled = isClosed;
  [morningStart, morningEnd].forEach((input) => {
    if (input) input.disabled = isClosed;
  });
  [afternoonStart, afternoonEnd].forEach((input) => {
    if (input) input.disabled = isClosed || !hasSplit;
  });
}

function applyBusinessHoursEditor() {
  const modalRoot = qs("#admin-hours-modal-root");
  const hoursField = qs("#settings-form textarea[name='business_hours']");
  if (!modalRoot || !hoursField) return;

  const nextValue = {};

  for (const day of BUSINESS_HOURS_DAYS) {
    const card = qs(`[data-hours-day="${day.key}"]`, modalRoot);
    if (!card) continue;

    const closed = qs("[data-hours-closed]", card)?.checked;
    const split = qs("[data-hours-split]", card)?.checked;
    if (closed) {
      nextValue[day.key] = [];
      continue;
    }

    const morningStart = normalizeTimeValue(qs("[data-hours-morning-start]", card)?.value, "09:00");
    const morningEnd = normalizeTimeValue(qs("[data-hours-morning-end]", card)?.value, "18:00");

    if (!isBusinessHoursRangeValid(morningStart, morningEnd)) {
      showToast(`Revise o primeiro turno de ${day.label}.`, "warning");
      return;
    }

    const periods = [{ start: morningStart, end: morningEnd }];

    if (split) {
      const afternoonStart = normalizeTimeValue(qs("[data-hours-afternoon-start]", card)?.value, "13:00");
      const afternoonEnd = normalizeTimeValue(qs("[data-hours-afternoon-end]", card)?.value, "18:00");

      if (!isBusinessHoursRangeValid(afternoonStart, afternoonEnd)) {
        showToast(`Revise o segundo turno de ${day.label}.`, "warning");
        return;
      }

      if (timeToMinutes(afternoonStart) <= timeToMinutes(morningEnd)) {
        showToast(`A pausa de ${day.label} precisa comecar depois do primeiro turno.`, "warning");
        return;
      }

      periods.push({ start: afternoonStart, end: afternoonEnd });
    }

    nextValue[day.key] = periods;
  }

  hoursField.value = JSON.stringify(nextValue);
  qs("#business-hours-summary")?.replaceChildren();
  const summary = qs("#business-hours-summary");
  if (summary) {
    summary.innerHTML = renderBusinessHoursSummary(nextValue);
  }

  markAdminFormDirty("settings");
  closeBusinessHoursEditor();
}

function closeBusinessHoursEditor() {
  qs("#admin-hours-modal-root")?.remove();
  setAdminModalOpen("hours-editor", false);
}

initAdmin();
