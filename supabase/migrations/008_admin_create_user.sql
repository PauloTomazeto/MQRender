-- =============================================================================
-- MQPROMP — Admin User Invite Support
-- Versão: 008
-- Gerado: 2026-03-25
--
-- Ensures the on_auth_user_created trigger correctly reads plan and role from
-- user_metadata when an admin invites a user via the invite-user Edge Function.
-- =============================================================================

-- =============================================================================
-- 1. UPDATE handle_new_user TRIGGER FUNCTION
--    (Replaces or adds the trigger that fires on auth.users INSERT)
--    Reads raw_user_meta_data for name, role, subscription_tier set by the
--    Edge Function during inviteUserByEmail().
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name              TEXT;
  v_role              user_role;
  v_subscription_tier subscription_tier;
BEGIN
  -- Read values injected by the invite-user Edge Function (or default)
  v_name              := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
  v_role              := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user');
  v_subscription_tier := COALESCE((NEW.raw_user_meta_data->>'subscription_tier')::subscription_tier, 'basic');

  INSERT INTO public.profiles (id, email, name, role, subscription_tier, status)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_role,
    v_subscription_tier,
    'active'
  )
  ON CONFLICT (id) DO UPDATE
    SET
      name              = EXCLUDED.name,
      role              = EXCLUDED.role,
      subscription_tier = EXCLUDED.subscription_tier,
      email             = EXCLUDED.email,
      updated_at        = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates or updates a profile row when a new auth.users record is inserted. '
  'Reads name, role, and subscription_tier from raw_user_meta_data (set by invite-user Edge Function).';

-- Drop and recreate trigger to ensure it uses the updated function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. RPC: admin_invite_user_profile
--    Called by the Edge Function as a fallback to ensure the profile exists
--    with the correct plan after the trigger fires.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_ensure_user_profile(
  p_user_id           UUID,
  p_email             TEXT,
  p_name              TEXT,
  p_role              user_role,
  p_subscription_tier subscription_tier
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, subscription_tier, status)
  VALUES (p_user_id, p_email, p_name, p_role, p_subscription_tier, 'active')
  ON CONFLICT (id) DO UPDATE
    SET
      name              = EXCLUDED.name,
      role              = EXCLUDED.role,
      subscription_tier = EXCLUDED.subscription_tier,
      email             = EXCLUDED.email,
      updated_at        = NOW();
END;
$$;

COMMENT ON FUNCTION public.admin_ensure_user_profile(UUID, TEXT, TEXT, user_role, subscription_tier) IS
  'Upserts a user profile with admin-specified values. Used by the invite-user Edge Function.';
