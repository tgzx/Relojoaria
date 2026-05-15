-- VitrineZap PWA
-- Use este arquivo depois de:
-- 1. rodar schema.sql
-- 2. rodar seed.sql (ou criar a loja manualmente)
-- 3. criar o usuario em Authentication > Users
--
-- Este arquivo usa o slug da loja para evitar depender de um UUID fixo.
-- Se voce estiver usando o seed padrao, o slug esperado e: minha-loja.

insert into public.profiles (id, full_name)
values (
  'be699091-9f12-4e92-bba8-d30dd94dac6c',
  'Primeiro Gerente'
)
on conflict (id) do update set
  full_name = excluded.full_name;

with target_store as (
  select id
  from public.stores
  where slug = 'minha-loja'
  limit 1
)
insert into public.store_members (store_id, user_id, role)
select
  target_store.id,
  'be699091-9f12-4e92-bba8-d30dd94dac6c'::uuid,
  'owner'
from target_store
on conflict (store_id, user_id) do update set
  role = excluded.role;

update public.stores
set owner_id = 'be699091-9f12-4e92-bba8-d30dd94dac6c'
where slug = 'minha-loja';

select
  s.id as store_id,
  s.name as store_name,
  s.slug as store_slug,
  sm.user_id,
  sm.role
from public.stores s
left join public.store_members sm on sm.store_id = s.id
where s.slug = 'minha-loja';
