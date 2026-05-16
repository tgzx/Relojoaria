import { APP_CONFIG } from "./config.js";
import { supabase } from "./supabaseClient.js";
import { qs, showToast } from "./utils.js";

function setPushButtonLabel(button, isSubscribed) {
  if (!button) return;

  const fullLabel = isSubscribed ? "Desativar novidades" : "Receber novidades";
  const compactLabel = isSubscribed ? "Silenciar" : "Novidades";

  button.dataset.fullLabel = fullLabel;
  button.dataset.compactLabel = compactLabel;
  button.textContent = fullLabel;
  window.dispatchEvent(new CustomEvent("vitrinezap:header-actions-update"));
}

function setPushButtonBlocked(button) {
  if (!button) return;

  button.dataset.fullLabel = "Notificações bloqueadas";
  button.dataset.compactLabel = "Bloqueadas";
  button.textContent = button.dataset.fullLabel;
  button.title = "Libere notificações nas permissões do navegador para receber novidades.";
  button.disabled = true;
  window.dispatchEvent(new CustomEvent("vitrinezap:header-actions-update"));
}

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

function uint8ArrayToUrlBase64(bytes) {
  const binary = Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("");

  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function subscriptionUsesApplicationServerKey(subscription, applicationServerKey) {
  const subscriptionKey = subscription?.options?.applicationServerKey;
  if (!subscriptionKey) return true;

  return (
    uint8ArrayToUrlBase64(new Uint8Array(subscriptionKey)) ===
    uint8ArrayToUrlBase64(new Uint8Array(applicationServerKey))
  );
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
  const applicationServerKey = urlBase64ToUint8Array(APP_CONFIG.PUBLIC_VAPID_KEY);

  if (existing) {
    if (subscriptionUsesApplicationServerKey(existing, applicationServerKey)) {
      await saveSubscriptionToSupabase(existing, storeId);
      return existing;
    }

    await existing.unsubscribe();
  }

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey
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

  if (Notification.permission === "denied") {
    button.classList.remove("is-hidden");
    setPushButtonBlocked(button);
    return;
  }

  const registration = await navigator.serviceWorker.ready.catch(() => null);
  const existing = registration ? await registration.pushManager.getSubscription() : null;
  const applicationServerKey = APP_CONFIG.PUBLIC_VAPID_KEY
    ? urlBase64ToUint8Array(APP_CONFIG.PUBLIC_VAPID_KEY)
    : null;
  const isCurrentSubscription =
    existing && applicationServerKey
      ? subscriptionUsesApplicationServerKey(existing, applicationServerKey)
      : Boolean(existing);

  button.classList.remove("is-hidden");
  setPushButtonLabel(button, Boolean(isCurrentSubscription));

  button.addEventListener("click", async () => {
    button.disabled = true;

    try {
      const liveRegistration = await navigator.serviceWorker.ready;
      const current = await liveRegistration.pushManager.getSubscription();
      const liveApplicationServerKey = urlBase64ToUint8Array(APP_CONFIG.PUBLIC_VAPID_KEY);

      if (current && subscriptionUsesApplicationServerKey(current, liveApplicationServerKey)) {
        await unsubscribeFromPush();
        setPushButtonLabel(button, false);
        showToast("Notificações desativadas neste dispositivo.", "warning");
      } else {
        await subscribeUserToPush(storeId);
        setPushButtonLabel(button, true);
        showToast("Novidades ativadas com sucesso.", "success");
      }
    } catch (error) {
      console.error(error);
      if (Notification.permission === "denied") {
        setPushButtonBlocked(button);
      }
      showToast(error.message || "Não foi possível alterar o status das notificações.", "danger");
    } finally {
      button.disabled = Notification.permission === "denied";
    }
  });
}
