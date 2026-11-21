-- Manual rollback: restore exactly the original explicit and PUBLIC EXECUTE grants.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM supabase_auth_admin;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO PUBLIC, anon, authenticated;
