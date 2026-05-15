import { showToast, qs } from "./utils.js";

let deferredInstallPrompt = null;

export async function registerPwa() {
  const installButton = qs("#install-app-button");

  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("./service-worker.js");
    } catch (error) {
      console.warn("Falha ao registrar service worker", error);
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    installButton?.classList.remove("is-hidden");
  });

  installButton?.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    const result = await deferredInstallPrompt.userChoice;
    if (result.outcome === "accepted") {
      showToast("Aplicativo sendo instalado no seu dispositivo.", "success");
      installButton.classList.add("is-hidden");
    }
    deferredInstallPrompt = null;
  });

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    installButton?.classList.add("is-hidden");
    showToast("Vitrine instalada com sucesso.", "success");
  });
}
