import { showToast, qs } from "./utils.js";

const INSTALL_REMINDER_KEY = "vz_install_prompt_dismissed_at";
const INSTALL_REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const AUTO_PROMPT_DELAY_MS = 2200;

let deferredInstallPrompt = null;
let promptMode = "android";
let autoPromptTimer = 0;
let hasAutoPromptedThisSession = false;

function isEmbeddedPreview() {
  const params = new URLSearchParams(window.location.search);
  return window.self !== window.top || params.has("embedded_preview");
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isSafariBrowser() {
  return /safari/i.test(window.navigator.userAgent) && !/chrome|chromium|android/i.test(window.navigator.userAgent);
}

function canShowInstallReminder() {
  const dismissedAt = Number(window.localStorage.getItem(INSTALL_REMINDER_KEY) || 0);
  return !dismissedAt || Date.now() - dismissedAt >= INSTALL_REMINDER_COOLDOWN_MS;
}

function storeReminderCooldown() {
  window.localStorage.setItem(INSTALL_REMINDER_KEY, String(Date.now()));
}

function clearPromptTimer() {
  window.clearTimeout(autoPromptTimer);
  autoPromptTimer = 0;
}

function hideInstallPrompt({ storeCooldown = false } = {}) {
  clearPromptTimer();

  const shell = qs("#install-prompt");
  if (!shell) return;

  shell.classList.add("is-hidden");
  shell.setAttribute("aria-hidden", "true");

  if (storeCooldown) {
    storeReminderCooldown();
  }
}

function showInstallPrompt(mode) {
  if (isStandalone()) return;

  const shell = qs("#install-prompt");
  const title = qs("#install-prompt-title");
  const copy = qs("#install-prompt-copy");
  const steps = qs("#install-ios-steps");
  const confirmButton = qs("#confirm-install-prompt");

  if (!shell || !title || !copy || !steps || !confirmButton) return;

  promptMode = mode;

  if (mode === "ios") {
    title.textContent = "Adicione a vitrine à sua tela inicial";
    copy.textContent = "No iPhone e no iPad, a instalação é manual. Leva poucos toques e deixa a vitrine com cara de app.";
    steps.classList.remove("is-hidden");
    confirmButton.textContent = "Entendi";
  } else {
    title.textContent = "Instale a vitrine no seu celular";
    copy.textContent = "Abra a loja mais rápido, com experiência de aplicativo e acesso direto pela tela inicial.";
    steps.classList.add("is-hidden");
    confirmButton.textContent = "Instalar app";
  }

  shell.classList.remove("is-hidden");
  shell.setAttribute("aria-hidden", "false");
}

function scheduleInstallReminder(mode) {
  if (hasAutoPromptedThisSession || isStandalone() || !canShowInstallReminder()) return;

  clearPromptTimer();
  autoPromptTimer = window.setTimeout(() => {
    hasAutoPromptedThisSession = true;
    showInstallPrompt(mode);
  }, AUTO_PROMPT_DELAY_MS);
}

export async function registerPwa() {
  const installButton = qs("#install-app-button");
  const confirmPromptButton = qs("#confirm-install-prompt");
  const dismissPromptButton = qs("#dismiss-install-prompt");
  const closePromptButton = qs("#close-install-prompt");
  const embeddedPreview = isEmbeddedPreview();

  if (embeddedPreview) {
    installButton?.classList.add("is-hidden");
    hideInstallPrompt();
    return;
  }

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (error) {
      console.warn("Falha ao registrar service worker", error);
    }
  }

  if (isStandalone()) {
    installButton?.classList.add("is-hidden");
    hideInstallPrompt();
    return;
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton?.classList.remove("is-hidden");
    scheduleInstallReminder("android");
  });

  if (isIosDevice() && isSafariBrowser()) {
    installButton?.classList.remove("is-hidden");
    scheduleInstallReminder("ios");
  }

  installButton?.addEventListener("click", () => {
    if (deferredInstallPrompt) {
      showInstallPrompt("android");
      return;
    }

    if (isIosDevice() && isSafariBrowser()) {
      showInstallPrompt("ios");
    }
  });

  confirmPromptButton?.addEventListener("click", async () => {
    if (promptMode === "ios" || !deferredInstallPrompt) {
      hideInstallPrompt({ storeCooldown: true });
      return;
    }

    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;

    if (result.outcome === "accepted") {
      showToast("Aplicativo sendo instalado no seu dispositivo.", "success");
      installButton?.classList.add("is-hidden");
      hideInstallPrompt();
    } else {
      hideInstallPrompt({ storeCooldown: true });
    }

    deferredInstallPrompt = null;
  });

  dismissPromptButton?.addEventListener("click", () => hideInstallPrompt({ storeCooldown: true }));
  closePromptButton?.addEventListener("click", () => hideInstallPrompt({ storeCooldown: true }));

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton?.classList.add("is-hidden");
    hideInstallPrompt();
    showToast("Vitrine instalada com sucesso.", "success");
  });
}
