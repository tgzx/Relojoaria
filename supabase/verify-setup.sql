-- Verificacoes rapidas do setup VitrineZap / Relojoaria.
-- Use depois de aplicar as migrations em um projeto Supabase novo.
-- Este script e somente leitura.

-- 1) Tabelas publicas esperadas
select
  table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'stores',
    'store_members',
    'store_settings',
    'categories',
    'brands',
    'products',
    'product_images',
    'product_sections',
    'section_products',
    'banners',
    'push_subscriptions',
    'notifications',
    'audit_logs',
    'future_carts',
    'future_cart_items',
    'product_option_groups',
    'product_option_values',
    'product_option_selections'
  )
order by table_name;

-- 2) Contagem esperada de tabelas publicas principais = 19
select
  count(*) as public_table_count
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'profiles',
    'stores',
    'store_members',
    'store_settings',
    'categories',
    'brands',
    'products',
    'product_images',
    'product_sections',
    'section_products',
    'banners',
    'push_subscriptions',
    'notifications',
    'audit_logs',
    'future_carts',
    'future_cart_items',
    'product_option_groups',
    'product_option_values',
    'product_option_selections'
  );

-- 3) RLS ativo nas tabelas publicas principais
select
  n.nspname as schema_name,
  c.relname as table_name,
  c.relrowsecurity as rls_enabled
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relname in (
    'profiles',
    'stores',
    'store_members',
    'store_settings',
    'categories',
    'brands',
    'products',
    'product_images',
    'product_sections',
    'section_products',
    'banners',
    'push_subscriptions',
    'notifications',
    'audit_logs',
    'future_carts',
    'future_cart_items',
    'product_option_groups',
    'product_option_values',
    'product_option_selections'
  )
order by c.relname;

-- 4) Funcoes/RPCs criticas
select
  n.nspname as schema_name,
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments,
  pg_get_function_result(p.oid) as result_type
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in (
    'set_updated_at',
    'handle_new_user',
    'is_store_member',
    'storage_store_uuid',
    'increment_product_view',
    'increment_product_interest',
    'public_upsert_push_subscription',
    'public_deactivate_push_subscription',
    'set_product_primary_image',
    'create_product_image_record',
    'delete_product_image_and_promote',
    'validate_product_option_value_store',
    'validate_product_option_selection_store'
  )
order by p.proname;

-- 5) Policies publicas/admin esperadas por tabela
select
  schemaname,
  tablename,
  policyname,
  cmd
from pg_policies
where schemaname in ('public', 'storage')
order by schemaname, tablename, policyname;

-- 6) Bucket usado pelo app
select
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
from storage.buckets
where id = 'product-images';

-- 7) Lojas existentes
select
  id,
  name,
  slug,
  owner_id,
  is_active,
  created_at
from public.stores
order by created_at desc;

-- 8) Configuracoes de loja
select
  store_id,
  whatsapp_number,
  intro_mode,
  hero_mode,
  enable_notifications,
  enable_favorites,
  enable_future_cart_flag,
  currency,
  locale
from public.store_settings
order by created_at desc;

-- 9) Usuarios e vinculos administrativos
select
  store_id,
  user_id,
  role,
  created_at
from public.store_members
order by created_at desc;

-- 10) Volumes principais por loja
select
  s.slug,
  (select count(*) from public.categories c where c.store_id = s.id) as categories_count,
  (select count(*) from public.brands b where b.store_id = s.id) as brands_count,
  (select count(*) from public.products p where p.store_id = s.id) as products_count,
  (select count(*) from public.product_images pi where pi.store_id = s.id) as product_images_count,
  (select count(*) from public.banners ba where ba.store_id = s.id) as banners_count,
  (select count(*) from public.notifications n where n.store_id = s.id) as notifications_count,
  (select count(*) from public.push_subscriptions ps where ps.store_id = s.id) as push_subscriptions_count,
  (select count(*) from public.product_option_groups pog where pog.store_id = s.id) as product_option_groups_count,
  (select count(*) from public.product_option_values pov where pov.store_id = s.id) as product_option_values_count,
  (select count(*) from public.product_option_selections pos where pos.store_id = s.id) as product_option_selections_count
from public.stores s
order by s.created_at desc;

-- 11) Atomicidade da imagem principal
select
  indexname,
  indexdef
from pg_indexes
where schemaname = 'public'
  and tablename = 'product_images'
  and indexname = 'uq_product_images_one_primary_per_product';

select
  (select count(*) from (
    select product_id
    from public.product_images
    where is_primary = true
    group by product_id
    having count(*) > 1
  ) duplicated) as products_with_multiple_primaries,
  (select count(*) from (
    select p.id
    from public.products p
    join public.product_images pi on pi.product_id = p.id
    where not exists (
      select 1
      from public.product_images p2
      where p2.product_id = p.id
        and p2.is_primary = true
    )
    group by p.id
  ) without_primary) as products_with_images_no_primary,
  (select count(*)
   from public.product_images pi
   join public.products p on p.id = pi.product_id
   where pi.store_id <> p.store_id) as store_mismatch_rows;