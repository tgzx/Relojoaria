import { showToast, qs } from "./utils.js";

const INSTALL_REMINDER_KEY = "vz_install_prompt_dismissed_at";
const INSTALL_REMINDER_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const AUTO_PROMPT_DELAY_MS = 6000;

let deferredInstallPrompt = null;
let promptMode = "android";
let autoPromptTimer = 0;
let hasAutoPromptedThisSession = false;
let pendingAutoPromptMode = null;
let lastPromptInteractionAt = Date.now();
let promptInteractionTrackingBound = false;
let lastPromptTrigger = null;

function isEmbeddedPreview() {
  const params = new URLSearchParams(window.location.search);
  return window.self !== window.top || params.has("embedded_preview");
}

export function isStandalone() {
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

function clearAutoPromptState() {
  clearPromptTimer();
  pendingAutoPromptMode = null;
}

function schedulePendingAutoPrompt() {
  if (!pendingAutoPromptMode || hasAutoPromptedThisSession) return;

  window.clearTimeout(autoPromptTimer);
  const idleFor = Date.now() - lastPromptInteractionAt;
  const delay = Math.max(150, AUTO_PROMPT_DELAY_MS - idleFor);

  autoPromptTimer = window.setTimeout(() => {
    autoPromptTimer = 0;
    if (!pendingAutoPromptMode || hasAutoPromptedThisSession) return;

    if (!document.body.classList.contains("app-interactive") || hasBlockingSurfaceOpen()) {
      autoPromptTimer = window.setTimeout(schedulePendingAutoPrompt, 800);
      return;
    }

    const currentIdleFor = Date.now() - lastPromptInteractionAt;
    if (currentIdleFor < AUTO_PROMPT_DELAY_MS) {
      schedulePendingAutoPrompt();
      return;
    }

    const mode = pendingAutoPromptMode;
    pendingAutoPromptMode = null;
    if (showInstallPrompt(mode)) {
      hasAutoPromptedThisSession = true;
    } else {
      pendingAutoPromptMode = mode;
      autoPromptTimer = window.setTimeout(schedulePendingAutoPrompt, 800);
    }
  }, delay);
}

function notePromptInteraction() {
  lastPromptInteractionAt = Date.now();
  if (pendingAutoPromptMode && !hasAutoPromptedThisSession) {
    schedulePendingAutoPrompt();
  }
}

function ensurePromptInteractionTracking() {
  if (promptInteractionTrackingBound) return;
  promptInteractionTrackingBound = true;

  document.addEventListener("pointerdown", notePromptInteraction, { passive: true, capture: true });
  document.addEventListener("keydown", notePromptInteraction, { capture: true });
  document.addEventListener("input", notePromptInteraction, { capture: true });
  document.addEventListener("scroll", notePromptInteraction, { passive: true, capture: true });
}

function hasBlockingSurfaceOpen() {
  return Boolean(document.querySelector("#product-modal:not(.is-hidden), #filters-sheet:not(.is-hidden)"));
}

function setPromptBackgroundInert(isInert) {
  document.querySelectorAll(".site-header, main, .site-footer, #intro-overlay, #product-modal, #filters-sheet").forEach((element) => {
    element.inert = isInert;
  });
}

export function hideInstallPrompt({ storeCooldown = false } = {}) {
  clearAutoPromptState();

  const shell = qs("#install-prompt");
  if (!shell) return;

  shell.classList.add("is-hidden");
  shell.setAttribute("aria-hidden", "true");
  setPromptBackgroundInert(false);
  const trigger = lastPromptTrigger;
  lastPromptTrigger = null;
  if (trigger?.isConnected) window.requestAnimationFrame(() => trigger.focus());

  if (storeCooldown) {
    storeReminderCooldown();
  }
}

export function showInstallPrompt(mode, options = {}) {
  if (isStandalone() && !options.allowStandalone) return;

  const shell = qs("#install-prompt");
  const title = qs("#install-prompt-title");
  const copy = qs("#install-prompt-copy");
  const steps = qs("#install-ios-steps");
  const confirmButton = qs("#confirm-install-prompt");

  if (!shell || !title || !copy || !steps || !confirmButton) return false;
  if (!shell.classList.contains("is-hidden")) return true;
  if (!document.body.classList.contains("app-interactive") || hasBlockingSurfaceOpen()) return false;

  promptMode = mode;
  lastPromptTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  if (options.title || options.copy || options.confirmLabel) {
    title.textContent = options.title || "Instale a vitrine no seu celular";
    copy.textContent = options.copy || "Abra a loja mais rápido, com experiência de aplicativo e acesso direto pela tela inicial.";
    steps.classList.toggle("is-hidden", !options.showIosSteps);
    confirmButton.textContent = options.confirmLabel || "Entendi";
  } else if (mode === "ios") {
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
  setPromptBackgroundInert(true);
  window.requestAnimationFrame(() => qs("#close-install-prompt")?.focus());
  return true;
}

function scheduleInstallReminder(mode) {
  if (hasAutoPromptedThisSession || isStandalone() || !canShowInstallReminder()) return;

  pendingAutoPromptMode = mode;
  lastPromptInteractionAt = Date.now();
  ensurePromptInteractionTracking();
  schedulePendingAutoPrompt();
}

let promptKeyboardBound = false;

function handleInstallPromptKeydown(event) {
  const shell = qs("#install-prompt");
  if (!shell || shell.classList.contains("is-hidden")) return;

  if (event.key === "Escape") {
    event.preventDefault();
    hideInstallPrompt({ storeCooldown: true });
    return;
  }
  if (event.key !== "Tab") return;

  const focusables = Array.from(
    shell.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])")
  ).filter((element) => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== "hidden");
  if (!focusables.length) return;

  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const focused = document.activeElement;
  if (event.shiftKey && (focused === first || !shell.contains(focused))) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (focused === last || !shell.contains(focused))) {
    event.preventDefault();
    first.focus();
  }
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
      const registration = await navigator.serviceWorker.register("./service-worker.js", {
        updateViaCache: "none"
      });
      registration.update().catch(() => {});
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
    clearAutoPromptState();

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

  if (!promptKeyboardBound) {
    document.addEventListener("keydown", handleInstallPromptKeydown);
    promptKeyboardBound = true;
  }

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton?.classList.add("is-hidden");
    hideInstallPrompt();
    showToast("Vitrine instalada com sucesso.", "success");
  });
}
