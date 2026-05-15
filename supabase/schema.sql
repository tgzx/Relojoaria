create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete set null,
  name text not null,
  slug text not null unique,
  slogan text,
  description text,
  logo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.store_members (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (store_id, user_id)
);

create table if not exists public.store_settings (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null unique references public.stores(id) on delete cascade,
  whatsapp_number text,
  whatsapp_default_message text,
  instagram_url text,
  address text,
  business_hours jsonb not null default '{}'::jsonb,
  primary_color text not null default '#111827',
  secondary_color text not null default '#f97316',
  theme_mode text not null default 'light',
  intro_mode text not null default 'logo',
  hero_mode text not null default 'banner',
  enable_notifications boolean not null default true,
  enable_favorites boolean not null default true,
  enable_future_cart_flag boolean not null default false,
  currency text not null default 'BRL',
  locale text not null default 'pt-BR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  image_url text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  name text not null,
  slug text not null,
  logo_url text,
  is_featured boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  brand_id uuid references public.brands(id) on delete set null,
  name text not null,
  slug text not null,
  sku text,
  short_description text,
  description text,
  price numeric(12,2) not null default 0,
  old_price numeric(12,2),
  cost_price numeric(12,2),
  stock_quantity integer not null default 0,
  stock_status text not null default 'in_stock' check (stock_status in ('in_stock', 'low_stock', 'out_of_stock', 'preorder')),
  is_active boolean not null default true,
  is_archived boolean not null default false,
  is_featured boolean not null default false,
  is_new boolean not null default false,
  is_best_seller boolean not null default false,
  is_promotion boolean not null default false,
  allow_whatsapp_cta boolean not null default true,
  tags text[] not null default '{}'::text[],
  attributes jsonb not null default '{}'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  sort_order integer not null default 0,
  view_count integer not null default 0,
  interest_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table if not exists public.product_images (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  storage_path text,
  alt_text text,
  is_primary boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.product_sections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  slug text not null,
  description text,
  type text not null default 'custom',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  selection_mode text not null default 'manual' check (selection_mode in ('manual', 'automatic')),
  automatic_rule text,
  automatic_params jsonb not null default '{}'::jsonb,
  max_items integer not null default 12,
  layout text not null default 'horizontal_carousel' check (layout in ('horizontal_carousel', 'grid', 'compact_list', 'hero_cards')),
  refresh_frequency text not null default 'manual' check (refresh_frequency in ('manual', 'daily', 'weekly')),
  last_refreshed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_id, slug)
);

create table if not exists public.section_products (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  section_id uuid not null references public.product_sections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (section_id, product_id)
);

create table if not exists public.banners (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text,
  subtitle text,
  image_url text,
  target_url text,
  target_type text,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  user_agent text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  title text not null,
  body text not null,
  target_url text,
  image_url text,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'sent', 'failed')),
  sent_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.future_carts (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  anonymous_id text,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'draft',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.future_cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.future_carts(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  quantity integer not null default 1,
  unit_price numeric(12,2),
  selected_variant jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_store_member(target_store_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_members sm
    where sm.store_id = target_store_id
      and sm.user_id = auth.uid()
      and sm.role = any (allowed_roles)
  );
$$;

create or replace function public.storage_store_uuid(object_name text)
returns uuid
language plpgsql
immutable
as $$
declare
  extracted uuid;
begin
  extracted := nullif(split_part(object_name, '/', 2), '')::uuid;
  return extracted;
exception
  when others then
    return null;
end;
$$;

create or replace function public.increment_product_view(target_product_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.products
  set view_count = view_count + 1
  where id = target_product_id
    and is_active = true
    and is_archived = false
  returning view_count into updated_count;

  return coalesce(updated_count, 0);
end;
$$;

create or replace function public.increment_product_interest(target_product_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.products
  set interest_count = interest_count + 1
  where id = target_product_id
    and is_active = true
    and is_archived = false
  returning interest_count into updated_count;

  return coalesce(updated_count, 0);
end;
$$;

create or replace function public.public_deactivate_push_subscription(target_endpoint text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.push_subscriptions
  set is_active = false,
      updated_at = now()
  where endpoint = target_endpoint;

  return true;
end;
$$;

create or replace function public.public_upsert_push_subscription(
  target_store_id uuid,
  target_endpoint text,
  target_subscription jsonb,
  target_user_agent text default null
)
returns public.push_subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_row public.push_subscriptions;
begin
  if not exists (
    select 1
    from public.stores s
    where s.id = target_store_id
      and s.is_active = true
  ) then
    raise exception 'Loja inválida para inscrição push.';
  end if;

  insert into public.push_subscriptions (
    store_id,
    endpoint,
    subscription,
    user_agent,
    is_active
  )
  values (
    target_store_id,
    target_endpoint,
    target_subscription,
    target_user_agent,
    true
  )
  on conflict (endpoint)
  do update set
    store_id = excluded.store_id,
    subscription = excluded.subscription,
    user_agent = excluded.user_agent,
    is_active = true,
    updated_at = now()
  returning * into saved_row;

  return saved_row;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();

drop trigger if exists stores_set_updated_at on public.stores;
create trigger stores_set_updated_at before update on public.stores for each row execute procedure public.set_updated_at();

drop trigger if exists store_settings_set_updated_at on public.store_settings;
create trigger store_settings_set_updated_at before update on public.store_settings for each row execute procedure public.set_updated_at();

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories for each row execute procedure public.set_updated_at();

drop trigger if exists brands_set_updated_at on public.brands;
create trigger brands_set_updated_at before update on public.brands for each row execute procedure public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at before update on public.products for each row execute procedure public.set_updated_at();

drop trigger if exists product_sections_set_updated_at on public.product_sections;
create trigger product_sections_set_updated_at before update on public.product_sections for each row execute procedure public.set_updated_at();

drop trigger if exists banners_set_updated_at on public.banners;
create trigger banners_set_updated_at before update on public.banners for each row execute procedure public.set_updated_at();

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at before update on public.push_subscriptions for each row execute procedure public.set_updated_at();

drop trigger if exists notifications_set_updated_at on public.notifications;
create trigger notifications_set_updated_at before update on public.notifications for each row execute procedure public.set_updated_at();

drop trigger if exists future_carts_set_updated_at on public.future_carts;
create trigger future_carts_set_updated_at before update on public.future_carts for each row execute procedure public.set_updated_at();

drop trigger if exists future_cart_items_set_updated_at on public.future_cart_items;
create trigger future_cart_items_set_updated_at before update on public.future_cart_items for each row execute procedure public.set_updated_at();

create index if not exists idx_products_store_active_archived on public.products (store_id, is_active, is_archived);
create index if not exists idx_products_store_category on public.products (store_id, category_id);
create index if not exists idx_products_store_brand on public.products (store_id, brand_id);
create index if not exists idx_products_store_featured on public.products (store_id, is_featured);
create index if not exists idx_products_store_promotion on public.products (store_id, is_promotion);
create index if not exists idx_products_store_new on public.products (store_id, is_new);
create index if not exists idx_product_sections_store_active_sort on public.product_sections (store_id, is_active, sort_order);
create index if not exists idx_section_products_section_sort on public.section_products (section_id, sort_order);
create index if not exists idx_categories_store_active_sort on public.categories (store_id, is_active, sort_order);
create index if not exists idx_brands_store_active_sort on public.brands (store_id, is_active, sort_order);
create index if not exists idx_product_images_product on public.product_images (product_id, is_primary, sort_order);
create index if not exists idx_push_subscriptions_store_active on public.push_subscriptions (store_id, is_active);
create index if not exists idx_notifications_store_status on public.notifications (store_id, status);

alter table public.profiles enable row level security;
alter table public.stores enable row level security;
alter table public.store_members enable row level security;
alter table public.store_settings enable row level security;
alter table public.categories enable row level security;
alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_sections enable row level security;
alter table public.section_products enable row level security;
alter table public.banners enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.future_carts enable row level security;
alter table public.future_cart_items enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "stores_public_select_active" on public.stores;
create policy "stores_public_select_active"
on public.stores
for select
to anon, authenticated
using (
  is_active = true
  or public.is_store_member(id, array['owner', 'manager', 'editor', 'viewer'])
);

drop policy if exists "stores_insert_owner" on public.stores;
create policy "stores_insert_owner"
on public.stores
for insert
to authenticated
with check (
  owner_id = auth.uid()
);

drop policy if exists "stores_update_owner_manager" on public.stores;
create policy "stores_update_owner_manager"
on public.stores
for update
to authenticated
using (public.is_store_member(id, array['owner', 'manager']))
with check (public.is_store_member(id, array['owner', 'manager']));

drop policy if exists "store_members_select_own_or_managers" on public.store_members;
create policy "store_members_select_own_or_managers"
on public.store_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_store_member(store_id, array['owner', 'manager'])
);

drop policy if exists "store_members_manage_owner_manager" on public.store_members;
create policy "store_members_manage_owner_manager"
on public.store_members
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager']))
with check (public.is_store_member(store_id, array['owner', 'manager']));

drop policy if exists "store_settings_public_select_active_store" on public.store_settings;
create policy "store_settings_public_select_active_store"
on public.store_settings
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.stores s
    where s.id = store_id
      and (
        s.is_active = true
        or public.is_store_member(s.id, array['owner', 'manager', 'editor', 'viewer'])
      )
  )
);

drop policy if exists "store_settings_manage_owner_manager" on public.store_settings;
create policy "store_settings_manage_owner_manager"
on public.store_settings
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager']))
with check (public.is_store_member(store_id, array['owner', 'manager']));

drop policy if exists "categories_public_select_active" on public.categories;
create policy "categories_public_select_active"
on public.categories
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1 from public.stores s where s.id = store_id and s.is_active = true
  )
  or public.is_store_member(store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "categories_manage_members" on public.categories;
create policy "categories_manage_members"
on public.categories
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(store_id, array['owner', 'manager', 'editor']));

drop policy if exists "brands_public_select_active" on public.brands;
create policy "brands_public_select_active"
on public.brands
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1 from public.stores s where s.id = store_id and s.is_active = true
  )
  or public.is_store_member(store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "brands_manage_members" on public.brands;
create policy "brands_manage_members"
on public.brands
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(store_id, array['owner', 'manager', 'editor']));

drop policy if exists "products_public_select_active" on public.products;
create policy "products_public_select_active"
on public.products
for select
to anon, authenticated
using (
  (
    is_active = true
    and is_archived = false
    and exists (
      select 1 from public.stores s where s.id = store_id and s.is_active = true
    )
  )
  or public.is_store_member(store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "products_manage_members" on public.products;
create policy "products_manage_members"
on public.products
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(store_id, array['owner', 'manager', 'editor']));

drop policy if exists "product_images_public_select_active" on public.product_images;
create policy "product_images_public_select_active"
on public.product_images
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    join public.stores s on s.id = p.store_id
    where p.id = product_id
      and p.is_active = true
      and p.is_archived = false
      and s.is_active = true
  )
  or public.is_store_member(store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "product_images_manage_members" on public.product_images;
create policy "product_images_manage_members"
on public.product_images
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(store_id, array['owner', 'manager', 'editor']));

drop policy if exists "product_sections_public_select_active" on public.product_sections;
create policy "product_sections_public_select_active"
on public.product_sections
for select
to anon, authenticated
using (
  (
    is_active = true
    and exists (
      select 1 from public.stores s where s.id = store_id and s.is_active = true
    )
  )
  or public.is_store_member(store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "product_sections_manage_members" on public.product_sections;
create policy "product_sections_manage_members"
on public.product_sections
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(store_id, array['owner', 'manager', 'editor']));

drop policy if exists "section_products_public_select_active" on public.section_products;
create policy "section_products_public_select_active"
on public.section_products
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.product_sections ps
    join public.products p on p.id = product_id
    join public.stores s on s.id = ps.store_id
    where ps.id = section_id
      and ps.is_active = true
      and p.is_active = true
      and p.is_archived = false
      and s.is_active = true
  )
  or public.is_store_member(store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "section_products_manage_members" on public.section_products;
create policy "section_products_manage_members"
on public.section_products
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(store_id, array['owner', 'manager', 'editor']));

drop policy if exists "banners_public_select_active" on public.banners;
create policy "banners_public_select_active"
on public.banners
for select
to anon, authenticated
using (
  (
    is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at >= now())
    and exists (
      select 1 from public.stores s where s.id = store_id and s.is_active = true
    )
  )
  or public.is_store_member(store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "banners_manage_members" on public.banners;
create policy "banners_manage_members"
on public.banners
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(store_id, array['owner', 'manager', 'editor']));

drop policy if exists "push_subscriptions_public_insert" on public.push_subscriptions;
create policy "push_subscriptions_public_insert"
on public.push_subscriptions
for insert
to anon, authenticated
with check (
  exists (
    select 1 from public.stores s where s.id = store_id and s.is_active = true
  )
);

drop policy if exists "push_subscriptions_owner_manager_select" on public.push_subscriptions;
create policy "push_subscriptions_owner_manager_select"
on public.push_subscriptions
for select
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager']));

drop policy if exists "push_subscriptions_owner_manager_update" on public.push_subscriptions;
create policy "push_subscriptions_owner_manager_update"
on public.push_subscriptions
for update
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager']))
with check (public.is_store_member(store_id, array['owner', 'manager']));

drop policy if exists "notifications_owner_manager_manage" on public.notifications;
create policy "notifications_owner_manager_manage"
on public.notifications
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager']))
with check (public.is_store_member(store_id, array['owner', 'manager']));

drop policy if exists "audit_logs_owner_manager_select" on public.audit_logs;
create policy "audit_logs_owner_manager_select"
on public.audit_logs
for select
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager']));

drop policy if exists "audit_logs_member_insert" on public.audit_logs;
create policy "audit_logs_member_insert"
on public.audit_logs
for insert
to authenticated
with check (public.is_store_member(store_id, array['owner', 'manager', 'editor']));

drop policy if exists "future_carts_owner_manager_manage" on public.future_carts;
create policy "future_carts_owner_manager_manage"
on public.future_carts
for all
to authenticated
using (public.is_store_member(store_id, array['owner', 'manager']))
with check (public.is_store_member(store_id, array['owner', 'manager']));

drop policy if exists "future_cart_items_owner_manager_manage" on public.future_cart_items;
create policy "future_cart_items_owner_manager_manage"
on public.future_cart_items
for all
to authenticated
using (
  exists (
    select 1
    from public.future_carts fc
    where fc.id = cart_id
      and public.is_store_member(fc.store_id, array['owner', 'manager'])
  )
)
with check (
  exists (
    select 1
    from public.future_carts fc
    where fc.id = cart_id
      and public.is_store_member(fc.store_id, array['owner', 'manager'])
  )
);

drop policy if exists "storage_public_read_product_images" on storage.objects;
create policy "storage_public_read_product_images"
on storage.objects
for select
to public
using (bucket_id = 'product-images');

drop policy if exists "storage_members_insert_product_images" on storage.objects;
create policy "storage_members_insert_product_images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and public.is_store_member(public.storage_store_uuid(name), array['owner', 'manager', 'editor'])
);

drop policy if exists "storage_members_update_product_images" on storage.objects;
create policy "storage_members_update_product_images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_store_member(public.storage_store_uuid(name), array['owner', 'manager', 'editor'])
)
with check (
  bucket_id = 'product-images'
  and public.is_store_member(public.storage_store_uuid(name), array['owner', 'manager', 'editor'])
);

drop policy if exists "storage_members_delete_product_images" on storage.objects;
create policy "storage_members_delete_product_images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and public.is_store_member(public.storage_store_uuid(name), array['owner', 'manager', 'editor'])
);
