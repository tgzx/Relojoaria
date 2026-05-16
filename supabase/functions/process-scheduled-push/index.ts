import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return jsonResponse({ error: "Metodo nao permitido." }, 405);

  const cronSecret = Deno.env.get("CRON_SECRET");
  if (cronSecret && request.headers.get("x-cron-secret") !== cronSecret) {
    return jsonResponse({ error: "Cron secret invalido." }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  const vapidSubject = Deno.env.get("VAPID_SUBJECT");

  if (!supabaseUrl || !serviceRoleKey || !vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
    return jsonResponse({ error: "Secrets obrigatorios nao configurados." }, 500);
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const nowIso = new Date().toISOString();

  // Busca notificações agendadas simples e recorrentes vencidas
  // Divide em duas queries para evitar problemas com .or() e interpolação de string
  const { data: simpleNotifications, error: simpleError } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("status", "scheduled")
    .is("recurrence_rule", null)
    .lte("scheduled_at", nowIso)
    .limit(25);

  const { data: recurrentNotifications, error: recurrentError } = await supabaseAdmin
    .from("notifications")
    .select("*")
    .eq("status", "scheduled")
    .not("recurrence_rule", "is", null)
    .lte("recurrence_next_at", nowIso)
    .limit(25);

  if (simpleError || recurrentError) {
    const error = simpleError || recurrentError;
    return jsonResponse({ error: error?.message }, 500);
  }

  const notifications = [...(simpleNotifications || []), ...(recurrentNotifications || [])];

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const results = [];
  for (const notification of notifications || []) {
    const result = await sendScheduledNotification(supabaseAdmin, notification);
    results.push({ id: notification.id, ...result });
  }

  return jsonResponse({ ok: true, processed: results.length, results });
});

async function sendScheduledNotification(supabaseAdmin: ReturnType<typeof createClient>, notification: Record<string, any>) {
  const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
    .from("push_subscriptions")
    .select("id, endpoint, subscription")
    .eq("store_id", notification.store_id)
    .eq("is_active", true);

  if (subscriptionsError) return { sent: 0, failed: 0, error: subscriptionsError.message };

  const payload = JSON.stringify({
    title: notification.title,
    body: notification.body,
    target_url: notification.target_url || "./index.html",
    icon: "/assets/icons/icon-192.png",
    badge: "/assets/icons/icon-192.png"
  });

  const invalidSubscriptionIds: string[] = [];
  let sent = 0;
  let failed = 0;

  for (const item of subscriptions || []) {
    try {
      await webpush.sendNotification(item.subscription, payload, { TTL: 60 * 60 * 6 });
      sent += 1;
    } catch (error) {
      failed += 1;
      const { statusCode, message, body } = getPushErrorInfo(error);
      if ([404, 410].includes(statusCode)) invalidSubscriptionIds.push(item.id);
      console.error("Falha ao enviar push agendado", { endpoint: item.endpoint, statusCode, message, body });
    }
  }

  if (invalidSubscriptionIds.length) {
    await supabaseAdmin.from("push_subscriptions").update({ is_active: false }).in("id", invalidSubscriptionIds);
  }

  const sentAt = new Date().toISOString();
  const recurrenceNextAt = sent > 0 ? getNextRecurrenceDate(notification.recurrence_rule, notification.recurrence_next_at || notification.scheduled_at) : null;

  await supabaseAdmin
    .from("notifications")
    .update({
      status: sent > 0 && notification.recurrence_rule ? "scheduled" : sent > 0 ? "sent" : "failed",
      sent_at: sent > 0 ? sentAt : null,
      last_sent_at: sent > 0 ? sentAt : notification.last_sent_at || null,
      recurrence_next_at: recurrenceNextAt
    })
    .eq("id", notification.id);

  return { sent, failed, invalidated: invalidSubscriptionIds.length };
}

function getNextRecurrenceDate(rule?: string, fromDate?: string) {
  if (!rule) return null;
  
  const next = fromDate ? new Date(fromDate) : new Date();
  const now = new Date();
  
  // Incrementa uma vez a partir da data base
  if (rule === "daily") {
    next.setDate(next.getDate() + 1);
  } else if (rule === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (rule === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else {
    return null;
  }
  
  // Se ainda assim estiver no passado, incrementa até o futuro
  // (para casos onde a loja ficou offline ou cron atrasou muito)
  while (next <= now) {
    if (rule === "daily") next.setDate(next.getDate() + 1);
    else if (rule === "weekly") next.setDate(next.getDate() + 7);
    else if (rule === "monthly") next.setMonth(next.getMonth() + 1);
  }
  
  return next.toISOString();
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

  return { statusCode: 500, message: String(error), body: undefined };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
