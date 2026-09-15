import { APP_CONFIG } from "./config.js";
import { invalidateStorefrontCache } from "./dataCache.js";
import { optimizeImageForUpload } from "./imageOptimization.js";
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
  adminListProductOptionGroups,
  adminListProductOptionSelections,
  adminListProductOptionValues,
  adminListPushSubscriptionsSummary,
  adminListSections,
  adminRefreshAutomaticSection,
  adminDeactivateProductOptionGroup,
  adminDeactivateProductOptionValue,
  adminSaveBanner,
  adminSaveBrand,
  adminSaveCategory,
  adminSaveNotification,
  adminSaveProductOptionGroup,
  adminSaveProductOptionSelections,
  adminSaveProductOptionValue,
  adminSaveSection,
  adminSaveStoreSettings,
  adminSendNotification,
  adminUpdateProduct,
  adminSetPrimaryProductImage,
  adminUpdateStore,
  createProductImageRecord,
  createUploadedProductImageRecord,
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
  { id: "options", label: "Opções" },
  { id: "appearance", label: "Banners" },
  { id: "notifications", label: "Notificações" },
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

const NOTIFICATION_PAGE_SIZE = 5;
const PASSWORD_MIN_LENGTH = 8;

const adminState = {
  session: null,
  profile: null,
  membership: null,
  store: null,
  settings: null,
  products: [],
  filteredProducts: [],
  categories: [],
  brands: [],
  productOptionGroups: [],
  productOptionValues: [],
  sections: [],
  banners: [],
  notifications: [],
  pushSummary: { count: 0, data: [] },
  editingProduct: null,
  editingSection: null,
  editingCategory: null,
  editingBrand: null,
  editingOptionGroup: null,
  editingOptionValue: null,
  editingBanner: null,
  currentAdminTab: "dashboard",
  productEditorStep: 1,
  pendingProductFiles: [],
  pendingBannerFile: null,
  isNotificationHistoryOpen: false,
  notificationHistoryPage: 1,
  notificationPlanningModalType: "",
  notificationPlanningPage: 1,
  editingNotificationId: null,
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
  previewNeedsRefresh: false,
  previewReady: false,
  previewRefreshTimer: 0,
  passwordRecoveryActive: false,
  isPasswordChangeOpen: false,
  isSavingProduct: false,
  productSaveMode: null,
  productImageOperation: null
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
  window.addEventListener("message", handlePreviewBridgeMessage);
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
  adminState.passwordRecoveryActive = false;
  adminState.isPasswordChangeOpen = false;
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

    if (event === "PASSWORD_RECOVERY") {
      adminState.passwordRecoveryActive = true;
      renderPasswordUpdate({ recovery: true });
      return;
    }

    if (!session || event === "SIGNED_OUT") {
      resetAdminSessionState();
      renderLogin();
      return;
    }

    if (isPasswordRecoveryRoute() || adminState.passwordRecoveryActive) {
      renderPasswordUpdate({ recovery: true });
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
    if (isPasswordRecoveryRoute()) {
      renderPasswordUpdate({ recovery: true, waitingForSession: true });
    } else {
      renderLogin();
    }
    return;
  }

  if (isPasswordRecoveryRoute() || adminState.passwordRecoveryActive) {
    adminState.passwordRecoveryActive = true;
    renderPasswordUpdate({ recovery: true });
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

    const profilePromise = withTimeout(getCurrentUserProfile(sessionUserId), 10000, "getCurrentUserProfile");
    const profile = await profilePromise;

    const membershipsPromise = withTimeout(getMyStoreMemberships(sessionUserId), 10000, "getMyStoreMemberships");
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
    const productsPromise = withTimeout(adminListProducts(membership.store.id, {}), 10000, "adminListProducts");
    const filteredProductsPromise = hasActiveProductFilters()
      ? withTimeout(adminListProducts(membership.store.id, adminState.productFilters), 10000, "adminListFilteredProducts")
      : productsPromise;
    const categoriesPromise = withTimeout(adminListCategories(membership.store.id), 10000, "adminListCategories");
    const brandsPromise = withTimeout(adminListBrands(membership.store.id), 10000, "adminListBrands");
    const optionGroupsPromise = withTimeout(adminListProductOptionGroups(membership.store.id), 10000, "adminListProductOptionGroups");
    const optionValuesPromise = withTimeout(adminListProductOptionValues(membership.store.id), 10000, "adminListProductOptionValues");
    const sectionsPromise = withTimeout(adminListSections(membership.store.id), 10000, "adminListSections");
    const bannersPromise = withTimeout(adminListBanners(membership.store.id), 10000, "adminListBanners");
    const notificationsPromise = withTimeout(adminListNotifications(membership.store.id), 10000, "adminListNotifications");
    const pushSummaryPromise = withTimeout(adminListPushSubscriptionsSummary(membership.store.id), 10000, "adminListPushSubscriptionsSummary");

    const [settings, productsRes, filteredProductsRes, categories, brands, optionGroups, optionValues, sections, banners, notifications, pushSummary] = await Promise.all([
      settingsPromise,
      productsPromise,
      filteredProductsPromise,
      categoriesPromise,
      brandsPromise,
      optionGroupsPromise,
      optionValuesPromise,
      sectionsPromise,
      bannersPromise,
      notificationsPromise,
      pushSummaryPromise
    ]);

    adminState.settings = settings;
    adminState.products = productsRes.data || [];
    adminState.filteredProducts = filteredProductsRes.data || productsRes.data || [];
    adminState.categories = categories || [];
    adminState.brands = brands || [];
    adminState.productOptionGroups = optionGroups || [];
    adminState.productOptionValues = optionValues || [];
    adminState.sections = sections || [];
    adminState.banners = banners || [];
    adminState.notifications = notifications || [];
    adminState.pushSummary = pushSummary || { count: 0, data: [] };
    adminState.hasLoadedAdminData = true;
    adminState.lastLoadedUserId = sessionUserId;

    setThemeVariables(settings || {}, { context: "admin" });
    renderAdminLayoutFromBackground();
    refreshStaleSections(true)
      .then((refreshedCount) => {
        if (refreshedCount > 0) notifyStorefrontChanged("automatic-sections-stale-refresh");
      })
      .catch((error) => console.warn("Falha ao reprocessar seções automáticas vencidas.", error));
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

function renderLogin(options = {}) {
  const message = options.message
    ? `<p class="auth-status auth-status--success">${escapeHtml(options.message)}</p>`
    : "";

  qs("#admin-root").innerHTML = `
    <div class="auth-screen">
      <section class="auth-card">
        <span class="section-kicker">VitrineZap Admin</span>
        <h1>Entrar no painel</h1>
        <p>Use seu email e senha cadastrados no Supabase Auth para acessar a gestão da loja.</p>
        ${message}
        <form id="login-form">
          <label class="admin-field">
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" placeholder="gerente@loja.com" value="${escapeHtml(options.email || "")}" />
          </label>
          <label class="admin-field">
            <span>Senha</span>
            <input type="password" name="password" required autocomplete="current-password" placeholder="Sua senha" />
          </label>
          <div class="auth-actions auth-actions--split">
            <button class="btn btn-primary" type="submit">Entrar</button>
            <button class="text-button" type="button" id="forgot-password-button">Esqueci minha senha</button>
          </div>
        </form>
      </section>
    </div>
  `;

  qs("#login-form")?.addEventListener("submit", handleLogin);
  qs("#forgot-password-button")?.addEventListener("click", () =>
    renderPasswordResetRequest({ email: qs("#login-form input[name='email']")?.value.trim() || "" })
  );
}

function renderPasswordResetRequest(options = {}) {
  const message = options.message
    ? `<p class="auth-status auth-status--${escapeHtml(options.status || "success")}">${escapeHtml(options.message)}</p>`
    : "";

  qs("#admin-root").innerHTML = `
    <div class="auth-screen">
      <section class="auth-card">
        <span class="section-kicker">Recuperação de acesso</span>
        <h1>Esqueci minha senha</h1>
        <p>Informe o e-mail do usuário administrador. Se ele estiver cadastrado, enviaremos um link para definir uma nova senha.</p>
        ${message}
        <form id="password-reset-form">
          <label class="admin-field">
            <span>Email</span>
            <input type="email" name="email" required autocomplete="email" placeholder="gerente@loja.com" value="${escapeHtml(options.email || "")}" />
          </label>
          <div class="auth-actions auth-actions--split">
            <button class="btn btn-primary" type="submit">Enviar link de recuperação</button>
            <button class="text-button" type="button" id="back-to-login-button">Voltar para o login</button>
          </div>
        </form>
      </section>
    </div>
  `;

  qs("#password-reset-form")?.addEventListener("submit", handlePasswordResetRequest);
  qs("#back-to-login-button")?.addEventListener("click", () =>
    renderLogin({ email: qs("#password-reset-form input[name='email']")?.value.trim() || "" })
  );
}

function renderPasswordUpdate(options = {}) {
  const waitingMessage = options.waitingForSession
    ? `<p class="auth-status auth-status--warning">Estamos validando o link de recuperação. Se esta mensagem permanecer, solicite um novo link.</p>`
    : "";
  const helperCopy = options.recovery
    ? "Digite uma nova senha para concluir a recuperação de acesso."
    : "Digite a nova senha da sua conta administrativa.";

  qs("#admin-root").innerHTML = `
    <div class="auth-screen">
      <section class="auth-card">
        <span class="section-kicker">Segurança da conta</span>
        <h1>Definir nova senha</h1>
        <p>${helperCopy}</p>
        ${waitingMessage}
        <form id="password-update-form" data-password-context="${options.recovery ? "recovery" : "session"}">
          <input class="visually-hidden" type="email" name="username" autocomplete="username" value="${escapeHtml(adminState.session?.user?.email || "")}" tabindex="-1" aria-hidden="true" readonly />
          <label class="admin-field">
            <span>Nova senha</span>
            <input type="password" name="password" required minlength="${PASSWORD_MIN_LENGTH}" autocomplete="new-password" placeholder="Mínimo de ${PASSWORD_MIN_LENGTH} caracteres" />
          </label>
          <label class="admin-field">
            <span>Confirmar nova senha</span>
            <input type="password" name="confirmPassword" required minlength="${PASSWORD_MIN_LENGTH}" autocomplete="new-password" placeholder="Repita a nova senha" />
          </label>
          <p class="muted-copy password-requirements">Use pelo menos ${PASSWORD_MIN_LENGTH} caracteres. Evite senhas óbvias ou reutilizadas.</p>
          <div class="auth-actions auth-actions--split">
            <button class="btn btn-primary" type="submit">Salvar nova senha</button>
            <button class="text-button" type="button" id="back-to-login-button">Voltar para o login</button>
          </div>
        </form>
      </section>
    </div>
  `;

  qs("#password-update-form")?.addEventListener("submit", handlePasswordUpdate);
  qs("#back-to-login-button")?.addEventListener("click", async () => {
    adminState.passwordRecoveryActive = false;
    clearPasswordRecoveryUrl();
    await supabase.auth.signOut().catch(() => {});
    renderLogin();
  });
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

async function handlePasswordResetRequest(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;

  const email = form.email.value.trim();
  const genericMessage = "Se este e-mail estiver cadastrado, enviaremos um link para você definir uma nova senha.";

  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordRecoveryRedirectUrl()
    });
    if (error) throw error;
    renderPasswordResetRequest({ email, message: genericMessage, status: "success" });
    showToast("Solicitação de recuperação enviada.", "success");
  } catch (error) {
    console.error(error);
    renderPasswordResetRequest({
      email,
      message: error.message || "Não foi possível enviar o link de recuperação agora.",
      status: "danger"
    });
    showToast(error.message || "Não foi possível enviar o link de recuperação.", "danger");
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function handlePasswordUpdate(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  const isRecovery = form.dataset.passwordContext === "recovery";
  button.disabled = true;

  try {
    await updateAccountPasswordFromForm(form);
    adminState.passwordRecoveryActive = false;
    clearPasswordRecoveryUrl();
    showToast("Senha atualizada com sucesso.", "success");

    if (isRecovery) {
      await supabase.auth.signOut().catch(() => {});
      renderLogin({ message: "Senha atualizada. Entre novamente usando a nova senha." });
    }
  } catch (error) {
    if (!isPasswordValidationError(error)) console.error(error);
    showToast(error.message || "Não foi possível atualizar a senha.", "danger");
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

async function updateAccountPasswordFromForm(form) {
  const password = String(form.password.value || "");
  const confirmPassword = String(form.confirmPassword.value || "");

  if (password.length < PASSWORD_MIN_LENGTH) {
    throw createPasswordValidationError(`A nova senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`);
  }

  if (password !== confirmPassword) {
    throw createPasswordValidationError("As senhas não conferem.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

function createPasswordValidationError(message) {
  const error = new Error(message);
  error.name = "PasswordValidationError";
  return error;
}

function isPasswordValidationError(error) {
  return error?.name === "PasswordValidationError";
}

function getPasswordRecoveryRedirectUrl() {
  const url = new URL(window.location.href);
  url.search = "?mode=recover";
  url.hash = "";
  return url.href;
}

function isPasswordRecoveryRoute() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return (
    searchParams.get("mode") === "recover" ||
    searchParams.get("type") === "recovery" ||
    hashParams.get("type") === "recovery"
  );
}

function clearPasswordRecoveryUrl() {
  if (!isPasswordRecoveryRoute() && !window.location.hash) return;
  const url = new URL(window.location.href);
  url.searchParams.delete("mode");
  url.searchParams.delete("type");
  url.hash = "";
  window.history.replaceState(null, document.title, `${url.pathname}${url.search}`);
}

async function handleLogout() {
  await supabase.auth.signOut();
  showToast("Sessão encerrada.", "warning");
}

function renderAdminLayout() {
  const root = qs("#admin-root");
  if (adminState.currentAdminTab === "preview" && root?.querySelector(".preview-frame")) {
    syncPreviewStatus();
    return;
  }
  if (adminState.currentAdminTab === "preview") {
    window.clearTimeout(adminState.previewRefreshTimer);
    adminState.previewRefreshTimer = 0;
    adminState.previewNeedsRefresh = false;
    adminState.previewReady = false;
  }  root.innerHTML = `
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
        <header class="admin-topbar" id="admin-topbar">
          <div class="topbar-meta">
            <span class="section-kicker">Loja ativa</span>
            <h1>${escapeHtml(getTabLabel(adminState.currentAdminTab))}</h1>
            <p>${escapeHtml(adminState.store.name)} · ${escapeHtml(adminState.store.slug)}</p>
          </div>
          <div class="topbar-actions">
            <button class="btn btn-secondary" type="button" id="quick-new-product">Novo produto</button>
            <button class="btn btn-secondary" type="button" id="open-preview-tab">Abrir site</button>
            <button class="btn btn-secondary" type="button" id="change-password-button">Alterar senha</button>
            <button class="btn btn-ghost" type="button" id="sign-out-button">Sair</button>
          </div>
        </header>

        <section class="admin-content">
          <section class="panel-card bottom-nav" aria-label="Navegação do painel">
            <div class="mobile-nav-compact">
              <div class="mobile-nav-store">
                <span class="section-kicker">Loja ativa</span>
                <strong>${escapeHtml(adminState.store.name)}</strong>
                <small>${escapeHtml(getTabLabel(adminState.currentAdminTab))}</small>
              </div>
              <div class="mobile-nav-actions" aria-label="Ações rápidas">
                <button class="compact-action-button" type="button" data-mobile-admin-action="new-product" aria-label="Novo produto">+</button>
                <button class="compact-action-button" type="button" data-mobile-admin-action="open-site" aria-label="Abrir site">Site</button>
                <button class="compact-action-button" type="button" data-mobile-admin-action="password" aria-label="Alterar senha">Senha</button>
                <button class="compact-action-button" type="button" data-mobile-admin-action="logout" aria-label="Sair">Sair</button>
              </div>
            </div>
            <div class="toolbar-actions">${renderTabButtons()}</div>
          </section>
          ${renderCurrentTab()}
        </section>
      </main>
    </div>
  `;

  bindAdminLayoutEvents();
  renderNotificationHistoryModal();
  renderNotificationPlanningModal();
  renderPasswordChangeModal();
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
    case "options":
      return renderProductOptionsManager();
    case "appearance":
      return renderAppearanceManager();
    case "notifications":
      return renderNotifications();
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
  const hasProducts = products.length > 0;

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
      ${
        hasProducts
          ? `
            <div class="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th><input type="checkbox" id="select-all-products" ${adminState.selectedProductIds.length === products.length ? "checked" : ""} /></th>
                    <th>Produto</th>
                    <th>Preço</th>
                    <th>Status</th>
                    <th>Flags</th>
                    <th>Atualizado</th>
                    <th>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  ${products
                    .map(
                      (product) => `
                        <tr>
                          <td>
                            <input type="checkbox" data-select-product="${escapeHtml(product.id)}" ${adminState.selectedProductIds.includes(product.id) ? "checked" : ""} />
                          </td>
                          <td>
                            <div class="product-line">
                              <img class="product-thumb" src="${escapeHtml(getPrimaryImage(product))}" alt="${escapeHtml(product.name)}" loading="lazy" decoding="async" />
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
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : `
            <div class="empty-card empty-card--standalone">
              <span class="section-kicker">Catálogo vazio</span>
              <h2>Nenhum produto encontrado</h2>
              <p>Revise os filtros ou crie seu primeiro item agora.</p>
            </div>
          `
      }
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
              ${getManualSectionProductOptions()
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

function renderProductOptionsManager() {
  const groupDraft = adminState.editingOptionGroup || createEmptyOptionGroupDraft();
  const valueDraft = adminState.editingOptionValue || createEmptyOptionValueDraft();
  const groups = getSortedProductOptionGroups();
  const values = getSortedProductOptionValues();

  return `
    <section class="manager-grid options-manager-grid">
      <article class="panel-card">
        <span class="section-kicker">Catálogo guiado</span>
        <h2>Características e variações</h2>
        <p class="muted-copy">Cadastre grupos e valores para o gerente selecionar no produto, sem editar JSON cru.</p>
        <div class="mobile-quick-actions">
          <button class="btn btn-primary" type="button" data-scroll-to-quick-form="option-group-form">Novo grupo</button>
          <button class="btn btn-secondary" type="button" data-scroll-to-quick-form="option-value-form">Novo valor</button>
        </div>
        <div class="option-summary-grid">
          <article><strong>${groups.filter((item) => item.type === "attribute").length}</strong><span>Características</span></article>
          <article><strong>${groups.filter((item) => item.type === "variant").length}</strong><span>Variações</span></article>
          <article><strong>${values.length}</strong><span>Valores</span></article>
        </div>
        <div class="list-stack">
          ${groups.length ? groups.map(renderProductOptionGroupItem).join("") : `<p class="muted-copy">Nenhum grupo cadastrado ainda. Comece por Movimento, Pulseira, Cor ou Resistência à água.</p>`}
        </div>
      </article>

      <article class="panel-card">
        <span class="section-kicker">Grupo</span>
        <h2>${groupDraft.id ? "Editar grupo" : "Novo grupo"}</h2>
        <form id="option-group-form" class="grid-form">
          <input type="hidden" name="id" value="${escapeHtml(groupDraft.id || "")}" />
          <div class="inline-grid inline-grid--2">
            <label class="admin-field"><span>Tipo</span><select name="type">${renderOptions([{ value: "attribute", label: "Característica" }, { value: "variant", label: "Variação" }], groupDraft.type || "attribute")}</select></label>
            <label class="admin-field"><span>Formato</span><select name="input_type">${renderOptions([{ value: "select", label: "Seleção única" }, { value: "multi_select", label: "Múltipla seleção" }, { value: "text", label: "Texto livre" }], groupDraft.input_type || "select")}</select></label>
          </div>
          <label class="admin-field"><span>Nome</span><input type="text" name="name" value="${escapeHtml(groupDraft.name || "")}" required /></label>
          <label class="admin-field"><span>Slug</span><input type="text" name="slug" value="${escapeHtml(groupDraft.slug || "")}" /></label>
          <label class="admin-field"><span>Descrição</span><textarea name="description">${escapeHtml(groupDraft.description || "")}</textarea></label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field"><span>Ordem</span><input type="number" name="sort_order" value="${escapeHtml(groupDraft.sort_order ?? 0)}" /></label>
            <label class="admin-field admin-field--switch"><span>Grupo ativo</span><input type="checkbox" name="is_active" ${groupDraft.is_active !== false ? "checked" : ""} /></label>
          </div>
          <div class="option-switch-list">
            <label class="admin-field admin-field--switch"><span>Mostrar no produto</span><input type="checkbox" name="show_on_product" ${groupDraft.show_on_product !== false ? "checked" : ""} /></label>
            <label class="admin-field admin-field--switch"><span>Permitir valor livre</span><input type="checkbox" name="allow_custom_value" ${groupDraft.allow_custom_value ? "checked" : ""} /></label>
            <label class="admin-field admin-field--switch"><span>Virar filtro no futuro</span><input type="checkbox" name="use_as_filter" ${groupDraft.use_as_filter ? "checked" : ""} /></label>
            <label class="admin-field admin-field--switch"><span>Obrigatório</span><input type="checkbox" name="is_required" ${groupDraft.is_required ? "checked" : ""} /></label>
          </div>
          <div class="toolbar-actions">
            <button class="btn btn-primary" type="submit">Salvar grupo</button>
            <button class="btn btn-secondary" type="button" id="reset-option-group-form">Novo</button>
          </div>
        </form>
      </article>

      <article class="panel-card">
        <span class="section-kicker">Valores</span>
        <h2>Valores disponíveis</h2>
        <div class="list-stack">${values.length ? values.map(renderProductOptionValueItem).join("") : `<p class="muted-copy">Nenhum valor cadastrado ainda.</p>`}</div>
      </article>

      <article class="panel-card">
        <span class="section-kicker">Valor</span>
        <h2>${valueDraft.id ? "Editar valor" : "Novo valor"}</h2>
        <form id="option-value-form" class="grid-form">
          <input type="hidden" name="id" value="${escapeHtml(valueDraft.id || "")}" />
          <label class="admin-field"><span>Grupo</span><select name="group_id" required>${renderProductOptionGroupOptions(valueDraft.group_id || groups[0]?.id || "")}</select></label>
          <label class="admin-field"><span>Rótulo</span><input type="text" name="label" value="${escapeHtml(valueDraft.label || "")}" required /></label>
          <label class="admin-field"><span>Valor técnico</span><input type="text" name="value" value="${escapeHtml(valueDraft.value || "")}" /></label>
          <label class="admin-field"><span>Descrição</span><textarea name="description">${escapeHtml(valueDraft.description || "")}</textarea></label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field"><span>Ordem</span><input type="number" name="sort_order" value="${escapeHtml(valueDraft.sort_order ?? 0)}" /></label>
            <label class="admin-field admin-field--switch"><span>Valor ativo</span><input type="checkbox" name="is_active" ${valueDraft.is_active !== false ? "checked" : ""} /></label>
          </div>
          <div class="toolbar-actions">
            <button class="btn btn-primary" type="submit">Salvar valor</button>
            <button class="btn btn-secondary" type="button" id="reset-option-value-form">Novo</button>
          </div>
        </form>
      </article>
    </section>
  `;
}

function renderProductOptionGroupItem(group) {
  const values = getSortedProductOptionValues(group.id);
  return `
    <article class="list-item option-list-item">
      <div class="list-item-header">
        <div>
          <strong class="list-item-title">${escapeHtml(group.name)}</strong>
          <span class="list-item-subtitle">${getProductOptionTypeLabel(group.type)} · ${escapeHtml(group.slug)} · ${values.length} valor(es)</span>
        </div>
        <span class="badge ${group.is_active ? "badge--success" : "badge--muted"}">${group.is_active ? "Ativo" : "Oculto"}</span>
      </div>
      <p class="muted-copy">${escapeHtml(group.description || (group.type === "attribute" ? "Característica do produto." : "Variação selecionável do produto."))}</p>
      <div class="tag-list">
        ${values.slice(0, 8).map((value) => `<span class="badge badge--muted">${escapeHtml(value.label)}</span>`).join("")}
        ${values.length > 8 ? `<span class="badge badge--muted">+${values.length - 8}</span>` : ""}
      </div>
      <div class="list-item-footer">
        <button class="btn btn-secondary" type="button" data-edit-option-group="${escapeHtml(group.id)}">Editar</button>
        <button class="btn btn-danger" type="button" data-disable-option-group="${escapeHtml(group.id)}">Desativar</button>
      </div>
    </article>
  `;
}

function renderProductOptionValueItem(value) {
  const group = getProductOptionGroup(value.group_id);
  return `
    <article class="list-item option-list-item">
      <div class="list-item-header">
        <div>
          <strong class="list-item-title">${escapeHtml(value.label)}</strong>
          <span class="list-item-subtitle">${escapeHtml(group?.name || "Grupo removido")} · ${escapeHtml(value.value)}</span>
        </div>
        <span class="badge ${value.is_active ? "badge--success" : "badge--muted"}">${value.is_active ? "Ativo" : "Oculto"}</span>
      </div>
      <div class="list-item-footer">
        <button class="btn btn-secondary" type="button" data-edit-option-value="${escapeHtml(value.id)}">Editar</button>
        <button class="btn btn-danger" type="button" data-disable-option-value="${escapeHtml(value.id)}">Desativar</button>
      </div>
    </article>
  `;
}

function renderProductOptionGroupOptions(selectedId = "") {
  const groups = getSortedProductOptionGroups();
  if (!groups.length) return `<option value="">Crie um grupo primeiro</option>`;
  return groups
    .map((group) => `<option value="${escapeHtml(group.id)}" ${group.id === selectedId ? "selected" : ""}>${escapeHtml(getProductOptionTypeLabel(group.type))}: ${escapeHtml(group.name)}</option>`)
    .join("");
}

function renderCategoriesManager() {
  const category = adminState.editingCategory || createEmptyCategoryDraft();

  return `
    <section class="manager-grid">
      <article class="panel-card">
        <span class="section-kicker">Organização</span>
        <h2>Categorias</h2>
        <div class="mobile-quick-actions">
          <button class="btn btn-primary" type="button" data-scroll-to-quick-form="category-form">Nova categoria</button>
        </div>
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
        <div class="mobile-quick-actions">
          <button class="btn btn-primary" type="button" data-scroll-to-quick-form="brand-form">Nova marca</button>
        </div>
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
              <img src="${escapeHtml(previewBanner?.image_url || adminState.store.logo_url || "./assets/placeholders/product-placeholder.svg")}" alt="Prévia do banner" decoding="async" />
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
  const recentNotifications = getRegularNotifications().slice(0, 5);
  const scheduledNotifications = getScheduledNotifications();
  const recurringNotifications = getRecurringNotifications();
  const editingNotification = adminState.editingNotificationId
    ? adminState.notifications.find((item) => item.id === adminState.editingNotificationId)
    : null;
  const titleValue = editingNotification?.title || "";
  const bodyValue = editingNotification?.body || "";
  const targetValue = editingNotification?.target_url || "";
  const scheduledValue = toDateTimeLocalValue(editingNotification?.scheduled_at || "");
  const recurrenceValue = editingNotification?.recurrence_rule || "";
  const submitLabel = scheduledValue || recurrenceValue ? "Agendar" : editingNotification ? "Atualizar rascunho" : "Salvar rascunho";
  return `
    <section class="settings-grid">
      <article class="panel-card">
        <span class="section-kicker">Push notifications</span>
        <h2>${editingNotification ? "Editar notificação" : "Criar notificação"}</h2>
        <p>${adminState.settings?.enable_notifications ? "O recurso está habilitado para a loja." : "As notificações estão desativadas na configuração pública da loja."}</p>
        <form id="notification-form" class="notification-form">
          <label class="admin-field">
            <span>Título</span>
            <input type="text" name="title" required placeholder="Novidades na vitrine" value="${escapeHtml(titleValue)}" />
          </label>
          <label class="admin-field">
            <span>Mensagem</span>
            <textarea name="body" required placeholder="Confira os itens que acabaram de entrar.">${escapeHtml(bodyValue)}</textarea>
          </label>
          <label class="admin-field">
            <span>URL alvo</span>
            <input type="text" name="target_url" list="notification-target-options" placeholder="URL completa, ./index.html ou seção da vitrine" value="${escapeHtml(targetValue)}" />
            <datalist id="notification-target-options">
              ${targetOptions
                .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
                .join("")}
            </datalist>
            <p class="muted-copy">Deixe em branco para abrir a página inicial. As seções abaixo são carregadas da vitrine atual.</p>
          </label>
          <div class="inline-grid inline-grid--2">
            <label class="admin-field">
              <span>Agendar envio</span>
              <input type="datetime-local" name="scheduled_at" value="${escapeHtml(scheduledValue)}" />
            </label>
            <label class="admin-field">
              <span>Recorrência</span>
              <select name="recurrence_rule">
                <option value="" ${recurrenceValue ? "" : "selected"}>Não repetir</option>
                <option value="daily" ${recurrenceValue === "daily" ? "selected" : ""}>Diariamente</option>
                <option value="weekly" ${recurrenceValue === "weekly" ? "selected" : ""}>Semanalmente</option>
                <option value="monthly" ${recurrenceValue === "monthly" ? "selected" : ""}>Mensalmente</option>
              </select>
            </label>
          </div>
          <p class="muted-copy">Sem agendamento, a notificação fica em rascunho para envio manual. Com recorrência, ela reaparece em Agendadas após cada disparo.</p>
          <div class="notification-actions">
            <button class="btn btn-primary" type="submit" id="notification-submit-button">${escapeHtml(submitLabel)}</button>
            ${
              editingNotification
                ? `<button class="btn btn-secondary" type="button" id="cancel-notification-edit">Cancelar edição</button>`
                : ""
            }
          </div>
        </form>
      </article>

      <article class="panel-card notification-side-card">
        <div class="notification-side-summary">
          <span class="section-kicker">Base instalada</span>
          <div class="notification-install-base">
            <strong>${adminState.pushSummary.count}</strong>
            <span>dispositivo(s) inscrito(s)</span>
          </div>
          <p>Dispositivos aptos a receber novidades.</p>
        </div>
        <div class="notification-planning-grid">
          ${renderNotificationBucket("Agendadas", scheduledNotifications, "Nenhum envio agendado.", "scheduled")}
          ${renderNotificationBucket("Recorrentes", recurringNotifications, "Nenhuma recorrência ativa.", "recurring")}
        </div>
      </article>

      <article class="panel-card">
        <div class="section-card__header">
          <div>
            <span class="section-kicker">Histórico recente</span>
            <h2>${adminState.notifications.length} notificação(ões)</h2>
          </div>
          <button class="btn btn-secondary" type="button" id="open-notification-history">Mostrar todos</button>
        </div>
        <div class="list-stack">
          ${recentNotifications.length
            ? recentNotifications.map((item) => renderNotificationListItem(item)).join("")
            : `<article class="list-item"><span class="list-item-subtitle">Nenhuma notificação criada ainda.</span></article>`}
        </div>
      </article>

    </section>
  `;
}

function renderNotificationBucket(title, items, emptyMessage, type) {
  return `
    <div class="notification-bucket">
      <div class="notification-bucket__header">
        <strong>${escapeHtml(title)}</strong>
        <div class="notification-bucket__actions">
          <span class="badge badge--muted">${items.length}</span>
          ${
            items.length > 3
              ? `<button class="btn btn-secondary btn-sm" type="button" data-open-planning-modal="${escapeHtml(type)}">Mostrar todos</button>`
              : ""
          }
        </div>
      </div>
      <div class="list-stack">
        ${items.length
          ? items.slice(0, 3).map((item) => renderNotificationListItem(item, { compact: true })).join("")
          : `<article class="list-item"><span class="list-item-subtitle">${escapeHtml(emptyMessage)}</span></article>`}
      </div>
    </div>
  `;
}

function renderNotificationListItem(item, options = {}) {
  const target = item.target_url ? `Destino: ${item.target_url}` : "Sem destino";
  const sentAt = item.sent_at ? `Enviada em ${formatDateTime(item.sent_at, adminState.settings?.locale || "pt-BR")}` : "";
  const scheduledAt = item.scheduled_at ? `Agendada para ${formatDateTime(item.scheduled_at, adminState.settings?.locale || "pt-BR")}` : "";
  const recurrence = item.recurrence_rule ? `Recorrência: ${getNotificationRecurrenceLabel(item.recurrence_rule)}` : "";
  const meta = [target, scheduledAt || sentAt, recurrence].filter(Boolean).join(" · ");
  const canEdit = ["draft", "scheduled", "failed"].includes(item.status);
  const canCancelSchedule = Boolean(item.scheduled_at && !item.recurrence_rule && item.status === "scheduled");
  const canStopRecurrence = Boolean(item.recurrence_rule);
  const isSent = item.status === "sent";
  const sendActionLabel = isSent ? "Reenviar" : "Enviar agora";

  return `
    <article class="list-item ${options.compact ? "list-item--compact" : ""}">
      <div class="list-item-header">
        <div>
          <strong class="list-item-title">${escapeHtml(item.title)}</strong>
          <span class="list-item-subtitle">${escapeHtml(item.body)}</span>
          ${meta ? `<small class="list-item-subtitle">${escapeHtml(meta)}</small>` : ""}
        </div>
        <span class="badge ${getNotificationStatusClass(item.status)}">${escapeHtml(getNotificationStatusLabel(item.status))}</span>
      </div>
      <div class="list-item-footer">
        ${
          canEdit
            ? `<button class="btn btn-secondary" type="button" data-edit-notification="${escapeHtml(item.id)}">Editar</button>`
            : ""
        }
        ${
          canStopRecurrence
            ? `<button class="btn btn-secondary" type="button" data-stop-recurrence="${escapeHtml(item.id)}">Encerrar recorrência</button>`
            : ""
        }
        ${
          canCancelSchedule
            ? `<button class="btn btn-secondary" type="button" data-cancel-schedule="${escapeHtml(item.id)}">Cancelar agendamento</button>`
            : ""
        }
        <button class="btn btn-secondary" type="button" data-send-notification="${escapeHtml(item.id)}" data-send-notification-status="${escapeHtml(item.status || "draft")}">${escapeHtml(sendActionLabel)}</button>
      </div>
    </article>
  `;
}

function getNotificationStatusLabel(status) {
  const labels = {
    draft: "Rascunho",
    scheduled: "Agendada",
    sent: "Enviada",
    failed: "Falhou"
  };
  return labels[status] || "Rascunho";
}

function getNotificationRecurrenceLabel(rule) {
  const labels = {
    daily: "diária",
    weekly: "semanal",
    monthly: "mensal"
  };
  return labels[rule] || rule;
}

function getNotificationStatusClass(status) {
  if (status === "sent") return "badge--success";
  if (status === "draft" || status === "scheduled") return "badge--muted";
  if (status === "failed") return "badge--warning";
  return "badge--muted";
}

function getScheduledNotifications() {
  return adminState.notifications.filter((item) => item.scheduled_at && !item.recurrence_rule && item.status !== "sent");
}

function getRecurringNotifications() {
  return adminState.notifications.filter((item) => item.recurrence_rule || item.recurrence_interval || item.is_recurring);
}

function getRegularNotifications() {
  return adminState.notifications.filter(
    (item) => !getScheduledNotifications().includes(item) && !getRecurringNotifications().includes(item)
  );
}

function toDateTimeLocalValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function renderNotificationHistoryModal() {
  let root = qs("#admin-notification-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "admin-notification-modal-root";
    document.body.appendChild(root);
  }

  if (!adminState.isNotificationHistoryOpen) {
    root.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(adminState.notifications.length / NOTIFICATION_PAGE_SIZE));
  adminState.notificationHistoryPage = Math.min(Math.max(adminState.notificationHistoryPage, 1), totalPages);
  const start = (adminState.notificationHistoryPage - 1) * NOTIFICATION_PAGE_SIZE;
  const pageItems = adminState.notifications.slice(start, start + NOTIFICATION_PAGE_SIZE);

  root.innerHTML = `
    <div class="editor-backdrop" id="notification-history-backdrop"></div>
    <section class="editor-shell admin-modal-shell notification-history-shell" role="dialog" aria-modal="true" aria-labelledby="notification-history-title">
      <header class="editor-header">
        <div>
          <span class="section-kicker">Histórico completo</span>
          <h2 id="notification-history-title">Notificações</h2>
          <p class="muted-copy">${adminState.notifications.length} registro(s), ${NOTIFICATION_PAGE_SIZE} por página.</p>
        </div>
        <button class="modal-close-button" type="button" id="close-notification-history" aria-label="Fechar histórico de notificações">×</button>
      </header>
      <div class="editor-body">
        <div class="list-stack">
          ${pageItems.length
            ? pageItems.map((item) => renderNotificationListItem(item)).join("")
            : `<article class="list-item"><span class="list-item-subtitle">Nenhuma notificação encontrada.</span></article>`}
        </div>
      </div>
      <footer class="editor-footer notification-pagination">
        <button class="btn btn-secondary" type="button" data-notification-page="${adminState.notificationHistoryPage - 1}" ${adminState.notificationHistoryPage <= 1 ? "disabled" : ""}>‹</button>
        <div class="notification-pagination__pages">
          ${Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            return `<button class="btn ${page === adminState.notificationHistoryPage ? "btn-primary" : "btn-secondary"}" type="button" data-notification-page="${page}">${page}</button>`;
          }).join("")}
        </div>
        <button class="btn btn-secondary" type="button" data-notification-page="${adminState.notificationHistoryPage + 1}" ${adminState.notificationHistoryPage >= totalPages ? "disabled" : ""}>›</button>
      </footer>
    </section>
  `;

  bindNotificationHistoryModal();
}

function renderNotificationPlanningModal() {
  let root = qs("#admin-notification-planning-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "admin-notification-planning-modal-root";
    document.body.appendChild(root);
  }

  if (!adminState.notificationPlanningModalType) {
    root.innerHTML = "";
    return;
  }

  const isRecurring = adminState.notificationPlanningModalType === "recurring";
  const items = isRecurring ? getRecurringNotifications() : getScheduledNotifications();
  const title = isRecurring ? "Notificações recorrentes" : "Notificações agendadas";
  const kicker = isRecurring ? "Recorrentes" : "Agendadas";
  const emptyMessage = isRecurring ? "Nenhuma recorrência ativa." : "Nenhum envio agendado.";
  const totalPages = Math.max(1, Math.ceil(items.length / NOTIFICATION_PAGE_SIZE));
  adminState.notificationPlanningPage = Math.min(Math.max(adminState.notificationPlanningPage, 1), totalPages);
  const start = (adminState.notificationPlanningPage - 1) * NOTIFICATION_PAGE_SIZE;
  const pageItems = items.slice(start, start + NOTIFICATION_PAGE_SIZE);

  root.innerHTML = `
    <div class="editor-backdrop" id="notification-planning-backdrop"></div>
    <section class="editor-shell admin-modal-shell notification-history-shell" role="dialog" aria-modal="true" aria-labelledby="notification-planning-title">
      <header class="editor-header">
        <div>
          <span class="section-kicker">${escapeHtml(kicker)}</span>
          <h2 id="notification-planning-title">${escapeHtml(title)}</h2>
          <p class="muted-copy">${items.length} registro(s), ${NOTIFICATION_PAGE_SIZE} por página.</p>
        </div>
        <button class="modal-close-button" type="button" id="close-notification-planning" aria-label="Fechar lista de notificações">×</button>
      </header>
      <div class="editor-body">
        <div class="list-stack">
          ${pageItems.length
            ? pageItems.map((item) => renderNotificationListItem(item)).join("")
            : `<article class="list-item"><span class="list-item-subtitle">${escapeHtml(emptyMessage)}</span></article>`}
        </div>
      </div>
      <footer class="editor-footer notification-pagination">
        <button class="btn btn-secondary" type="button" data-planning-page="${adminState.notificationPlanningPage - 1}" ${adminState.notificationPlanningPage <= 1 ? "disabled" : ""}>‹</button>
        <div class="notification-pagination__pages">
          ${Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            return `<button class="btn ${page === adminState.notificationPlanningPage ? "btn-primary" : "btn-secondary"}" type="button" data-planning-page="${page}">${page}</button>`;
          }).join("")}
        </div>
        <button class="btn btn-secondary" type="button" data-planning-page="${adminState.notificationPlanningPage + 1}" ${adminState.notificationPlanningPage >= totalPages ? "disabled" : ""}>›</button>
      </footer>
    </section>
  `;

  bindNotificationPlanningModal();
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
      <p>A prévia fica estável enquanto você trabalha. Ela é atualizada por evento após alterações relevantes ou manualmente, sem polling e sem recriar o iframe em cada render.</p>
      <div class="preview-actions">
        <button class="btn btn-secondary" type="button" id="reload-preview-iframe">Atualizar prévia</button>
        <button class="btn btn-primary" type="button" id="open-preview-external-inline">Abrir em nova aba</button>
      </div>
      <p class="muted-copy" id="preview-status" aria-live="polite">Prévia sincronizada.</p>
      <iframe class="preview-frame" src="./index.html?embedded_preview=1" loading="lazy" title="Prévia do site público"></iframe>
    </section>
  `;
}

function syncPreviewStatus(message = null) {
  const status = qs("#preview-status");
  if (!status) return;
  status.textContent = message || (adminState.previewNeedsRefresh ? "Há alterações aguardando atualização da prévia." : "Prévia sincronizada.");
}

function refreshPreviewFrame({ hardReload = false } = {}) {
  const previewFrame = qs(".preview-frame");
  if (!previewFrame) {
    adminState.previewNeedsRefresh = true;
    adminState.previewReady = false;
    return;
  }

  window.clearTimeout(adminState.previewRefreshTimer);
  adminState.previewNeedsRefresh = true;

  if (hardReload) {
    adminState.previewReady = false;
    syncPreviewStatus("Recarregando prévia…");
    previewFrame.src = `./index.html?embedded_preview=1&t=${Date.now()}`;
    return;
  }

  if (!adminState.previewReady || !previewFrame.contentWindow) {
    syncPreviewStatus("Aguardando a prévia inicializar…");
    return;
  }

  syncPreviewStatus("Atualizando prévia…");
  previewFrame.contentWindow.postMessage({ type: "vitrinezap:refresh" }, window.location.origin);
  adminState.previewRefreshTimer = window.setTimeout(() => {
    if (adminState.previewNeedsRefresh) refreshPreviewFrame({ hardReload: true });
  }, 5000);
}

function notifyStorefrontChanged(reason = "admin-save") {
  invalidateStorefrontCache(adminState.store?.slug || APP_CONFIG.STORE_SLUG);
  adminState.previewNeedsRefresh = true;

  window.clearTimeout(adminState.previewRefreshTimer);
  if (adminState.currentAdminTab !== "preview" || !qs(".preview-frame")) return;

  adminState.previewRefreshTimer = window.setTimeout(() => {
    refreshPreviewFrame();
  }, 500);
}

function handlePreviewBridgeMessage(event) {
  if (event.origin !== window.location.origin) return;

  if (event.data?.type === "vitrinezap:preview-ready") {
    adminState.previewReady = true;
    if (adminState.previewNeedsRefresh) {
      refreshPreviewFrame();
    } else {
      syncPreviewStatus("Prévia pronta.");
    }
    return;
  }

  if (event.data?.type !== "vitrinezap:preview-refreshed") return;
  window.clearTimeout(adminState.previewRefreshTimer);
  adminState.previewNeedsRefresh = false;
  adminState.previewReady = true;
  syncPreviewStatus("Prévia atualizada com os dados mais recentes.");
}
function openPasswordChangeModal() {
  adminState.isPasswordChangeOpen = true;
  renderPasswordChangeModal();
}

function closePasswordChangeModal() {
  adminState.isPasswordChangeOpen = false;
  renderPasswordChangeModal();
}

function renderPasswordChangeModal() {
  let root = qs("#admin-password-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "admin-password-modal-root";
    document.body.appendChild(root);
  }

  if (!adminState.isPasswordChangeOpen) {
    root.innerHTML = "";
    setAdminModalOpen("password-change", false);
    return;
  }

  setAdminModalOpen("password-change", true);
  const accountEmail = adminState.session?.user?.email || "usuário atual";

  root.innerHTML = `
    <div class="editor-backdrop" id="password-change-backdrop"></div>
    <section class="editor-shell admin-modal-shell password-change-shell" role="dialog" aria-modal="true" aria-labelledby="password-change-title">
      <header class="editor-header">
        <div>
          <span class="section-kicker">Segurança da conta</span>
          <h2 id="password-change-title">Alterar senha</h2>
          <p class="muted-copy">Conta: ${escapeHtml(accountEmail)}</p>
        </div>
        <button class="modal-close-button" type="button" id="close-password-change" aria-label="Fechar alteração de senha">×</button>
      </header>
      <form id="password-change-form" class="panel-form">
        <input class="visually-hidden" type="email" name="username" autocomplete="username" value="${escapeHtml(accountEmail)}" tabindex="-1" aria-hidden="true" readonly />
        <label class="admin-field">
          <span>Nova senha</span>
          <input type="password" name="password" required minlength="${PASSWORD_MIN_LENGTH}" autocomplete="new-password" placeholder="Mínimo de ${PASSWORD_MIN_LENGTH} caracteres" />
        </label>
        <label class="admin-field">
          <span>Confirmar nova senha</span>
          <input type="password" name="confirmPassword" required minlength="${PASSWORD_MIN_LENGTH}" autocomplete="new-password" placeholder="Repita a nova senha" />
        </label>
        <p class="muted-copy password-requirements">A alteração vale para o próximo login deste usuário. Use uma senha forte e não reutilizada.</p>
        <div class="editor-footer-actions">
          <button class="btn btn-secondary" type="button" id="cancel-password-change">Cancelar</button>
          <button class="btn btn-primary" type="submit">Salvar senha</button>
        </div>
      </form>
    </section>
  `;

  qs("#password-change-backdrop")?.addEventListener("click", closePasswordChangeModal);
  qs("#close-password-change")?.addEventListener("click", closePasswordChangeModal);
  qs("#cancel-password-change")?.addEventListener("click", closePasswordChangeModal);
  qs("#password-change-form")?.addEventListener("submit", handlePasswordChangeSubmit);
  qs("#password-change-form input[name='password']")?.focus();
}

async function handlePasswordChangeSubmit(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type='submit']");
  button.disabled = true;

  try {
    await updateAccountPasswordFromForm(form);
    closePasswordChangeModal();
    showToast("Senha alterada com sucesso.", "success");
  } catch (error) {
    if (!isPasswordValidationError(error)) console.error(error);
    showToast(error.message || "Não foi possível alterar a senha.", "danger");
  } finally {
    if (button.isConnected) button.disabled = false;
  }
}

function bindAdminLayoutEvents() {
  qsa("[data-admin-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      clearAdminFormDirty();
      adminState.pendingBackgroundRender = false;
      adminState.currentAdminTab = button.dataset.adminTab;
      renderAdminLayout();
      scrollAdminMainToTop();
    });
  });

  qs("#sign-out-button")?.addEventListener("click", handleLogout);
  qs("#change-password-button")?.addEventListener("click", openPasswordChangeModal);
  qs("#quick-new-product")?.addEventListener("click", () => openProductEditor());
  qs("#open-preview-tab")?.addEventListener("click", () => window.open("./index.html", "_blank", "noopener"));
  bindMobileAdminActions();
  bindMobileAdminChrome();
  qs("#dashboard-add-product")?.addEventListener("click", () => openProductEditor());
  qs("#reload-preview-iframe")?.addEventListener("click", () => refreshPreviewFrame());
  qs("#open-preview-external-inline")?.addEventListener("click", () => window.open("./index.html", "_blank", "noopener"));
  syncPreviewStatus();

  qsa("[data-go-tab]").forEach((button) =>
    button.addEventListener("click", () => {
      clearAdminFormDirty();
      adminState.pendingBackgroundRender = false;
      adminState.currentAdminTab = button.dataset.goTab;
      renderAdminLayout();
      scrollAdminMainToTop();
    })
  );

  bindProductsTab();
  bindSectionTab();
  bindCategoryTab();
  bindBrandTab();
  bindProductOptionsTab();
  bindAppearanceTab();
  bindNotificationsTab();
  bindSettingsTab();
  bindQuickFormScrollActions();
}

function bindMobileAdminActions() {
  qsa("[data-mobile-admin-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.mobileAdminAction;
      if (action === "new-product") {
        openProductEditor();
        return;
      }
      if (action === "open-site") {
        window.open("./index.html", "_blank", "noopener");
        return;
      }
      if (action === "password") {
        openPasswordChangeModal();
        return;
      }
      if (action === "logout") {
        handleLogout();
      }
    });
  });
}

function bindMobileAdminChrome() {
  const shell = qs(".admin-shell");
  if (!shell) return;

  if (window.__adminMobileChromeCleanup) {
    window.__adminMobileChromeCleanup();
  }

  const controller = new AbortController();
  const update = () => {
    const isMobileChrome = window.matchMedia("(max-width: 1119px)").matches;
    const shouldCondense = isMobileChrome && window.scrollY > 96;
    shell.classList.toggle("is-mobile-condensed", shouldCondense);
  };

  window.addEventListener("scroll", update, { passive: true, signal: controller.signal });
  window.addEventListener("resize", update, { signal: controller.signal });
  window.__adminMobileChromeCleanup = () => controller.abort();
  update();
}

function scrollAdminMainToTop() {
  const main = qs(".admin-main");
  window.requestAnimationFrame(() => {
    if (main && typeof main.scrollTo === "function") {
      main.scrollTo({ top: 0, behavior: "auto" });
    }
    window.scrollTo({ top: 0, behavior: "auto" });
  });
}

function bindQuickFormScrollActions() {
  qsa("[data-scroll-to-quick-form]").forEach((button) =>
    button.addEventListener("click", () => {
      const target = qs(`#${button.dataset.scrollToQuickForm}`);
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      const firstInput = target.querySelector("input:not([type='hidden']), textarea, select");
      window.setTimeout(() => firstInput?.focus(), 240);
    })
  );
}

function hasActiveProductFilters() {
  return Object.values(adminState.productFilters || {}).some(Boolean);
}

function findProductById(productId) {
  return (
    adminState.products.find((product) => product.id === productId) ||
    adminState.filteredProducts.find((product) => product.id === productId) ||
    null
  );
}

function getManualSectionProductOptions() {
  return [...adminState.products].sort((left, right) =>
    String(left.name || "").localeCompare(String(right.name || ""), adminState.settings?.locale || "pt-BR")
  );
}

function buildDuplicatedSku(sourceSku) {
  const normalized = String(sourceSku || "").trim();
  if (!normalized) return "";
  const suffix = String(Date.now()).slice(-6);
  return `${normalized}-COPY-${suffix}`.slice(0, 64);
}

function productMatchesAdminFilters(product, filters = {}) {
  const search = String(filters.search || "").trim().toLowerCase();
  const productName = String(product.name || "").toLowerCase();
  if (search && !productName.includes(search)) return false;

  if (filters.status === "active" && (!product.is_active || product.is_archived)) return false;
  if (filters.status === "inactive" && (product.is_active || product.is_archived)) return false;
  if (filters.status === "archived" && !product.is_archived) return false;
  if (filters.categoryId && product.category_id !== filters.categoryId) return false;
  if (filters.brandId && product.brand_id !== filters.brandId) return false;

  return true;
}

function prependUniqueProductState(product) {
  if (!product?.id) return;
  adminState.products = [product, ...adminState.products.filter((item) => item.id !== product.id)];
  if (productMatchesAdminFilters(product, adminState.productFilters)) {
    adminState.filteredProducts = [product, ...adminState.filteredProducts.filter((item) => item.id !== product.id)];
  }
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

function bindProductOptionsTab() {
  bindDirtyFormState("#option-group-form", "options");
  bindDirtyFormState("#option-value-form", "options");

  qs("#option-group-form")?.addEventListener("submit", saveProductOptionGroup);
  qs("#option-value-form")?.addEventListener("submit", saveProductOptionValue);

  qs("#reset-option-group-form")?.addEventListener("click", () => {
    clearAdminFormDirty("options");
    adminState.editingOptionGroup = createEmptyOptionGroupDraft();
    renderAdminLayout();
  });

  qs("#reset-option-value-form")?.addEventListener("click", () => {
    clearAdminFormDirty("options");
    adminState.editingOptionValue = createEmptyOptionValueDraft();
    renderAdminLayout();
  });

  qs("#option-group-form [name='name']")?.addEventListener("input", (event) => {
    const slugInput = qs("#option-group-form [name='slug']");
    if (slugInput && !slugInput.value.trim()) slugInput.value = slugify(event.currentTarget.value);
  });

  qs("#option-value-form [name='label']")?.addEventListener("input", (event) => {
    const valueInput = qs("#option-value-form [name='value']");
    if (valueInput && !valueInput.value.trim()) valueInput.value = slugify(event.currentTarget.value);
  });

  qsa("[data-edit-option-group]").forEach((button) =>
    button.addEventListener("click", () => {
      clearAdminFormDirty("options");
      adminState.editingOptionGroup = structuredClone(getProductOptionGroup(button.dataset.editOptionGroup) || createEmptyOptionGroupDraft());
      renderAdminLayout();
      qs("#option-group-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );

  qsa("[data-edit-option-value]").forEach((button) =>
    button.addEventListener("click", () => {
      clearAdminFormDirty("options");
      adminState.editingOptionValue = structuredClone((adminState.productOptionValues || []).find((item) => item.id === button.dataset.editOptionValue) || createEmptyOptionValueDraft());
      renderAdminLayout();
      qs("#option-value-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    })
  );

  qsa("[data-disable-option-group]").forEach((button) =>
    button.addEventListener("click", () => disableProductOptionGroup(button.dataset.disableOptionGroup))
  );

  qsa("[data-disable-option-value]").forEach((button) =>
    button.addEventListener("click", () => disableProductOptionValue(button.dataset.disableOptionValue))
  );
}

async function refreshProductOptionsData() {
  const [groups, values] = await Promise.all([
    adminListProductOptionGroups(adminState.store.id),
    adminListProductOptionValues(adminState.store.id)
  ]);
  adminState.productOptionGroups = groups || [];
  adminState.productOptionValues = values || [];
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
  const notificationForm = qs("#notification-form");
  bindDirtyFormState("#notification-form", "notifications");
  notificationForm?.addEventListener("submit", saveNotification);
  notificationForm?.addEventListener("input", updateNotificationSubmitLabel);
  notificationForm?.addEventListener("change", updateNotificationSubmitLabel);
  updateNotificationSubmitLabel();
  qs("#cancel-notification-edit")?.addEventListener("click", () => {
    clearAdminFormDirty("notifications");
    adminState.editingNotificationId = null;
    renderAdminLayout();
  });
  qs("#open-notification-history")?.addEventListener("click", () => {
    adminState.isNotificationHistoryOpen = true;
    adminState.notificationHistoryPage = 1;
    renderNotificationHistoryModal();
  });
  qsa("[data-open-planning-modal]").forEach((button) =>
    button.addEventListener("click", () => {
      adminState.notificationPlanningModalType = button.dataset.openPlanningModal;
      adminState.notificationPlanningPage = 1;
      renderNotificationPlanningModal();
    })
  );
  qsa("[data-edit-notification]").forEach((button) =>
    button.addEventListener("click", () => editNotification(button.dataset.editNotification))
  );
  qsa("[data-stop-recurrence]").forEach((button) =>
    button.addEventListener("click", () => stopNotificationRecurrence(button.dataset.stopRecurrence))
  );
  qsa("[data-cancel-schedule]").forEach((button) =>
    button.addEventListener("click", () => cancelNotificationSchedule(button.dataset.cancelSchedule))
  );
  qsa("[data-send-notification]").forEach((button) =>
    button.addEventListener("click", () => sendNotification(button.dataset.sendNotification))
  );
}

function updateNotificationSubmitLabel() {
  const form = qs("#notification-form");
  const button = qs("#notification-submit-button");
  if (!form || !button) return;

  const scheduledAt = parseDateTimeLocalValue(String(new FormData(form).get("scheduled_at") || ""));
  const recurrenceRule = String(new FormData(form).get("recurrence_rule") || "");
  if (scheduledAt || recurrenceRule) {
    button.textContent = "Agendar";
    return;
  }

  button.textContent = adminState.editingNotificationId ? "Atualizar rascunho" : "Salvar rascunho";
}

function editNotification(notificationId) {
  const notification = adminState.notifications.find((item) => item.id === notificationId);
  if (!notification) return;
  adminState.editingNotificationId = notificationId;
  renderAdminLayout();
  qs("#notification-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

function bindNotificationHistoryModal() {
  const close = () => {
    adminState.isNotificationHistoryOpen = false;
    renderNotificationHistoryModal();
  };

  qs("#notification-history-backdrop")?.addEventListener("click", close);
  qs("#close-notification-history")?.addEventListener("click", close);
  qsa("[data-notification-page]").forEach((button) =>
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.notificationPage);
      if (!Number.isFinite(nextPage)) return;
      adminState.notificationHistoryPage = nextPage;
      renderNotificationHistoryModal();
    })
  );
  qsa("#admin-notification-modal-root [data-send-notification]").forEach((button) =>
    button.addEventListener("click", () => sendNotification(button.dataset.sendNotification))
  );
  qsa("#admin-notification-modal-root [data-edit-notification]").forEach((button) =>
    button.addEventListener("click", () => {
      close();
      editNotification(button.dataset.editNotification);
    })
  );
  qsa("#admin-notification-modal-root [data-stop-recurrence]").forEach((button) =>
    button.addEventListener("click", async () => {
      await stopNotificationRecurrence(button.dataset.stopRecurrence);
      renderNotificationHistoryModal();
    })
  );
  qsa("#admin-notification-modal-root [data-cancel-schedule]").forEach((button) =>
    button.addEventListener("click", async () => {
      await cancelNotificationSchedule(button.dataset.cancelSchedule);
      renderNotificationHistoryModal();
    })
  );
}

function bindNotificationPlanningModal() {
  const close = () => {
    adminState.notificationPlanningModalType = "";
    renderNotificationPlanningModal();
  };

  qs("#notification-planning-backdrop")?.addEventListener("click", close);
  qs("#close-notification-planning")?.addEventListener("click", close);
  qsa("[data-planning-page]").forEach((button) =>
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.planningPage);
      if (!Number.isFinite(nextPage)) return;
      adminState.notificationPlanningPage = nextPage;
      renderNotificationPlanningModal();
    })
  );
  qsa("#admin-notification-planning-modal-root [data-send-notification]").forEach((button) =>
    button.addEventListener("click", () => sendNotification(button.dataset.sendNotification))
  );
  qsa("#admin-notification-planning-modal-root [data-edit-notification]").forEach((button) =>
    button.addEventListener("click", () => {
      close();
      editNotification(button.dataset.editNotification);
    })
  );
  qsa("#admin-notification-planning-modal-root [data-stop-recurrence]").forEach((button) =>
    button.addEventListener("click", async () => {
      await stopNotificationRecurrence(button.dataset.stopRecurrence);
      renderNotificationPlanningModal();
    })
  );
  qsa("#admin-notification-planning-modal-root [data-cancel-schedule]").forEach((button) =>
    button.addEventListener("click", async () => {
      await cancelNotificationSchedule(button.dataset.cancelSchedule);
      renderNotificationPlanningModal();
    })
  );
}

function bindSettingsTab() {
  bindDirtyFormState("#settings-form", "settings");
  qs("#settings-form")?.addEventListener("submit", saveSettings);
  mountBusinessHoursEditor();
  qs("#open-business-hours-editor")?.addEventListener("click", openBusinessHoursEditor);
}

async function refreshProducts() {
  const response = await adminListProducts(adminState.store.id, adminState.productFilters);
  adminState.filteredProducts = response.data || [];
  adminState.selectedProductIds = adminState.selectedProductIds.filter((id) =>
    adminState.filteredProducts.some((product) => product.id === id)
  );
  renderAdminLayout();
}

function getVisibleProducts() {
  const sectionId = adminState.productFilters.sectionId;
  const productSource = adminState.filteredProducts.length || hasActiveProductFilters() ? adminState.filteredProducts : adminState.products;
  if (!sectionId) return productSource;
  const productIds = (adminState.sections.find((section) => section.id === sectionId)?.section_products || []).map(
    (item) => item.product_id
  );
  return productSource.filter((product) => productIds.includes(product.id));
}

function openProductEditor(productId = null) {
  adminState.productEditorStep = 1;
  adminState.pendingProductFiles = [];
  adminState.productImageOperation = null;
  adminState.editingProduct = productId
    ? structuredClone(findProductById(productId))
    : createEmptyProductDraft();

  setAdminModalOpen("product-editor", true);
  renderProductEditor();
}

function getProductOptionTypeLabel(type) {
  return type === "variant" ? "Variação" : "Característica";
}

function getSortedProductOptionGroups(type = "") {
  return [...(adminState.productOptionGroups || [])]
    .filter((group) => !type || group.type === type)
    .sort(
      (left, right) =>
        (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
        String(left.name || "").localeCompare(String(right.name || ""), adminState.settings?.locale || "pt-BR")
    );
}

function getSortedProductOptionValues(groupId = "") {
  return [...(adminState.productOptionValues || [])]
    .filter((value) => !groupId || value.group_id === groupId)
    .sort(
      (left, right) =>
        (left.sort_order ?? 0) - (right.sort_order ?? 0) ||
        String(left.label || "").localeCompare(String(right.label || ""), adminState.settings?.locale || "pt-BR")
    );
}

function getProductOptionGroup(groupId) {
  return (adminState.productOptionGroups || []).find((group) => group.id === groupId) || null;
}

function getProductOptionValue(valueId) {
  return (adminState.productOptionValues || []).find((value) => value.id === valueId) || null;
}

function getActiveProductOptionGroups(type) {
  return getSortedProductOptionGroups(type).filter((group) => group.is_active !== false);
}

function getActiveProductOptionValues(groupId) {
  return getSortedProductOptionValues(groupId).filter((value) => value.is_active !== false);
}

function getSelectionLabel(selection) {
  const value = getProductOptionValue(selection.value_id) || selection.value;
  if (value?.label) return value.label;
  const custom = selection.custom_value;
  if (custom && typeof custom === "object") return custom.label || custom.value || "";
  if (custom) return String(custom);
  return "";
}

function getDraftOptionSelections(draft, groupId = "") {
  return [...(draft.option_selections || [])].filter((selection) => !groupId || selection.group_id === groupId);
}

function renderProductOptionPicker(type, draft) {
  const groups = getActiveProductOptionGroups(type);
  const title = type === "variant" ? "Variações" : "Características";
  const description =
    type === "variant"
      ? "Escolha opções comerciais simples, sem controlar SKU/estoque por variação nesta fase."
      : "Monte a ficha do produto com valores cadastrados, sem digitar JSON.";

  if (!groups.length) {
    return `
      <section class="product-option-picker">
        <div>
          <strong>${title}</strong>
          <p class="muted-copy">Nenhum grupo ativo cadastrado. Use a aba Opções para criar grupos e valores.</p>
        </div>
      </section>
    `;
  }

  return `
    <section class="product-option-picker">
      <div>
        <strong>${title}</strong>
        <p class="muted-copy">${description}</p>
      </div>
      <div class="product-option-field-list">
        ${groups.map((group) => renderProductOptionField(group, draft)).join("")}
      </div>
    </section>
  `;
}

function renderProductOptionField(group, draft) {
  const selected = getDraftOptionSelections(draft, group.id);
  const selectedValueIds = selected.map((selection) => selection.value_id).filter(Boolean);
  const customSelection = selected.find((selection) => selection.custom_value);
  const customLabel = customSelection ? getSelectionLabel(customSelection) : "";
  const values = getActiveProductOptionValues(group.id);

  if (group.input_type === "text" || (!values.length && group.allow_custom_value)) {
    return `
      <fieldset class="product-option-field" data-product-option-group="${escapeHtml(group.id)}">
        <legend>${escapeHtml(group.name)}${group.is_required ? " *" : ""}</legend>
        <input type="text" data-product-option-custom value="${escapeHtml(customLabel)}" placeholder="Digite um valor para ${escapeHtml(group.name)}" />
      </fieldset>
    `;
  }

  if (group.input_type === "multi_select") {
    return `
      <fieldset class="product-option-field" data-product-option-group="${escapeHtml(group.id)}">
        <legend>${escapeHtml(group.name)}${group.is_required ? " *" : ""}</legend>
        <div class="option-chip-grid">
          ${values
            .map(
              (value) => `
                <label class="option-choice-chip">
                  <input type="checkbox" value="${escapeHtml(value.id)}" data-product-option-checkbox ${selectedValueIds.includes(value.id) ? "checked" : ""} />
                  <span>${escapeHtml(value.label)}</span>
                </label>
              `
            )
            .join("")}
        </div>
        ${group.allow_custom_value ? `<input type="text" data-product-option-custom value="${escapeHtml(customLabel)}" placeholder="Outro valor" />` : ""}
      </fieldset>
    `;
  }

  return `
    <fieldset class="product-option-field" data-product-option-group="${escapeHtml(group.id)}">
      <legend>${escapeHtml(group.name)}${group.is_required ? " *" : ""}</legend>
      <select data-product-option-select>
        <option value="">Não selecionado</option>
        ${values.map((value) => `<option value="${escapeHtml(value.id)}" ${selectedValueIds.includes(value.id) ? "selected" : ""}>${escapeHtml(value.label)}</option>`).join("")}
      </select>
      ${group.allow_custom_value ? `<input type="text" data-product-option-custom value="${escapeHtml(customLabel)}" placeholder="Outro valor" />` : ""}
    </fieldset>
  `;
}

function readJsonTextarea(name, fallback) {
  const field = qs(`#product-editor-form [name='${name}']`);
  if (!field) return fallback;
  return parseJsonSafe(String(field.value || ""), fallback);
}

function readProductOptionSelectionsFromDom(draft) {
  const selections = [];
  qsa("[data-product-option-group]").forEach((field, fieldIndex) => {
    const groupId = field.dataset.productOptionGroup;
    const group = getProductOptionGroup(groupId);
    if (!group) return;

    const checkboxValues = qsa("[data-product-option-checkbox]:checked", field).map((input) => input.value).filter(Boolean);
    const selectValue = field.querySelector("[data-product-option-select]")?.value || "";
    const customText = String(field.querySelector("[data-product-option-custom]")?.value || "").trim();
    const valueIds = group.input_type === "multi_select" ? checkboxValues : selectValue ? [selectValue] : [];

    valueIds.forEach((valueId, index) => {
      selections.push({
        store_id: adminState.store.id,
        product_id: draft.id || null,
        group_id: groupId,
        value_id: valueId,
        custom_value: null,
        sort_order: fieldIndex * 100 + index
      });
    });

    if (customText) {
      selections.push({
        store_id: adminState.store.id,
        product_id: draft.id || null,
        group_id: groupId,
        value_id: null,
        custom_value: { label: customText, value: customText },
        sort_order: fieldIndex * 100 + valueIds.length
      });
    }
  });

  return selections;
}

function buildProductAttributesFromSelections(baseAttributes, selections) {
  const attributes = { ...(baseAttributes && typeof baseAttributes === "object" && !Array.isArray(baseAttributes) ? baseAttributes : {}) };
  getSortedProductOptionGroups("attribute").forEach((group) => {
    delete attributes[group.slug];
  });

  getSortedProductOptionGroups("attribute").forEach((group) => {
    const labels = selections
      .filter((selection) => selection.group_id === group.id)
      .map(getSelectionLabel)
      .filter(Boolean);
    if (!labels.length) return;
    attributes[group.slug] = labels.length === 1 ? labels[0] : labels;
  });

  return attributes;
}

function buildProductVariantsFromSelections(selections) {
  return getSortedProductOptionGroups("variant")
    .map((group) => {
      const options = selections
        .filter((selection) => selection.group_id === group.id)
        .map(getSelectionLabel)
        .filter(Boolean);

      if (!options.length) return null;
      return {
        name: group.name,
        slug: group.slug,
        options
      };
    })
    .filter(Boolean);
}

async function hydrateProductOptionSelections(productId) {
  try {
    const selections = await adminListProductOptionSelections(adminState.store.id, productId);
    if (!adminState.editingProduct || adminState.editingProduct.id !== productId) return;
    adminState.editingProduct.option_selections = selections || [];
    renderProductEditor();
  } catch (error) {
    console.warn("Não foi possível carregar opções do produto.", error);
    showToast(error.message || "Não foi possível carregar opções do produto.", "warning");
  }
}

function getProductOptionSelectionsForSave(draft) {
  const selections = Array.isArray(draft.option_selections) ? draft.option_selections : [];
  return selections.map((selection, index) => ({
    group_id: selection.group_id,
    value_id: selection.value_id || null,
    custom_value: selection.custom_value || null,
    sort_order: Number(selection.sort_order ?? index)
  }));
}

function renderProductEditor() {
  const draft = adminState.editingProduct || createEmptyProductDraft();
  const isSavingProduct = adminState.isSavingProduct;
  const isSavingDraft = isSavingProduct && adminState.productSaveMode === "draft";
  const isPublishingProduct = isSavingProduct && adminState.productSaveMode === "publish";
  const imageOperation = adminState.productImageOperation;
  const isImageOperationBusy = Boolean(imageOperation);
  const isEditorBusy = isSavingProduct || isImageOperationBusy;
  let root = qs("#admin-modal-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "admin-modal-root";
    document.body.appendChild(root);
  }
  const currentImage = getPrimaryImage(draft);

  root.innerHTML = `
    <div class="editor-backdrop" id="editor-backdrop"></div>
    <section class="editor-shell product-editor-shell ${isEditorBusy ? "is-busy" : ""}" role="dialog" aria-modal="true" aria-labelledby="product-editor-title" aria-busy="${isEditorBusy ? "true" : "false"}">
      <header class="editor-header">
        <div>
          <span class="section-kicker">Cadastro em etapas</span>
          <h2 id="product-editor-title">${draft.id ? "Editar produto" : "Novo produto"}</h2>
        </div>
        <button class="modal-close-button" type="button" id="close-editor-button" aria-label="Fechar editor de produto" ${isEditorBusy ? "disabled" : ""}>×</button>
      </header>
      <div class="editor-body">
        <div class="editor-progress">
          <div class="editor-progress__bar" style="width: ${(adminState.productEditorStep / 5) * 100}%"></div>
        </div>
        <div class="editor-stepper">
          ${[1, 2, 3, 4, 5]
            .map(
              (step) => `
                <button class="${adminState.productEditorStep === step ? "is-active" : ""}" type="button" data-editor-step="${step}" ${isEditorBusy ? "disabled" : ""}>
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
              ${renderProductOptionPicker("attribute", draft)}
              ${renderProductOptionPicker("variant", draft)}
              <details class="option-advanced-json">
                <summary>Editar JSON avançado</summary>
                <p class="muted-copy">Modo técnico para compatibilidade. O caminho principal agora é selecionar grupos e valores cadastrados na aba Opções.</p>
                <label class="admin-field">
                  <span>Características (JSON)</span>
                  <textarea name="attributes">${escapeHtml(JSON.stringify(draft.attributes || {}, null, 2))}</textarea>
                </label>
                <label class="admin-field">
                  <span>Variações simples (JSON)</span>
                  <textarea name="variants">${escapeHtml(JSON.stringify(draft.variants || [], null, 2))}</textarea>
                </label>
              </details>
              <label class="admin-field">
                <span>Ordem</span>
                <input type="number" name="sort_order" value="${escapeHtml(draft.sort_order ?? 0)}" />
              </label>
            </div>

            <div class="editor-step ${adminState.productEditorStep === 4 ? "is-active" : ""}" data-step="4">
              <label class="admin-field">
                <span>Novas imagens</span>
                <input type="file" id="product-images-input" multiple accept=".jpg,.jpeg,.png,.webp" ${isEditorBusy ? "disabled" : ""} />
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
                                        ? " · Será a principal se não houver outra definida."
                                        : ""
                                    }
                                  </span>
                                </div>
                                <button
                                  class="btn btn-danger"
                                  type="button"
                                  data-remove-pending-image="${escapeHtml(getPendingProductFileKey(file))}"
                                  ${isEditorBusy ? "disabled" : ""}
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
                  : `<span class="list-item-subtitle">Nenhum arquivo selecionado ainda. As imagens serão enviadas quando você salvar o produto.</span>`
              }
              <div class="list-stack">
                ${(draft.images || [])
                  .map(
                    (image) => `
                      <article class="list-item">
                        <div class="product-line">
                          <img class="product-thumb" src="${escapeHtml(image.image_url)}" alt="${escapeHtml(image.alt_text || draft.name || "Imagem do produto")}" loading="lazy" decoding="async" />
                          <div class="product-line__copy">
                            <strong>${escapeHtml(image.alt_text || draft.name || "Imagem")}</strong>
                            <small>${image.is_primary ? "Imagem principal" : "Imagem auxiliar"}</small>
                          </div>
                        </div>
                        <div class="list-item-footer">
                          <button class="btn btn-secondary" type="button" data-primary-image="${escapeHtml(image.id)}" ${isEditorBusy || image.is_primary ? "disabled" : ""}>${image.is_primary ? "Principal" : imageOperation?.type === "set-primary" && imageOperation.imageId === image.id ? "Atualizando..." : "Definir principal"}</button>
                          <button class="btn btn-danger" type="button" data-delete-image="${escapeHtml(image.id)}" ${isEditorBusy ? "disabled" : ""}>${imageOperation?.type === "delete" && imageOperation.imageId === image.id ? "Removendo..." : "Remover"}</button>
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
                <img src="${escapeHtml(currentImage)}" alt="Prévia do produto" decoding="async" />
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
          <button class="btn btn-ghost" type="button" id="editor-cancel-button" ${isEditorBusy ? "disabled" : ""}>Cancelar</button>
          <button class="btn btn-secondary" type="button" id="editor-prev-button" ${adminState.productEditorStep === 1 || isEditorBusy ? "disabled" : ""}>Voltar</button>
          <button class="btn btn-secondary" type="button" id="editor-next-button" ${adminState.productEditorStep === 5 || isEditorBusy ? "disabled" : ""}>Próximo</button>
          <button class="btn btn-secondary ${isSavingDraft ? "is-loading" : ""}" type="button" id="save-draft-product" ${isEditorBusy ? "disabled" : ""}>
            ${
              isSavingDraft
                ? `<span class="btn__content"><span class="btn-spinner" aria-hidden="true"></span><span>Salvando...</span></span>`
                : "Salvar rascunho"
            }
          </button>
          <button class="btn btn-primary ${isPublishingProduct ? "is-loading" : ""}" type="button" id="save-publish-product" ${isEditorBusy ? "disabled" : ""}>
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
    return `O arquivo ${fileName || "selecionado"} não foi aceito pelo Supabase.`;
  }

  if (message.includes("product_images") || message.includes("foreign key")) {
    return `A imagem subiu, mas não foi vinculada ao produto${fileName ? ` (${fileName})` : ""}. Revise a tabela product_images e as policies.`;
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
    attributes: readJsonTextarea("attributes", adminState.editingProduct?.attributes || {}),
    variants: readJsonTextarea("variants", adminState.editingProduct?.variants || []),
    sort_order: Number(data.get("sort_order") || 0),
    is_active: form.querySelector("[name='is_active']")?.checked || false,
    is_featured: form.querySelector("[name='is_featured']")?.checked || false,
    is_new: form.querySelector("[name='is_new']")?.checked || false,
    is_best_seller: form.querySelector("[name='is_best_seller']")?.checked || false,
    is_promotion: form.querySelector("[name='is_promotion']")?.checked || false,
    allow_whatsapp_cta: form.querySelector("[name='allow_whatsapp_cta']")?.checked ?? true,
    images: adminState.editingProduct?.images || []
  };

  const optionSelections = readProductOptionSelectionsFromDom(adminState.editingProduct);
  adminState.editingProduct.option_selections = optionSelections;
  adminState.editingProduct.attributes = buildProductAttributesFromSelections(adminState.editingProduct.attributes, optionSelections);
  adminState.editingProduct.variants = buildProductVariantsFromSelections(optionSelections);
}

function changeProductEditorStep(delta) {
  if (adminState.isSavingProduct || adminState.productImageOperation) return;
  persistEditorDraftFromDom();
  adminState.productEditorStep = Math.max(1, Math.min(5, adminState.productEditorStep + delta));
  renderProductEditor();
}

function closeProductEditor(force = false) {
  if ((adminState.isSavingProduct || adminState.productImageOperation) && !force) return;
  adminState.editingProduct = null;
  adminState.pendingProductFiles = [];
  adminState.isSavingProduct = false;
  adminState.productSaveMode = null;
  adminState.productImageOperation = null;
  qs("#admin-modal-root").innerHTML = "";
  setAdminModalOpen("product-editor", false);
}

async function saveProduct(publish) {
  if (adminState.isSavingProduct || adminState.productImageOperation) return;
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

    const savedOptionSelections = await adminSaveProductOptionSelections(
      adminState.store.id,
      savedProduct.id,
      getProductOptionSelectionsForSave(draft)
    );

    adminState.editingProduct = {
      ...draft,
      ...savedProduct,
      option_selections: savedOptionSelections || draft.option_selections || [],
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
    notifyStorefrontChanged("product-save");
    await refreshProductsData();
    renderAdminLayout();
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
      const optimization = await optimizeImageForUpload(file, { maxDimension: 1600, quality: 0.9 });
      const uploadFile = optimization.file;
      const upload = await uploadProductImage(uploadFile, adminState.store.id, product.id);
      if (optimization.optimized) {
        console.info("Imagem otimizada antes do upload.", {
          file: file.name,
          originalBytes: optimization.originalSize,
          optimizedBytes: optimization.optimizedSize,
          originalDimensions: `${optimization.originalWidth}x${optimization.originalHeight}`,
          outputDimensions: `${optimization.outputWidth}x${optimization.outputHeight}`
        });
      }
      let createdImage;
      try {
        createdImage = await createUploadedProductImageRecord({
          product_id: product.id,
          image_url: upload.publicUrl,
          storage_path: upload.path,
          alt_text: product.name,
          sort_order: existingImages.length
        });
      } catch (recordError) {
        await supabase.storage.from("product-images").remove([upload.path]).catch(() => {});
        throw recordError;
      }

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
  const images = draft?.images || [];
  const targetImage = images.find((image) => image.id === imageId);
  if (!draft?.id || !targetImage || targetImage.is_primary || adminState.productImageOperation) return;

  adminState.productImageOperation = { type: "set-primary", imageId };
  renderProductEditor();

  try {
    const updatedImage = await adminSetPrimaryProductImage(draft.id, imageId);
    draft.images = images.map((image) => ({
      ...image,
      ...(image.id === imageId ? updatedImage : {}),
      is_primary: image.id === imageId
    }));
    showToast("Imagem principal atualizada.", "success");
    notifyStorefrontChanged("product-image-primary");
  } catch (error) {
    console.error(error);
    showToast(error.message || "N?o foi poss?vel atualizar a imagem principal.", "danger");
  } finally {
    adminState.productImageOperation = null;
    if (adminState.editingProduct) renderProductEditor();
  }
}

async function removeExistingProductImage(imageId) {
  if (adminState.productImageOperation) return;

  const proceed = window.confirm("Remover esta imagem do produto?");
  if (!proceed) return;

  const currentImages = [...(adminState.editingProduct?.images || [])];
  const removedImage = currentImages.find((image) => image.id === imageId);
  if (!removedImage) return;

  adminState.productImageOperation = { type: "delete", imageId };
  renderProductEditor();

  try {
    const deleteResult = await adminDeleteProductImage(imageId);
    const promotedImage = deleteResult?.promotedImage || null;
    let remainingImages = currentImages.filter((image) => image.id !== imageId);

    if (removedImage.is_primary) {
      remainingImages = remainingImages.map((image) => ({
        ...image,
        ...(promotedImage?.id === image.id ? promotedImage : {}),
        is_primary: Boolean(promotedImage?.id && promotedImage.id === image.id)
      }));
    }

    adminState.editingProduct.images = remainingImages;

    if (deleteResult?.cleanup?.failed?.length) {
      console.warn("Imagem removida do cat?logo, mas houve falha ao limpar o arquivo no Storage.", deleteResult.cleanup.failed);
      showToast("Imagem removida. Um arquivo ficou pendente de limpeza no Storage.", "warning");
    } else {
      showToast("Imagem removida.", "warning");
    }
    notifyStorefrontChanged("product-image-remove");
  } catch (error) {
    console.error(error);
    showToast(error.message || "N?o foi poss?vel remover a imagem.", "danger");
  } finally {
    adminState.productImageOperation = null;
    if (adminState.editingProduct) renderProductEditor();
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
      sku: buildDuplicatedSku(source.sku),
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

    const duplicatedForState = {
      ...duplicated,
      images: duplicated.images?.length ? duplicated.images : source.images || []
    };
    prependUniqueProductState(duplicatedForState);
    showToast("Produto duplicado como rascunho.", "success");
    notifyStorefrontChanged("product-duplicate");
    await refreshProductsData();
    prependUniqueProductState(duplicatedForState);
    renderAdminLayout();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível duplicar o produto.", "danger");
  }
}

async function deleteProduct(productId) {
  const proceed = window.confirm("Excluir este produto permanentemente?");
  if (!proceed) return;
  const cleanup = await adminDeleteProduct(productId);
  if (cleanup?.failed?.length) {
    console.warn("Produto excluído, mas houve falha ao limpar arquivos órfãos no Storage.", cleanup.failed);
    showToast("Produto excluído. Alguns arquivos ficaram pendentes de limpeza no Storage.", "warning");
  } else {
    showToast("Produto excluído.", "warning");
  }
  notifyStorefrontChanged("product-delete");
  await refreshProductsAndSectionsData();
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
  notifyStorefrontChanged("product-bulk-update");
  await refreshProductsData();
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
  notifyStorefrontChanged("section-save");
  await refreshSectionsData();
  adminState.currentAdminTab = "sections";
}

async function refreshSection(sectionId) {
  await adminRefreshAutomaticSection(sectionId);
  showToast("Seção automática atualizada.", "success");
  notifyStorefrontChanged("section-refresh");
  await refreshSectionsData();
}

async function refreshStaleSections(silent) {
  const staleSections = adminState.sections.filter(isSectionStale);
  if (!staleSections.length) return 0;

  let refreshedCount = 0;
  for (const section of staleSections) {
    try {
      await adminRefreshAutomaticSection(section.id);
      refreshedCount += 1;
    } catch (error) {
      console.warn(`Falha ao atualizar seção automática ${section.id}.`, error);
    }
  }

  if (!refreshedCount) return 0;

  if (!silent) showToast("Seções automáticas reprocessadas.", "success");
  const refreshedSections = await adminListSections(adminState.store.id);
  adminState.sections = refreshedSections;
  if (!silent) renderAdminLayout();
  return refreshedCount;
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

async function saveProductOptionGroup(event) {
  event.preventDefault();
  clearAdminFormDirty("options");
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  if (!name) {
    showToast("Informe o nome do grupo.", "warning");
    return;
  }

  await adminSaveProductOptionGroup({
    id: String(data.get("id") || "") || undefined,
    store_id: adminState.store.id,
    type: String(data.get("type") || "attribute"),
    name,
    slug: String(data.get("slug") || "").trim() || slugify(name),
    description: String(data.get("description") || ""),
    input_type: String(data.get("input_type") || "select"),
    value_type: "text",
    allow_custom_value: form.querySelector("[name='allow_custom_value']")?.checked || false,
    show_on_product: form.querySelector("[name='show_on_product']")?.checked !== false,
    use_as_filter: form.querySelector("[name='use_as_filter']")?.checked || false,
    is_required: form.querySelector("[name='is_required']")?.checked || false,
    is_active: form.querySelector("[name='is_active']")?.checked !== false,
    sort_order: Number(data.get("sort_order") || 0)
  });

  adminState.editingOptionGroup = createEmptyOptionGroupDraft();
  await refreshProductOptionsData();
  showToast("Grupo salvo.", "success");
  renderAdminLayout();
}

async function saveProductOptionValue(event) {
  event.preventDefault();
  clearAdminFormDirty("options");
  const form = event.currentTarget;
  const data = new FormData(form);
  const label = String(data.get("label") || "").trim();
  const groupId = String(data.get("group_id") || "");
  if (!groupId) {
    showToast("Crie ou selecione um grupo antes de salvar o valor.", "warning");
    return;
  }
  if (!label) {
    showToast("Informe o rótulo do valor.", "warning");
    return;
  }

  await adminSaveProductOptionValue({
    id: String(data.get("id") || "") || undefined,
    store_id: adminState.store.id,
    group_id: groupId,
    label,
    value: String(data.get("value") || "").trim() || slugify(label),
    description: String(data.get("description") || ""),
    metadata: {},
    is_active: form.querySelector("[name='is_active']")?.checked !== false,
    sort_order: Number(data.get("sort_order") || 0)
  });

  adminState.editingOptionValue = createEmptyOptionValueDraft();
  await refreshProductOptionsData();
  showToast("Valor salvo.", "success");
  renderAdminLayout();
}

async function disableProductOptionGroup(groupId) {
  if (!window.confirm("Desativar este grupo? Produtos existentes manterão os dados já salvos.")) return;
  await adminDeactivateProductOptionGroup(groupId);
  await refreshProductOptionsData();
  showToast("Grupo desativado.", "warning");
  renderAdminLayout();
}

async function disableProductOptionValue(valueId) {
  if (!window.confirm("Desativar este valor? Produtos existentes manterão os dados já salvos.")) return;
  await adminDeactivateProductOptionValue(valueId);
  await refreshProductOptionsData();
  showToast("Valor desativado.", "warning");
  renderAdminLayout();
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
  notifyStorefrontChanged("category-save");
  adminState.categories = await adminListCategories(adminState.store.id);
  renderAdminLayout();
}

async function removeCategory(categoryId) {
  if (!window.confirm("Excluir esta categoria?")) return;
  await adminDeleteCategory(categoryId);
  notifyStorefrontChanged("category-delete");
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
  notifyStorefrontChanged("brand-save");
  adminState.editingBrand = createEmptyBrandDraft();
  adminState.brands = await adminListBrands(adminState.store.id);
  renderAdminLayout();
}

async function removeBrand(brandId) {
  if (!window.confirm("Excluir esta marca?")) return;
  await adminDeleteBrand(brandId);
  notifyStorefrontChanged("brand-delete");
  showToast("Marca excluída.", "warning");
  adminState.brands = await adminListBrands(adminState.store.id);
  renderAdminLayout();
}

async function saveBanner(event) {
  event.preventDefault();
  clearAdminFormDirty("appearance");
  const form = event.currentTarget;
  const data = new FormData(form);
  const previousImageUrl = String(adminState.editingBanner?.image_url || "");
  let imageUrl = String(data.get("image_url") || "");
  let storagePath = adminState.editingBanner?.storage_path || null;
  let uploadedPath = null;

  try {
    if (adminState.pendingBannerFile) {
      const optimization = await optimizeImageForUpload(adminState.pendingBannerFile, { maxDimension: 1920, quality: 0.86 });
      const upload = await uploadBannerImage(optimization.file, adminState.store.id);
      if (optimization.optimized) {
        console.info("Banner otimizado antes do upload.", {
          file: adminState.pendingBannerFile.name,
          originalBytes: optimization.originalSize,
          optimizedBytes: optimization.optimizedSize,
          originalDimensions: `${optimization.originalWidth}x${optimization.originalHeight}`,
          outputDimensions: `${optimization.outputWidth}x${optimization.outputHeight}`
        });
      }
      imageUrl = upload.publicUrl;
      storagePath = upload.path;
      uploadedPath = upload.path;
    } else if (imageUrl !== previousImageUrl) {
      storagePath = null;
    }

    const saveResult = await adminSaveBanner({
      id: String(data.get("id") || "") || undefined,
      store_id: adminState.store.id,
      title: String(data.get("title") || ""),
      subtitle: String(data.get("subtitle") || ""),
      image_url: imageUrl,
      storage_path: storagePath,
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

    if (saveResult?.cleanup?.failed?.length) {
      console.warn("Banner salvo, mas houve falha ao limpar o arquivo anterior no Storage.", saveResult.cleanup.failed);
      showToast("Banner salvo. Um arquivo anterior ficou pendente de limpeza no Storage.", "warning");
    } else {
      showToast("Banner salvo com sucesso.", "success");
    }

    notifyStorefrontChanged("banner-save");
    adminState.pendingBannerFile = null;
    adminState.editingBanner = createEmptyBannerDraft();
    adminState.banners = await adminListBanners(adminState.store.id);
    renderAdminLayout();
  } catch (error) {
    if (uploadedPath) {
      await supabase.storage.from("product-images").remove([uploadedPath]).catch(() => {});
    }
    console.error(error);
    showToast(error.message || "Não foi possível salvar o banner.", "danger");
  }
}

async function removeBanner(bannerId) {
  if (!window.confirm("Excluir este banner?")) return;
  try {
    const cleanup = await adminDeleteBanner(bannerId);
    notifyStorefrontChanged("banner-delete");
    if (cleanup?.failed?.length) {
      console.warn("Banner excluído, mas houve falha ao limpar o arquivo no Storage.", cleanup.failed);
      showToast("Banner excluído. Um arquivo ficou pendente de limpeza no Storage.", "warning");
    } else {
      showToast("Banner excluído.", "warning");
    }
    adminState.banners = await adminListBanners(adminState.store.id);
    renderAdminLayout();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível excluir o banner.", "danger");
  }
}

async function saveNotification(event) {
  event.preventDefault();
  clearAdminFormDirty("notifications");
  const form = event.currentTarget;
  const data = new FormData(form);
  const targetUrl = String(data.get("target_url") || "").trim();
  const scheduledAt = parseDateTimeLocalValue(String(data.get("scheduled_at") || ""));
  const recurrenceRule = String(data.get("recurrence_rule") || "");
  const recurrenceNextAt = recurrenceRule ? scheduledAt || new Date().toISOString() : null;
  const status = scheduledAt || recurrenceRule ? "scheduled" : "draft";
  const isEditing = Boolean(adminState.editingNotificationId);

  try {
    const payload = {
      store_id: adminState.store.id,
      title: String(data.get("title") || "").trim(),
      body: String(data.get("body") || "").trim(),
      target_url: targetUrl || "./index.html",
      image_url: "",
      status,
      scheduled_at: scheduledAt,
      recurrence_rule: recurrenceRule || null,
      recurrence_next_at: recurrenceNextAt,
      created_by: adminState.profile.id
    };

    if (isEditing) {
      payload.id = adminState.editingNotificationId;
      delete payload.created_by;
    }

    const savedNotification = await adminSaveNotification(payload);
    const shouldSendNow =
      status === "scheduled" && scheduledAt && !recurrenceRule && new Date(scheduledAt).getTime() <= Date.now();
    let immediateSendResult = null;
    let immediateSendError = null;
    if (shouldSendNow) {
      try {
        immediateSendResult = await sendNotification(savedNotification.id, { silentRefresh: true });
      } catch (error) {
        immediateSendError = error;
      }
    }

    adminState.editingNotificationId = null;
    if (immediateSendError) {
      showToast(immediateSendError.message || "Agendamento salvo, mas o envio imediato falhou.", "danger");
    } else if (shouldSendNow && immediateSendResult?.sent > 0) {
      showToast(`Horário já atingido. Notificação enviada para ${immediateSendResult.sent} dispositivo(s).`, "success");
    } else if (shouldSendNow) {
      showToast(immediateSendResult?.message || "Agendamento salvo, mas nenhum dispositivo recebeu agora.", "warning");
    } else {
      showToast(
        status === "scheduled" ? "Notificação agendada." : isEditing ? "Rascunho atualizado." : "Notificação salva em rascunho.",
        "success"
      );
    }
    adminState.notifications = await adminListNotifications(adminState.store.id);
    renderAdminLayout();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível salvar a notificação.", "danger");
  }
}

function parseDateTimeLocalValue(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

async function stopNotificationRecurrence(notificationId) {
  const notification = adminState.notifications.find((item) => item.id === notificationId);
  if (!notification?.recurrence_rule) return;
  if (!window.confirm("Encerrar a recorrência desta notificação? Ela ficará como rascunho e não será disparada automaticamente.")) return;

  try {
    await adminSaveNotification({
      id: notificationId,
      status: "draft",
      recurrence_rule: null,
      recurrence_next_at: null,
      scheduled_at: null
    });
    if (adminState.editingNotificationId === notificationId) {
      adminState.editingNotificationId = null;
    }
    showToast("Recorrência encerrada. A notificação voltou para rascunho.", "success");
    adminState.notifications = await adminListNotifications(adminState.store.id);
    renderAdminLayout();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível encerrar a recorrência.", "danger");
  }
}

async function cancelNotificationSchedule(notificationId) {
  const notification = adminState.notifications.find((item) => item.id === notificationId);
  if (!notification?.scheduled_at || notification.recurrence_rule || notification.status !== "scheduled") return;
  if (!window.confirm("Cancelar o agendamento desta notificação? Ela ficará como rascunho e não será disparada automaticamente.")) return;

  try {
    await adminSaveNotification({
      id: notificationId,
      status: "draft",
      scheduled_at: null,
      recurrence_next_at: null
    });
    if (adminState.editingNotificationId === notificationId) {
      adminState.editingNotificationId = null;
    }
    showToast("Agendamento cancelado. A notificação voltou para rascunho.", "success");
    adminState.notifications = await adminListNotifications(adminState.store.id);
    renderAdminLayout();
  } catch (error) {
    console.error(error);
    showToast(error.message || "Não foi possível cancelar o agendamento.", "danger");
  }
}

async function sendNotification(notificationId, options = {}) {
  const notification = adminState.notifications.find((item) => item.id === notificationId);
  const isResend = notification?.status === "sent";
  if (isResend && !options.silentRefresh) {
    const proceed = window.confirm("Reenviar esta notificação para os dispositivos inscritos?");
    if (!proceed) return null;
  }

  if (!adminState.settings?.enable_notifications) {
    showToast("Ative notificações nas configurações da loja antes de enviar.", "warning");
    return;
  }

  let result = null;

  try {
    result = await adminSendNotification(notificationId);
    if (!options.silentRefresh) {
      if (result?.sent > 0) {
        showToast(`Notificação enviada para ${result.sent} dispositivo(s).`, "success");
      } else {
        showToast(result?.message || "Nenhum dispositivo inscrito para receber notificações.", "warning");
      }
    }
  } catch (error) {
    console.error(error);
    await adminSaveNotification({
      id: notificationId,
      status: "failed",
      sent_at: null
    }).catch((updateError) => console.warn("Não foi possível marcar a notificação como falha.", updateError));
    if (!options.silentRefresh) {
      showToast(error.message || "Não foi possível enviar a notificação.", "danger");
    }
    if (options.silentRefresh) throw error;
  }

  if (!options.silentRefresh) {
    adminState.notifications = await adminListNotifications(adminState.store.id);
    renderAdminLayout();
  }
  return result;
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
  notifyStorefrontChanged("settings-save");
  showToast("Configurações salvas.", "success");
  renderAdminLayout();
}

async function refreshProductsData() {
  const allProductsPromise = adminListProducts(adminState.store.id, {});
  const filteredProductsPromise = hasActiveProductFilters()
    ? adminListProducts(adminState.store.id, adminState.productFilters)
    : allProductsPromise;
  const [allProductsRes, filteredProductsRes] = await Promise.all([
    allProductsPromise,
    filteredProductsPromise
  ]);
  adminState.products = allProductsRes.data || [];
  adminState.filteredProducts = filteredProductsRes.data || [];
  adminState.selectedProductIds = adminState.selectedProductIds.filter((id) =>
    adminState.filteredProducts.some((product) => product.id === id)
  );
}

async function refreshSectionsData() {
  adminState.sections = (await adminListSections(adminState.store.id)) || [];
}

async function refreshProductsAndSectionsData() {
  const allProductsPromise = adminListProducts(adminState.store.id, {});
  const filteredProductsPromise = hasActiveProductFilters()
    ? adminListProducts(adminState.store.id, adminState.productFilters)
    : allProductsPromise;
  const [allProductsRes, filteredProductsRes, sections] = await Promise.all([
    allProductsPromise,
    filteredProductsPromise,
    adminListSections(adminState.store.id)
  ]);
  adminState.products = allProductsRes.data || [];
  adminState.filteredProducts = filteredProductsRes.data || [];
  adminState.sections = sections || [];
  adminState.selectedProductIds = adminState.selectedProductIds.filter((id) =>
    adminState.filteredProducts.some((product) => product.id === id)
  );
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

function createEmptyOptionGroupDraft() {
  return {
    id: null,
    store_id: adminState.store?.id,
    type: "attribute",
    name: "",
    slug: "",
    description: "",
    input_type: "select",
    value_type: "text",
    allow_custom_value: false,
    show_on_product: true,
    use_as_filter: false,
    is_required: false,
    is_active: true,
    sort_order: 0
  };
}

function createEmptyOptionValueDraft() {
  return {
    id: null,
    store_id: adminState.store?.id,
    group_id: adminState.productOptionGroups?.[0]?.id || "",
    label: "",
    value: "",
    description: "",
    metadata: {},
    is_active: true,
    sort_order: 0
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
    storage_path: null,
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
  return periods.map((period) => `${period.start} às ${period.end}`).join(" • ");
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
  if (!openDays.length) return "Nenhum horário definido";
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
    label.textContent = "Horários de funcionamento";
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
        <p class="muted-copy">Defina um turno simples ou dois turnos com pausa para almoço.</p>
      </div>
      <button class="btn btn-secondary" type="button" id="open-business-hours-editor">Editar horários</button>
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
    <section class="editor-shell admin-modal-shell hours-editor-shell" role="dialog" aria-modal="true" aria-labelledby="hours-editor-title">
      <header class="editor-header">
        <div>
          <span class="section-kicker">Atendimento da loja</span>
          <h2 id="hours-editor-title">Horários de funcionamento</h2>
        </div>
        <button class="modal-close-button" type="button" id="close-hours-editor" aria-label="Fechar horários de funcionamento">×</button>
      </header>
      <div class="editor-body hours-editor-body">
        <p class="muted-copy">Escolha um horário contínuo ou ative a pausa de almoço para cadastrar dois turnos no mesmo dia.</p>
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
                    <span>Com pausa para almoço</span>
                  </label>
                  <div class="hours-time-grid">
                    <label class="admin-field">
                      <span>Início</span>
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
          <button class="btn btn-primary" type="button" id="apply-hours-editor">Aplicar horários</button>
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
        showToast(`A pausa de ${day.label} precisa começar depois do primeiro turno.`, "warning");
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
