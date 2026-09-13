grant execute on function public.public_upsert_push_subscription(uuid, text, jsonb, text) to anon, authenticated;
grant execute on function public.public_deactivate_push_subscription(text) to anon, authenticated;

create index if not exists idx_push_subscriptions_endpoint_active
on public.push_subscriptions (endpoint, is_active);
