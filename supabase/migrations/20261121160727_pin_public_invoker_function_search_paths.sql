-- Four SECURITY INVOKER functions use only pg_catalog builtins or qualified table names.
-- Prevent role-controlled name resolution without changing the function bodies or RLS.
ALTER FUNCTION public.set_updated_at() SET search_path = '';
ALTER FUNCTION public.storage_store_uuid(text) SET search_path = '';
ALTER FUNCTION public.validate_product_option_value_store() SET search_path = '';
ALTER FUNCTION public.validate_product_option_selection_store() SET search_path = '';

DO $verify$
DECLARE
  missing_count integer;
BEGIN
  SELECT count(*) INTO missing_count
  FROM pg_proc p
  WHERE p.oid IN (
    'public.set_updated_at()'::regprocedure,
    'public.storage_store_uuid(text)'::regprocedure,
    'public.validate_product_option_value_store()'::regprocedure,
    'public.validate_product_option_selection_store()'::regprocedure
  ) AND (p.prosecdef OR NOT EXISTS (
    SELECT 1 FROM unnest(p.proconfig) AS setting
    WHERE setting LIKE 'search_path=%'
  ));
  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Unexpected function security or search_path setting';
  END IF;
END
$verify$;
