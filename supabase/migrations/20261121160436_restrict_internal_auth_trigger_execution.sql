-- J Gold release hardening: internal Supabase Auth trigger is not a public RPC.
-- No row/data changes. Preserve trigger execution for Auth and service roles.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;

DO $verify$
BEGIN
  IF has_function_privilege('anon', 'public.handle_new_user()', 'EXECUTE')
    OR has_function_privilege('authenticated', 'public.handle_new_user()', 'EXECUTE')
    OR NOT has_function_privilege('supabase_auth_admin', 'public.handle_new_user()', 'EXECUTE')
  THEN
    RAISE EXCEPTION 'Unexpected EXECUTE grants for handle_new_user()';
  END IF;
END
$verify$;
