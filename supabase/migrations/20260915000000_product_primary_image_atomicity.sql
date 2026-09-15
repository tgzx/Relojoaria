-- Garante que cada produto tenha no máximo uma imagem principal.
-- Produto sem imagens pode ter zero principais; a aplicação/RPC mantém
-- uma principal nas operações normais quando houver imagens.

create unique index if not exists uq_product_images_one_primary_per_product
  on public.product_images (product_id)
  where is_primary = true;

-- Troca a imagem principal em uma única transação.
-- O lock na row do produto serializa chamadas concorrentes desta RPC por produto.
create or replace function public.set_product_primary_image(
  target_product_id uuid,
  target_image_id uuid
)
returns public.product_images
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_store_id uuid;
  image_store_id uuid;
  image_is_primary boolean;
  updated_image public.product_images;
begin
  select p.store_id
    into product_store_id
  from public.products p
  where p.id = target_product_id
  for update;

  if not found then
    raise exception 'Produto não encontrado ou sem permissão.';
  end if;

  select pi.store_id, pi.is_primary
    into image_store_id, image_is_primary
  from public.product_images pi
  where pi.id = target_image_id
    and pi.product_id = target_product_id
  for update;

  if not found then
    raise exception 'Imagem não encontrada para o produto informado ou sem permissão.';
  end if;

  if image_store_id <> product_store_id then
    raise exception 'Imagem e produto pertencem a lojas diferentes.';
  end if;

  if image_is_primary then
    select pi.*
      into updated_image
    from public.product_images pi
    where pi.id = target_image_id;

    return updated_image;
  end if;

  update public.product_images
  set is_primary = false
  where product_id = target_product_id
    and is_primary = true;

  update public.product_images
  set is_primary = true
  where id = target_image_id
    and product_id = target_product_id
  returning * into updated_image;

  if updated_image.id is null then
    raise exception 'Falha ao definir a imagem principal.';
  end if;

  return updated_image;
end;
$$;

-- A RPC é invoker: as policies de products/product_images continuam sendo a
-- fonte de autorização por loja/role. Restringimos apenas quem pode invocá-la.
revoke execute on function public.set_product_primary_image(uuid, uuid) from public;
revoke execute on function public.set_product_primary_image(uuid, uuid) from anon;
grant execute on function public.set_product_primary_image(uuid, uuid) to authenticated;
grant execute on function public.set_product_primary_image(uuid, uuid) to service_role;

-- Insere uma imagem de produto escolhendo a primeira principal de forma atômica.
-- Chamadas concorrentes para o mesmo produto são serializadas pelo lock do produto.
create or replace function public.create_product_image_record(
  target_product_id uuid,
  target_image_url text,
  target_storage_path text default null,
  target_alt_text text default null,
  target_sort_order integer default 0
)
returns public.product_images
language plpgsql
security invoker
set search_path = public
as $$
declare
  product_store_id uuid;
  has_primary boolean;
  created_image public.product_images;
begin
  select p.store_id
    into product_store_id
  from public.products p
  where p.id = target_product_id
  for update;

  if not found then
    raise exception 'Produto não encontrado ou sem permissão.';
  end if;

  select exists (
    select 1
    from public.product_images pi
    where pi.product_id = target_product_id
      and pi.is_primary = true
  ) into has_primary;

  insert into public.product_images (
    store_id,
    product_id,
    image_url,
    storage_path,
    alt_text,
    is_primary,
    sort_order
  ) values (
    product_store_id,
    target_product_id,
    target_image_url,
    target_storage_path,
    target_alt_text,
    not has_primary,
    coalesce(target_sort_order, 0)
  )
  returning * into created_image;

  return created_image;
end;
$$;

revoke execute on function public.create_product_image_record(uuid, text, text, text, integer) from public;
revoke execute on function public.create_product_image_record(uuid, text, text, text, integer) from anon;
grant execute on function public.create_product_image_record(uuid, text, text, text, integer) to authenticated;
grant execute on function public.create_product_image_record(uuid, text, text, text, integer) to service_role;

-- Exclui uma imagem e promove a próxima principal dentro da mesma transação.
-- A limpeza do blob no Storage continua fora desta função, após o commit do banco.
create or replace function public.delete_product_image_and_promote(
  target_image_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  target_product_id uuid;
  product_store_id uuid;
  deleted_image public.product_images;
  promoted_image public.product_images;
begin
  select pi.product_id
    into target_product_id
  from public.product_images pi
  where pi.id = target_image_id;

  if not found then
    raise exception 'Imagem não encontrada ou sem permissão.';
  end if;

  select p.store_id
    into product_store_id
  from public.products p
  where p.id = target_product_id
  for update;

  if not found then
    raise exception 'Produto não encontrado ou sem permissão.';
  end if;

  select pi.*
    into deleted_image
  from public.product_images pi
  where pi.id = target_image_id
    and pi.product_id = target_product_id
  for update;

  if not found then
    raise exception 'Imagem não encontrada ou já removida.';
  end if;

  if deleted_image.store_id <> product_store_id then
    raise exception 'Imagem e produto pertencem a lojas diferentes.';
  end if;

  if deleted_image.is_primary then
    select pi.*
      into promoted_image
    from public.product_images pi
    where pi.product_id = target_product_id
      and pi.id <> target_image_id
    order by pi.sort_order asc, pi.created_at asc, pi.id asc
    for update
    limit 1;
  end if;

  delete from public.product_images
  where id = target_image_id;

  if deleted_image.is_primary and promoted_image.id is not null then
    update public.product_images
    set is_primary = true
    where id = promoted_image.id
    returning * into promoted_image;
  end if;

  return jsonb_build_object(
    'deleted_image', to_jsonb(deleted_image),
    'promoted_image', case
      when promoted_image.id is null then null
      else to_jsonb(promoted_image)
    end
  );
end;
$$;

revoke execute on function public.delete_product_image_and_promote(uuid) from public;
revoke execute on function public.delete_product_image_and_promote(uuid) from anon;
grant execute on function public.delete_product_image_and_promote(uuid) to authenticated;
grant execute on function public.delete_product_image_and_promote(uuid) to service_role;
