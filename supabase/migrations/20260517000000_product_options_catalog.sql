-- Catalogo gerenciavel de caracteristicas e variacoes de produto.
-- Mantem compatibilidade com products.attributes e products.variants.

create table if not exists public.product_option_groups (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  type text not null check (type in ('attribute', 'variant')),
  name text not null,
  slug text not null,
  description text,
  input_type text not null default 'select' check (input_type in ('select', 'multi_select', 'text')),
  value_type text not null default 'text' check (value_type in ('text', 'number', 'boolean', 'json')),
  allow_custom_value boolean not null default false,
  show_on_product boolean not null default true,
  use_as_filter boolean not null default false,
  is_required boolean not null default false,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_groups_store_type_slug_key unique (store_id, type, slug)
);

create table if not exists public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  label text not null,
  value text not null,
  description text,
  metadata jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_values_group_value_key unique (group_id, value)
);

create table if not exists public.product_option_selections (
  id uuid primary key default gen_random_uuid(),
  store_id uuid not null references public.stores(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  group_id uuid not null references public.product_option_groups(id) on delete cascade,
  value_id uuid references public.product_option_values(id) on delete restrict,
  custom_value jsonb,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_option_selections_value_or_custom_check check (value_id is not null or custom_value is not null)
);

create unique index if not exists idx_product_option_groups_store_type_slug
  on public.product_option_groups (store_id, type, slug);
create index if not exists idx_product_option_groups_store_type_active_sort
  on public.product_option_groups (store_id, type, is_active, sort_order);
create index if not exists idx_product_option_values_group_active_sort
  on public.product_option_values (group_id, is_active, sort_order);
create index if not exists idx_product_option_values_store_active
  on public.product_option_values (store_id, is_active);
create index if not exists idx_product_option_selections_product_group
  on public.product_option_selections (product_id, group_id, sort_order);
create index if not exists idx_product_option_selections_store_product
  on public.product_option_selections (store_id, product_id);
create unique index if not exists idx_product_option_selections_product_group_value
  on public.product_option_selections (product_id, group_id, value_id)
  where value_id is not null;

create or replace function public.validate_product_option_value_store()
returns trigger
language plpgsql
as $$
begin
  if not exists (
    select 1
    from public.product_option_groups g
    where g.id = new.group_id
      and g.store_id = new.store_id
  ) then
    raise exception 'Valor de opcao pertence a uma loja diferente do grupo.';
  end if;

  return new;
end;
$$;

create or replace function public.validate_product_option_selection_store()
returns trigger
language plpgsql
as $$
declare
  group_store uuid;
  product_store uuid;
  value_store uuid;
  value_group uuid;
begin
  select p.store_id into product_store
  from public.products p
  where p.id = new.product_id;

  if product_store is null or product_store <> new.store_id then
    raise exception 'Produto da selecao pertence a uma loja diferente.';
  end if;

  select g.store_id into group_store
  from public.product_option_groups g
  where g.id = new.group_id;

  if group_store is null or group_store <> new.store_id then
    raise exception 'Grupo da selecao pertence a uma loja diferente.';
  end if;

  if new.value_id is not null then
    select v.store_id, v.group_id into value_store, value_group
    from public.product_option_values v
    where v.id = new.value_id;

    if value_store is null or value_store <> new.store_id or value_group <> new.group_id then
      raise exception 'Valor da selecao pertence a outro grupo ou loja.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists product_option_groups_set_updated_at on public.product_option_groups;
create trigger product_option_groups_set_updated_at before update on public.product_option_groups for each row execute procedure public.set_updated_at();

drop trigger if exists product_option_values_set_updated_at on public.product_option_values;
create trigger product_option_values_set_updated_at before update on public.product_option_values for each row execute procedure public.set_updated_at();

drop trigger if exists product_option_selections_set_updated_at on public.product_option_selections;
create trigger product_option_selections_set_updated_at before update on public.product_option_selections for each row execute procedure public.set_updated_at();

drop trigger if exists product_option_values_validate_store on public.product_option_values;
create trigger product_option_values_validate_store before insert or update on public.product_option_values for each row execute procedure public.validate_product_option_value_store();

drop trigger if exists product_option_selections_validate_store on public.product_option_selections;
create trigger product_option_selections_validate_store before insert or update on public.product_option_selections for each row execute procedure public.validate_product_option_selection_store();

alter table public.product_option_groups enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_option_selections enable row level security;

drop policy if exists "product_option_groups_public_select_active" on public.product_option_groups;
create policy "product_option_groups_public_select_active"
on public.product_option_groups
for select
to anon, authenticated
using (
  (
    is_active = true
    and show_on_product = true
    and exists (select 1 from public.stores s where s.id = product_option_groups.store_id and s.is_active = true)
  )
  or public.is_store_member(product_option_groups.store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "product_option_groups_manage_members" on public.product_option_groups;
create policy "product_option_groups_manage_members"
on public.product_option_groups
for all
to authenticated
using (public.is_store_member(product_option_groups.store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(product_option_groups.store_id, array['owner', 'manager', 'editor']));

drop policy if exists "product_option_values_public_select_active" on public.product_option_values;
create policy "product_option_values_public_select_active"
on public.product_option_values
for select
to anon, authenticated
using (
  (
    is_active = true
    and exists (
      select 1
      from public.product_option_groups g
      join public.stores s on s.id = g.store_id
      where g.id = product_option_values.group_id
        and g.store_id = product_option_values.store_id
        and g.is_active = true
        and g.show_on_product = true
        and s.is_active = true
    )
  )
  or public.is_store_member(product_option_values.store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "product_option_values_manage_members" on public.product_option_values;
create policy "product_option_values_manage_members"
on public.product_option_values
for all
to authenticated
using (public.is_store_member(product_option_values.store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(product_option_values.store_id, array['owner', 'manager', 'editor']));

drop policy if exists "product_option_selections_public_select_active" on public.product_option_selections;
create policy "product_option_selections_public_select_active"
on public.product_option_selections
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products p
    join public.product_option_groups g on g.id = product_option_selections.group_id
    join public.stores s on s.id = p.store_id
    where p.id = product_option_selections.product_id
      and p.store_id = product_option_selections.store_id
      and g.store_id = product_option_selections.store_id
      and p.is_active = true
      and p.is_archived = false
      and g.is_active = true
      and g.show_on_product = true
      and s.is_active = true
  )
  or public.is_store_member(product_option_selections.store_id, array['owner', 'manager', 'editor'])
);

drop policy if exists "product_option_selections_manage_members" on public.product_option_selections;
create policy "product_option_selections_manage_members"
on public.product_option_selections
for all
to authenticated
using (public.is_store_member(product_option_selections.store_id, array['owner', 'manager', 'editor']))
with check (public.is_store_member(product_option_selections.store_id, array['owner', 'manager', 'editor']));
