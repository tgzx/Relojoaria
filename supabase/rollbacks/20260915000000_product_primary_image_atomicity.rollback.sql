-- Rollback manual da migration 20260915000000_product_primary_image_atomicity.sql.
-- Não altera nem exclui rows de products/product_images e não toca o Storage.
-- Usar somente se o release precisar ser revertido de forma coordenada com o frontend.

-- O frontend publicado que depende destas RPCs deve ser revertido/coordenado antes
-- de tornar este rollback permanente, para evitar chamadas a funções inexistentes.

drop function if exists public.delete_product_image_and_promote(uuid);
drop function if exists public.create_product_image_record(uuid, text, text, text, integer);
drop function if exists public.set_product_primary_image(uuid, uuid);

-- O índice é removido por último. Enquanto existir, ainda protege contra duas
-- imagens principais; removê-lo só faz sentido em rollback completo da feature.
drop index if exists public.uq_product_images_one_primary_per_product;
