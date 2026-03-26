-- =============================================================================
-- MQPROMP — Clear Must Change Password RPC
-- Versão: 016
-- Gerado: 2026-03-26
--
-- Creates a SECURITY DEFINER function to allow users to clear their own
-- must_change_password flag without tripping over RLS role checks.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.clear_must_change_password()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We use auth.uid() so a user can only clear their own flag.
  UPDATE public.profiles
  SET 
    must_change_password = false,
    updated_at = NOW()
  WHERE id = auth.uid();
END;
$$;

COMMENT ON FUNCTION public.clear_must_change_password() IS
  'Allows an authenticated user to clear their must_change_password flag safely bypassing RLS restrictions on role.';

-- Only authenticated users can execute this function
REVOKE EXECUTE ON FUNCTION public.clear_must_change_password FROM public;
GRANT EXECUTE ON FUNCTION public.clear_must_change_password TO authenticated;
