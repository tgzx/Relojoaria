alter table public.notifications
  add column if not exists scheduled_at timestamptz,
  add column if not exists recurrence_rule text,
  add column if not exists recurrence_next_at timestamptz,
  add column if not exists last_sent_at timestamptz;

alter table public.notifications
  drop constraint if exists notifications_recurrence_rule_check;

alter table public.notifications
  add constraint notifications_recurrence_rule_check
  check (recurrence_rule is null or recurrence_rule in ('daily', 'weekly', 'monthly'));

create index if not exists idx_notifications_schedule
on public.notifications (store_id, status, recurrence_next_at, scheduled_at);
