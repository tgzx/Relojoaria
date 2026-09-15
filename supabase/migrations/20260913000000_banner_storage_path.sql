-- Track managed Supabase Storage objects for banner lifecycle cleanup.
-- Additive and backward-compatible: external banner URLs remain valid with storage_path = null.

alter table public.banners
  add column if not exists storage_path text;

-- Conservative backfill only for URLs that clearly belong to the managed public bucket.
update public.banners
set storage_path = split_part(image_url, '/storage/v1/object/public/product-images/', 2)
where storage_path is null
  and image_url like '%/storage/v1/object/public/product-images/stores/%';

create index if not exists idx_banners_storage_path
  on public.banners (storage_path)
  where storage_path is not null;
