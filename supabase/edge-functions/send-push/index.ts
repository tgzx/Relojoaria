import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "Método não permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return jsonResponse({ error: "Secrets obrigatórios não configurados." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ error: "Authorization ausente." }, 401);
  }

  const token = authorization.replace("Bearer ", "");
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const {
    data: { user },
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return jsonResponse({ error: "Usuário não autenticado." }, 401);
  }

  const body = await request.json().catch(() => null);
  const notificationId = body?.notification_id;

  if (!notificationId) {
    return jsonResponse({ error: "notification_id é obrigatório." }, 400);
  }

  const { data: notification, error: notificationError } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (notificationError || !notification) {
    return jsonResponse({ error: "Notificação não encontrada." }, 404);
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("store_members")
    .select("id, role")
    .eq("store_id", notification.store_id)
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .maybeSingle();

  if (membershipError || !membership) {
    return jsonResponse({ error: "Sem permissão para enviar push nesta loja." }, 403);
  }

  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, subscription")
    .eq("store_id", notification.store_id)
    .eq("is_active", true);

  if (subscriptionsError) {
    return jsonResponse({ error: subscriptionsError.message }, 500);
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    target_url: notification.target_url || "/index.html",
    image: notification.image_url || undefined,
    icon: "/assets/icons/icon-192.png",
    badge: "/assets/icons/icon-192.png"
  });

  const invalidSubscriptionIds: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const item of subscriptions ?? []) {
    try {
      await webpush.sendNotification(item.subscription, payload);
      sent += 1;
    } catch (error) {
      failed += 1;
      const statusCode = error?.statusCode ?? error?.status ?? 500;
      if (statusCode === 404 || statusCode === 410) {
        invalidSubscriptionIds.push(item.id);
      }
      console.error("Falha ao enviar push", {
        endpoint: item.endpoint,
        statusCode,
        message: error?.message
      });
    }
  }

  if (invalidSubscriptionIds.length) {
    await supabaseAdmin
      .from("push_subscriptions")
      .update({ is_active: false })
      .in("id", invalidSubscriptionIds);
  }

  await supabaseAdmin
    .from("notifications")
    .update({
      status: sent > 0 ? "sent" : "failed",
      sent_at: sent > 0 ? new Date().toISOString() : null
    })
    .eq("id", notification.id);

  /*
    Se o pacote web-push tiver incompatibilidade no runtime da Edge Function,
    mantenha esta função como referência e considere migrar o disparo para:
    1. FCM
    2. OneSignal
    3. Um backend Node simples e barato
  */

  return jsonResponse({
    ok: true,
    sent,
    failed,
    invalidated: invalidSubscriptionIds.length
  });
});

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
