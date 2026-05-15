import { APP_CONFIG } from "./config.js";
import { supabase } from "./supabaseClient.js";
import { qs, showToast } from "./utils.js";

export function isPushSupported() {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    throw new Error("Este navegador não suporta notificações.");
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Permissão de notificação não concedida.");
  }

  return permission;
}

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((character) => character.charCodeAt(0)));
}

export async function saveSubscriptionToSupabase(subscription, storeId) {
  const { error } = await supabase.rpc("public_upsert_push_subscription", {
    target_store_id: storeId,
    target_endpoint: subscription.endpoint,
    target_subscription: subscription.toJSON(),
    target_user_agent: navigator.userAgent
  });

  if (error) throw error;
}

export async function subscribeUserToPush(storeId) {
  if (!isPushSupported()) {
    throw new Error("Push não suportado neste navegador.");
  }

  if (!APP_CONFIG.PUBLIC_VAPID_KEY || APP_CONFIG.PUBLIC_VAPID_KEY.startsWith("COLE_AQUI")) {
    throw new Error("Configure a PUBLIC_VAPID_KEY em js/config.js antes de ativar push.");
  }

  await requestNotificationPermission();
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();

  if (existing) {
    await saveSubscriptionToSupabase(existing, storeId);
    return existing;
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(APP_CONFIG.PUBLIC_VAPID_KEY)
  });

  await saveSubscriptionToSupabase(subscription, storeId);
  return subscription;
}

export async function unsubscribeFromPush() {
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();

  if (!subscription) return false;

  const { error } = await supabase.rpc("public_deactivate_push_subscription", {
    target_endpoint: subscription.endpoint
  });

  if (error) {
    console.warn("Falha ao desativar subscription remotamente", error);
  }

  await subscription.unsubscribe();
  return true;
}

export async function registerPushButton(storeId, options = {}) {
  const button = qs("#push-button");
  if (!button || !options.enabled) return;

  if (!isPushSupported()) {
    button.classList.add("is-hidden");
    return;
  }

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const existing = registration ? await registration.pushManager.getSubscription() : null;

  button.classList.remove("is-hidden");
  button.textContent = existing ? "Desativar novidades" : "Receber novidades";

  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      const liveRegistration = await navigator.serviceWorker.ready;
      const current = await liveRegistration.pushManager.getSubscription();

      if (current) {
        await unsubscribeFromPush();
        button.textContent = "Receber novidades";
        showToast("Notificações desativadas neste dispositivo.", "warning");
      } else {
        await subscribeUserToPush(storeId);
        button.textContent = "Desativar novidades";
        showToast("Novidades ativadas com sucesso.", "success");
      }
    } catch (error) {
      console.error(error);
      showToast(error.message || "Não foi possível alterar o status das notificações.", "danger");
    } finally {
      button.disabled = false;
    }
  });
}
