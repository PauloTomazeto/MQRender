-- =============================================================================
-- MQPROMP — Must Change Password on First Login
-- Versão: 013
-- Gerado: 2026-03-26
--
-- Adds must_change_password flag to profiles and updates handle_new_user()
-- trigger to set it when an admin creates a user directly with a temp password.
-- =============================================================================

-- =============================================================================
-- 1. ADD COLUMN must_change_password TO profiles
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password IS
  'When true, the user must set a new password before accessing the app. '
  'Set by the handle_new_user trigger when created_by_admin=true in metadata.';

-- =============================================================================
-- 2. UPDATE handle_new_user TRIGGER FUNCTION
--    Now reads created_by_admin from raw_user_meta_data to set must_change_password.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name                TEXT;
  v_role                user_role;
  v_subscription_tier   subscription_tier;
  v_must_change_pw      BOOLEAN;
BEGIN
  v_name              := COALESCE(NEW.raw_user_meta_data->>'name', NEW.email);
  v_role              := COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'user');
  v_subscription_tier := COALESCE((NEW.raw_user_meta_data->>'subscription_tier')::subscription_tier, 'basic');
  v_must_change_pw    := COALESCE((NEW.raw_user_meta_data->>'created_by_admin')::boolean, false);

  INSERT INTO public.profiles (id, email, name, role, subscription_tier, status, must_change_password)
  VALUES (
    NEW.id,
    NEW.email,
    v_name,
    v_role,
    v_subscription_tier,
    'active',
    v_must_change_pw
  )
  ON CONFLICT (id) DO UPDATE
    SET
      name                 = EXCLUDED.name,
      role                 = EXCLUDED.role,
      subscription_tier    = EXCLUDED.subscription_tier,
      email                = EXCLUDED.email,
      must_change_password = EXCLUDED.must_change_password,
      updated_at           = NOW();

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'Creates or updates a profile row when a new auth.users record is inserted. '
  'Reads name, role, subscription_tier, and created_by_admin from raw_user_meta_data. '
  'Sets must_change_password=true when created_by_admin=true.';

-- =============================================================================
-- 3. UPDATE admin_ensure_user_profile TO ACCEPT must_change_password
-- =============================================================================

CREATE OR REPLACE FUNCTION public.admin_ensure_user_profile(
  p_user_id             UUID,
  p_email               TEXT,
  p_name                TEXT,
  p_role                user_role,
  p_subscription_tier   subscription_tier,
  p_must_change_pw      BOOLEAN DEFAULT true
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role, subscription_tier, status, must_change_password)
  VALUES (p_user_id, p_email, p_name, p_role, p_subscription_tier, 'active', p_must_change_pw)
  ON CONFLICT (id) DO UPDATE
    SET
      name                 = EXCLUDED.name,
      role                 = EXCLUDED.role,
      subscription_tier    = EXCLUDED.subscription_tier,
      email                = EXCLUDED.email,
      must_change_password = EXCLUDED.must_change_password,
      updated_at           = NOW();
END;
$$;

COMMENT ON FUNCTION public.admin_ensure_user_profile(UUID, TEXT, TEXT, user_role, subscription_tier, BOOLEAN) IS
  'Upserts a user profile with admin-specified values. Used by the invite-user Edge Function.';

-- =============================================================================
-- 4. GRANT UPDATE PERMISSION ON must_change_password TO authenticated
--    Needed so ForcePasswordChange component can clear the flag after password change.
-- =============================================================================

GRANT UPDATE (must_change_password) ON public.profiles TO authenticated;

-- Note: The existing "profiles_update_own" RLS policy already allows users to
-- update their own profile row (USING id = auth.uid()). The WITH CHECK ensures
-- role stays as 'user', which is correct for all newly created users.
-- No additional policy needed for must_change_password updates.
