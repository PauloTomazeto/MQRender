-- =============================================================================
-- MQPROMP — Admin Delete User Policy
-- Versão: 010
-- Gerado: 2026-03-25
--
-- Adds DELETE RLS policy on profiles so admins can remove users,
-- and grants the service_role permission used by the delete-user Edge Function.
-- =============================================================================

-- Allow admins to delete any profile row
CREATE POLICY "profiles_delete_admin"
  ON public.profiles FOR DELETE
  USING (public.is_admin());

-- Edge Function (service_role) needs DELETE grant
GRANT DELETE ON public.profiles TO service_role;

-- Also grant DELETE on auth_sessions for cleanup
GRANT DELETE ON public.auth_sessions TO service_role;
