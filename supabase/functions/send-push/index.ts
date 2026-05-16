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
    return jsonResponse({ error: "Metodo nao permitido." }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return jsonResponse({ error: "Secrets obrigatorios nao configurados." }, 500);
  }

  const authorization = request.headers.get("Authorization");
  if (!authorization) {
    return jsonResponse({ error: "Authorization ausente." }, 401);
  }

  const token = authorization.replace("Bearer ", "");
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
  const {
    data: { user },
    error: userError
  } = await supabaseAdmin.auth.getUser(token);

  if (userError || !user) {
    return jsonResponse({ error: "Usuario nao autenticado." }, 401);
  }

  const body = await request.json().catch(() => null);
  const notificationId = body?.notification_id;

  if (!notificationId) {
    return jsonResponse({ error: "notification_id e obrigatorio." }, 400);
  }

  const { data: notification, error: notificationError } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("id", notificationId)
    .single();

  if (notificationError || !notification) {
    return jsonResponse({ error: "Notificacao nao encontrada." }, 404);
  }

  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("store_members")
    .select("id, role")
    .eq("store_id", notification.store_id)
    .eq("user_id", user.id)
    .in("role", ["owner", "manager"])
    .maybeSingle();

  if (membershipError || !membership) {
    return jsonResponse({ error: "Sem permissao para enviar push nesta loja." }, 403);
  }

  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, subscription")
    .eq("store_id", notification.store_id)
    .eq("is_active", true);

  if (subscriptionsError) {
    return jsonResponse({ error: subscriptionsError.message }, 500);
  }

  if (!subscriptions?.length) {
    await supabaseAdmin
      .from("notifications")
      .update({
        status: "failed",
        sent_at: null
      })
      .eq("id", notification.id);

    return jsonResponse({
      ok: true,
      sent: 0,
      failed: 0,
      invalidated: 0,
      message: "Nenhum dispositivo inscrito para receber notificacoes."
    });
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

  for (const item of subscriptions) {
    try {
      await webpush.sendNotification(item.subscription, payload, {
        TTL: 60 * 60 * 6
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      const { statusCode, message, body } = getPushErrorInfo(error);
      if (isInvalidSubscriptionStatus(statusCode)) {
        invalidSubscriptionIds.push(item.id);
      }
      console.error("Falha ao enviar push", {
        endpoint: item.endpoint,
        statusCode,
        message,
        body
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

  return jsonResponse({
    ok: true,
    sent,
    failed,
    invalidated: invalidSubscriptionIds.length,
    message:
      sent > 0
        ? undefined
        : invalidSubscriptionIds.length > 0
          ? "Os dispositivos inscritos rejeitaram o push e foram removidos. Peça para os clientes ativarem as notificacoes novamente."
          : "Nao foi possivel entregar a notificacao aos dispositivos inscritos."
  });
});

function isInvalidSubscriptionStatus(statusCode: number) {
  return [404, 410].includes(statusCode);
}

function getPushErrorInfo(error: unknown) {
  if (typeof error === "object" && error !== null) {
    const record = error as { statusCode?: number; status?: number; message?: string; body?: unknown };
    return {
      statusCode: record.statusCode ?? record.status ?? 500,
      message: record.message ?? "Erro desconhecido",
      body: typeof record.body === "string" ? record.body : record.body ? JSON.stringify(record.body) : undefined
    };
  }

  return {
    statusCode: 500,
    message: String(error),
    body: undefined
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
