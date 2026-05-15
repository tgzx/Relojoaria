-- Verificações rápidas do setup VitrineZap

select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'stores',
    'store_settings',
    'categories',
    'brands',
    'products',
    'product_images',
    'product_sections',
    'section_products',
    'push_subscriptions',
    'notifications'
  )
order by table_name;

select id, name, slug, owner_id, is_active
from public.stores
order by created_at desc;

select store_id, whatsapp_number, intro_mode, hero_mode, enable_notifications
from public.store_settings
order by created_at desc;

select id, name, slug, is_active, is_archived, price
from public.products
order by created_at desc
limit 10;

select store_id, user_id, role, created_at
from public.store_members
order by created_at desc;

select id, email
from auth.users
order by created_at desc
limit 10;
