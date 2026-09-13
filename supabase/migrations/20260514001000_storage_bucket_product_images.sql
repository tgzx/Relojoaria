-- Storage baseline for product images.
-- Supabase creates the storage schema/tables; this migration only ensures the app bucket exists.
-- Policies for storage.objects are defined in the initial schema migration.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'product-images',
  'product-images',
  true,
  null,
  null
)
on conflict (id) do update set
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
