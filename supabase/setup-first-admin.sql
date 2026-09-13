-- VitrineZap / Relojoaria — vincular primeiro administrador.
-- Use depois de:
-- 1. aplicar as migrations;
-- 2. criar a loja real ou rodar um seed controlado;
-- 3. criar o usuario em Authentication > Users.
--
-- Troque os valores do CTE `params` antes de executar.
-- Nao grave senhas/tokens neste arquivo.

with params as (
  select
    'COLE_AQUI_O_UUID_DO_AUTH_USER'::uuid as admin_user_id,
    'COLE_AQUI_O_SLUG_DA_LOJA'::text as store_slug,
    'Primeiro Administrador'::text as full_name,
    'owner'::text as admin_role
), upsert_profile as (
  insert into public.profiles (id, full_name)
  select
    admin_user_id,
    full_name
  from params
  on conflict (id) do update set
    full_name = excluded.full_name
  returning id
), target_store as (
  select
    s.id as store_id,
    p.admin_user_id,
    p.admin_role
  from public.stores s
  join params p on p.store_slug = s.slug
  limit 1
), upsert_membership as (
  insert into public.store_members (store_id, user_id, role)
  select
    store_id,
    admin_user_id,
    admin_role
  from target_store
  on conflict (store_id, user_id) do update set
    role = excluded.role
  returning store_id, user_id, role
), update_owner as (
  update public.stores s
  set owner_id = ts.admin_user_id
  from target_store ts
  where s.id = ts.store_id
    and ts.admin_role = 'owner'
  returning s.id, s.name, s.slug, s.owner_id
)
select
  s.id as store_id,
  s.name as store_name,
  s.slug as store_slug,
  sm.user_id,
  sm.role,
  s.owner_id
from public.stores s
left join public.store_members sm on sm.store_id = s.id
where s.slug = (select store_slug from params);
