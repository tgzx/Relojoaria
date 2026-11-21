-- Manual rollback to prior (role-mutable) setting; no data changes.
ALTER FUNCTION public.set_updated_at() RESET search_path;
ALTER FUNCTION public.storage_store_uuid(text) RESET search_path;
ALTER FUNCTION public.validate_product_option_value_store() RESET search_path;
ALTER FUNCTION public.validate_product_option_selection_store() RESET search_path;
