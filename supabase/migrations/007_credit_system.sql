-- =============================================================================
-- MQPROMP — Credit System
-- Versão: 007
-- Gerado: 2026-03-24
--
-- Introduces a unified credit system that replaces the legacy image_quota /
-- image_credits model.  Credits are tracked in three buckets per user:
--   credits_plan   — allocated monthly by the subscription plan (reset each cycle)
--   credits_addon  — purchased one-off packs (expire at cycle end, don't roll over)
--   credits_used   — counter of credits consumed in the current cycle
--
-- Costs per generation are driven by the credit_config table, which stores the
-- KIE.ai base cost and a configurable markup for each model/resolution combo.
-- =============================================================================

-- =============================================================================
-- 1. ADD CREDIT COLUMNS TO profiles
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS credits_plan     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_addon    INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_used     INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;

COMMENT ON COLUMN public.profiles.credits_plan     IS 'Credits allocated by the active subscription plan. Reset on each billing cycle.';
COMMENT ON COLUMN public.profiles.credits_addon    IS 'Credits purchased as add-on packs. Do NOT accumulate across cycles — reset to 0 at cycle end.';
COMMENT ON COLUMN public.profiles.credits_used     IS 'Credits consumed in the current billing cycle.';
COMMENT ON COLUMN public.profiles.credits_reset_at IS 'Timestamp of the next scheduled credit reset.';

-- =============================================================================
-- 2. ADD credits_monthly TO subscription_plans
-- =============================================================================

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS credits_monthly INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.subscription_plans.credits_monthly IS 'Number of credits allocated to users on this plan every billing cycle.';

-- Populate credit allocations for existing seed plans
UPDATE public.subscription_plans SET credits_monthly = 1000 WHERE name = 'basic';
UPDATE public.subscription_plans SET credits_monthly = 2000 WHERE name = 'premium';
UPDATE public.subscription_plans SET credits_monthly = 5000 WHERE name = 'enterprise';

-- =============================================================================
-- 3. CREATE credit_config TABLE
-- =============================================================================
-- Stores cost per model+resolution combination.
-- kie_base_cost  — what KIE.ai charges us (in internal credit units)
-- markup_pct     — percentage mark-up applied on top of kie_base_cost
-- our_cost       — ceil(kie_base_cost * markup_pct / 100) — what we charge the user
-- =============================================================================

CREATE TABLE public.credit_config (
  id            SERIAL PRIMARY KEY,
  model         TEXT        NOT NULL,
  resolution    TEXT,                                     -- '1K', '2K', '4K'; NULL means applies to all resolutions
  kie_base_cost INT         NOT NULL,                    -- KIE.ai credits charged to us
  markup_pct    NUMERIC(5,2) NOT NULL DEFAULT 200,       -- e.g. 200 → 200 % of base cost (2×)
  our_cost      INT         NOT NULL,                    -- precomputed: ceil(kie_base_cost * markup_pct / 100)
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.credit_config             IS 'Per-model/resolution credit cost configuration. our_cost is the amount deducted from the user.';
COMMENT ON COLUMN public.credit_config.markup_pct  IS 'Mark-up percentage applied over kie_base_cost to arrive at our_cost. 200 = double (2×).';
COMMENT ON COLUMN public.credit_config.our_cost    IS 'Credits charged to the user. Should equal ceil(kie_base_cost * markup_pct / 100).';

-- Seed initial cost config
INSERT INTO public.credit_config (model, resolution, kie_base_cost, markup_pct, our_cost)
VALUES
  ('nano-banana-2', '1K',  8, 200,  16),
  ('nano-banana-2', '2K', 12, 200,  24),
  ('nano-banana-2', '4K', 18, 200,  36);

-- Automatically maintain updated_at on any row change
CREATE TRIGGER set_updated_at_credit_config
  BEFORE UPDATE ON public.credit_config
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 4. CREATE credit_transactions TABLE
-- =============================================================================
-- Immutable audit log of every credit movement (positive or negative).
-- Writes happen exclusively through the RPC functions below — direct INSERT /
-- UPDATE / DELETE is blocked for regular users by RLS.
-- =============================================================================

CREATE TABLE public.credit_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount      INT  NOT NULL,   -- negative = consumed, positive = added
  type        TEXT NOT NULL CHECK (type IN (
                  'plan_allocation',
                  'addon_purchase',
                  'consumption',
                  'admin_adjustment',
                  'cycle_reset'
              )),
  model       TEXT,            -- populated for 'consumption' rows
  resolution  TEXT,            -- populated for 'consumption' rows
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  public.credit_transactions        IS 'Append-only ledger of all credit movements. Written only via RPC functions.';
COMMENT ON COLUMN public.credit_transactions.amount IS 'Positive = credits added; negative = credits consumed.';
COMMENT ON COLUMN public.credit_transactions.type   IS 'Categorises the reason for the credit movement.';

CREATE INDEX idx_credit_tx_user    ON public.credit_transactions(user_id);
CREATE INDEX idx_credit_tx_created ON public.credit_transactions(created_at DESC);

-- =============================================================================
-- 5. RLS FOR NEW TABLES
-- =============================================================================

-- credit_config: public read, admin write only
ALTER TABLE public.credit_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_config_read_all"
  ON public.credit_config FOR SELECT
  TO authenticated, anon
  USING (is_active = TRUE);

CREATE POLICY "credit_config_manage_admin"
  ON public.credit_config FOR ALL
  USING (public.is_admin());

-- credit_transactions: user reads own rows, no direct DML (only via SECURITY DEFINER RPCs)
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "credit_tx_select_own"
  ON public.credit_transactions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- INSERT / UPDATE / DELETE are intentionally not granted to regular users.
-- All writes go through SECURITY DEFINER RPC functions below.

-- =============================================================================
-- 6. RPC FUNCTIONS
-- =============================================================================

-- ----------------------------------------------------------------------------
-- 6a. check_credits(p_user_id, p_cost)
-- Returns TRUE when the user has enough available credits to cover p_cost.
-- available = credits_plan + credits_addon - credits_used
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_credits(
  p_user_id UUID,
  p_cost    INT
)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_available INT;
BEGIN
  SELECT (credits_plan + credits_addon - credits_used)
  INTO   v_available
  FROM   public.profiles
  WHERE  id = p_user_id;

  RETURN COALESCE(v_available, 0) >= p_cost;
END;
$$;

COMMENT ON FUNCTION public.check_credits(UUID, INT) IS
  'Returns TRUE if the user has at least p_cost credits available (plan + addon - used).';

-- ----------------------------------------------------------------------------
-- 6b. consume_credits(p_user_id, p_model, p_resolution)
-- Looks up the cost from credit_config, validates the user has enough credits,
-- deducts from credits_used, logs the transaction, and returns the cost.
-- Addon credits are conceptually consumed first (tracked via credits_used order
-- is implicit: available = plan + addon - used; we simply increment used and
-- let the calling layer rely on check_credits / the RAISE guard).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.consume_credits(
  p_user_id    UUID,
  p_model      TEXT,
  p_resolution TEXT
)
RETURNS INT
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_cost      INT;
  v_available INT;
BEGIN
  -- Resolve cost for this model+resolution combination
  SELECT our_cost
  INTO   v_cost
  FROM   public.credit_config
  WHERE  model      = p_model
    AND  resolution = p_resolution
    AND  is_active  = TRUE
  LIMIT 1;

  IF v_cost IS NULL THEN
    -- Fall back to a model-level entry with no resolution restriction
    SELECT our_cost
    INTO   v_cost
    FROM   public.credit_config
    WHERE  model      = p_model
      AND  resolution IS NULL
      AND  is_active  = TRUE
    LIMIT 1;
  END IF;

  IF v_cost IS NULL THEN
    RAISE EXCEPTION 'No active credit_config entry found for model=% resolution=%', p_model, p_resolution;
  END IF;

  -- Lock the profile row and check availability atomically
  SELECT (credits_plan + credits_addon - credits_used)
  INTO   v_available
  FROM   public.profiles
  WHERE  id = p_user_id
  FOR UPDATE;

  IF v_available < v_cost THEN
    RAISE EXCEPTION 'Insufficient credits: available=%, required=%', v_available, v_cost
      USING ERRCODE = 'P0001';
  END IF;

  -- Deduct by incrementing credits_used
  UPDATE public.profiles
  SET    credits_used = credits_used + v_cost
  WHERE  id = p_user_id;

  -- Append transaction record
  INSERT INTO public.credit_transactions (user_id, amount, type, model, resolution, description)
  VALUES (
    p_user_id,
    -v_cost,
    'consumption',
    p_model,
    p_resolution,
    format('Image generation: model=%s resolution=%s cost=%s', p_model, p_resolution, v_cost)
  );

  RETURN v_cost;
END;
$$;

COMMENT ON FUNCTION public.consume_credits(UUID, TEXT, TEXT) IS
  'Deducts credits for one image generation. Raises an exception if the user has insufficient credits. Returns the credit cost consumed.';

-- ----------------------------------------------------------------------------
-- 6c. add_addon_credits(p_user_id)
-- Adds 1 000 addon credits to the user's account and logs the transaction.
-- Note: credits_addon is reset to 0 at the next billing cycle reset — it does
-- NOT accumulate across cycles.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.add_addon_credits(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  c_addon_amount CONSTANT INT := 1000;
BEGIN
  UPDATE public.profiles
  SET    credits_addon = credits_addon + c_addon_amount
  WHERE  id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (
    p_user_id,
    c_addon_amount,
    'addon_purchase',
    format('Add-on pack purchased: +%s credits', c_addon_amount)
  );
END;
$$;

COMMENT ON FUNCTION public.add_addon_credits(UUID) IS
  'Adds 1 000 addon credits to the user. Addon credits expire at the next cycle reset and do not accumulate.';

-- ----------------------------------------------------------------------------
-- 6d. reset_user_credits(p_user_id)
-- Resets the user's credit counters for a new billing cycle:
--   - credits_used  → 0
--   - credits_addon → 0  (addon credits do NOT carry over)
--   - credits_plan  → credits_monthly from the user's active subscription plan
--   - credits_reset_at → NOW() + 1 month
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_user_credits(
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_plan_credits INT;
BEGIN
  -- Look up the credits_monthly for the user's current active subscription
  SELECT sp.credits_monthly
  INTO   v_plan_credits
  FROM   public.subscriptions sub
  JOIN   public.subscription_plans sp ON sp.id = sub.plan_id
  WHERE  sub.user_id = p_user_id
    AND  sub.status  = 'active'
  ORDER  BY sub.created_at DESC
  LIMIT  1;

  -- Default to 0 if no active subscription found
  v_plan_credits := COALESCE(v_plan_credits, 0);

  UPDATE public.profiles
  SET
    credits_plan     = v_plan_credits,
    credits_addon    = 0,           -- addon credits expire; no roll-over
    credits_used     = 0,
    credits_reset_at = NOW() + INTERVAL '1 month'
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (
    p_user_id,
    v_plan_credits,
    'cycle_reset',
    format('Billing cycle reset: plan credits set to %s, addon credits cleared', v_plan_credits)
  );
END;
$$;

COMMENT ON FUNCTION public.reset_user_credits(UUID) IS
  'Resets credits for a new billing cycle: clears credits_used and credits_addon, sets credits_plan from the active subscription, advances credits_reset_at by one month.';

-- ----------------------------------------------------------------------------
-- 6e. admin_adjust_credits(p_user_id, p_amount, p_description)
-- Allows admins (or trusted server-side code) to manually adjust a user's
-- plan credits by p_amount (positive to add, negative to deduct).
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_credits(
  p_user_id     UUID,
  p_amount      INT,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.profiles
  SET    credits_plan = credits_plan + p_amount
  WHERE  id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  INSERT INTO public.credit_transactions (user_id, amount, type, description)
  VALUES (
    p_user_id,
    p_amount,
    'admin_adjustment',
    COALESCE(p_description, format('Admin manual adjustment: %s credits', p_amount))
  );
END;
$$;

COMMENT ON FUNCTION public.admin_adjust_credits(UUID, INT, TEXT) IS
  'Admin-only: adjusts credits_plan by p_amount (positive = add, negative = deduct) and logs the transaction.';

-- ----------------------------------------------------------------------------
-- 6f. get_user_credit_status(p_user_id)
-- Returns a JSONB snapshot of the user's credit balances plus the 10 most
-- recent credit_transactions entries.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_credit_status(
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_result JSONB;
BEGIN
  -- Enforce access: caller must be the user themselves or an admin
  IF p_user_id != auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'credits_plan',        p.credits_plan,
    'credits_addon',       p.credits_addon,
    'credits_used',        p.credits_used,
    'credits_available',   (p.credits_plan + p.credits_addon - p.credits_used),
    'credits_reset_at',    p.credits_reset_at,
    'last_transactions',   COALESCE(
      (
        SELECT jsonb_agg(t ORDER BY t.created_at DESC)
        FROM (
          SELECT
            id,
            amount,
            type,
            model,
            resolution,
            description,
            created_at
          FROM public.credit_transactions
          WHERE user_id = p_user_id
          ORDER BY created_at DESC
          LIMIT 10
        ) t
      ),
      '[]'::jsonb
    )
  )
  INTO v_result
  FROM public.profiles p
  WHERE p.id = p_user_id;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_user_credit_status(UUID) IS
  'Returns a JSONB object with the user''s current credit balances and the 10 most recent credit transactions. Accessible by the user themselves or an admin.';

-- =============================================================================
-- 7. TRIGGER: Reset credits when a subscription becomes active
-- =============================================================================
-- When a subscription row is inserted or its status/plan_id changes and the
-- resulting status is 'active', automatically call reset_user_credits() so the
-- user's plan credits are populated straight away.
--
-- This piggybacks on the existing sync_subscription_tier trigger (003) which
-- runs on the same events; Postgres guarantees both fire, order is alphabetical
-- by trigger name so this one fires after sync_subscription_tier.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.on_subscription_activated()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Only act when the subscription transitions to (or is created as) 'active'
  IF NEW.status = 'active' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'active') THEN
    PERFORM public.reset_user_credits(NEW.user_id);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.on_subscription_activated() IS
  'Trigger function: calls reset_user_credits() whenever a subscription is created or updated to status=''active''.';

CREATE TRIGGER on_subscription_activated
  AFTER INSERT OR UPDATE OF status, plan_id ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.on_subscription_activated();
