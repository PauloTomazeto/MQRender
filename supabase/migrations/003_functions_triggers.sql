-- =============================================================================
-- MQPROMP — Funções, Triggers e Automações
-- Versão: 003
-- =============================================================================

-- =============================================================================
-- 1. AUTO-CRIAR PROFILE APÓS SIGNUP NO SUPABASE AUTH
-- =============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );

  -- Cria assinatura Basic gratuita por padrão
  INSERT INTO public.subscriptions (user_id, plan_id, status)
  SELECT NEW.id, sp.id, 'active'
  FROM public.subscription_plans sp
  WHERE sp.name = 'basic'
  LIMIT 1;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- 2. ATUALIZAR updated_at AUTOMATICAMENTE
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Aplica o trigger em todas as tabelas que têm updated_at
CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_projects
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_gen_sessions
  BEFORE UPDATE ON public.generation_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at_subscriptions
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- 3. CONTROLE DE COTA DE IMAGENS
-- =============================================================================

-- Verifica se o usuário pode gerar mais imagens (respeita cota mensal + pacotes)
CREATE OR REPLACE FUNCTION public.can_generate_image(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_tier              subscription_tier;
  v_monthly_quota     INT;
  v_current_usage     INT;
  v_addon_credits     INT;
BEGIN
  SELECT subscription_tier, image_quota_monthly, current_month_usage
  INTO v_tier, v_monthly_quota, v_current_usage
  FROM public.profiles
  WHERE id = p_user_id;

  -- Enterprise: sem limite
  IF v_tier = 'enterprise' THEN
    RETURN TRUE;
  END IF;

  -- Verifica cota mensal
  IF v_monthly_quota > 0 AND v_current_usage < v_monthly_quota THEN
    RETURN TRUE;
  END IF;

  -- Verifica créditos avulsos
  SELECT COALESCE(SUM(amount - used), 0)
  INTO v_addon_credits
  FROM public.image_credits
  WHERE user_id = p_user_id
    AND (expires_at IS NULL OR expires_at > NOW())
    AND type = 'addon_pack'
    AND used < amount;

  RETURN v_addon_credits > 0;
END;
$$;

-- Incrementa uso ao gerar imagem (debita cota mensal primeiro, depois pacotes)
CREATE OR REPLACE FUNCTION public.consume_image_credit(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_monthly_quota   INT;
  v_current_usage   INT;
  v_credit_id       UUID;
BEGIN
  SELECT image_quota_monthly, current_month_usage
  INTO v_monthly_quota, v_current_usage
  FROM public.profiles
  WHERE id = p_user_id
  FOR UPDATE;

  -- Debita cota mensal se disponível
  IF v_monthly_quota > 0 AND v_current_usage < v_monthly_quota THEN
    UPDATE public.profiles
    SET current_month_usage = current_month_usage + 1
    WHERE id = p_user_id;
    RETURN;
  END IF;

  -- Debita pacote avulso mais antigo disponível
  SELECT id INTO v_credit_id
  FROM public.image_credits
  WHERE user_id = p_user_id
    AND type = 'addon_pack'
    AND used < amount
    AND (expires_at IS NULL OR expires_at > NOW())
  ORDER BY purchased_at ASC
  LIMIT 1
  FOR UPDATE;

  IF v_credit_id IS NOT NULL THEN
    UPDATE public.image_credits
    SET used = used + 1
    WHERE id = v_credit_id;
  ELSE
    RAISE EXCEPTION 'Sem créditos disponíveis para gerar imagem';
  END IF;
END;
$$;

-- Trigger: ao completar uma geração de imagem, debita crédito
CREATE OR REPLACE FUNCTION public.on_image_generation_complete()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
BEGIN
  -- Só processa quando muda para 'completed'
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    SELECT user_id INTO v_user_id
    FROM public.generation_sessions
    WHERE id = NEW.session_id;

    PERFORM public.consume_image_credit(v_user_id);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_image_generation_complete
  AFTER UPDATE ON public.image_generations
  FOR EACH ROW EXECUTE FUNCTION public.on_image_generation_complete();

-- =============================================================================
-- 4. RESET MENSAL DE COTAS (para rodar via pg_cron ou Edge Function agendada)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.reset_monthly_quotas()
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Zera o uso mensal de todos os usuários com plano ativo
  UPDATE public.profiles p
  SET
    current_month_usage = 0,
    quota_reset_at = NOW() + INTERVAL '1 month'
  WHERE EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = p.id
      AND s.status = 'active'
      AND s.billing_cycle_end <= NOW()
  );

  -- Avança o ciclo de faturamento
  UPDATE public.subscriptions
  SET
    billing_cycle_start = billing_cycle_end,
    billing_cycle_end   = billing_cycle_end + INTERVAL '1 month',
    updated_at          = NOW()
  WHERE status = 'active'
    AND billing_cycle_end <= NOW();
END;
$$;

-- =============================================================================
-- 5. ESTATÍSTICAS DO USUÁRIO (View)
-- =============================================================================

CREATE OR REPLACE VIEW public.user_stats AS
SELECT
  p.id                                              AS user_id,
  p.email,
  p.name,
  p.subscription_tier,
  p.image_quota_monthly,
  p.current_month_usage,
  p.quota_reset_at,
  COUNT(DISTINCT gs.id)                             AS total_sessions,
  COUNT(DISTINCT gs.id) FILTER (WHERE gs.mode = 'promp') AS promp_sessions,
  COUNT(DISTINCT gs.id) FILTER (WHERE gs.mode = 'move')  AS move_sessions,
  COUNT(DISTINCT ig.id) FILTER (WHERE ig.status = 'completed') AS images_generated,
  COALESCE(SUM(ic.amount - ic.used), 0)            AS addon_credits_remaining,
  p.last_login,
  p.created_at
FROM public.profiles p
LEFT JOIN public.generation_sessions gs ON gs.user_id = p.id
LEFT JOIN public.image_generations ig ON ig.session_id = gs.id
LEFT JOIN public.image_credits ic ON ic.user_id = p.id
  AND (ic.expires_at IS NULL OR ic.expires_at > NOW())
  AND ic.type = 'addon_pack'
GROUP BY p.id;

-- Garante que cada usuário só vê seus próprios dados na view
CREATE OR REPLACE FUNCTION public.user_stats_security_barrier()
RETURNS SETOF public.user_stats
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT * FROM public.user_stats
  WHERE user_id = auth.uid() OR public.is_admin();
$$;

-- =============================================================================
-- 6. BUSCA DE SESSÕES COM DADOS COMPLETOS (para histórico)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_session_summary(p_session_id UUID)
RETURNS JSON
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_result JSON;
BEGIN
  -- Verificação de acesso
  SELECT user_id INTO v_user_id
  FROM public.generation_sessions
  WHERE id = p_session_id;

  IF v_user_id != auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT json_build_object(
    'session',        row_to_json(gs),
    'scan',           row_to_json(s),
    'prompt_output',  row_to_json(po),
    'image_gen',      row_to_json(ig)
  ) INTO v_result
  FROM public.generation_sessions gs
  LEFT JOIN public.scans s ON s.session_id = gs.id
  LEFT JOIN public.prompt_outputs po ON po.session_id = gs.id
  LEFT JOIN public.image_generations ig ON ig.session_id = gs.id AND ig.status = 'completed'
  WHERE gs.id = p_session_id
  LIMIT 1;

  RETURN v_result;
END;
$$;

-- =============================================================================
-- 7. SYNC: ATUALIZAR TIER NO PROFILE QUANDO ASSINATURA MUDA
-- =============================================================================

CREATE OR REPLACE FUNCTION public.sync_profile_subscription_tier()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_tier subscription_tier;
  v_quota INT;
BEGIN
  -- Busca o plano ativo mais recente do usuário
  SELECT sp.name, sp.image_monthly_quota
  INTO v_tier, v_quota
  FROM public.subscriptions sub
  JOIN public.subscription_plans sp ON sp.id = sub.plan_id
  WHERE sub.user_id = NEW.user_id AND sub.status = 'active'
  ORDER BY sub.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    UPDATE public.profiles
    SET
      subscription_tier   = v_tier,
      image_quota_monthly = COALESCE(v_quota, 0)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_subscription_tier
  AFTER INSERT OR UPDATE OF status, plan_id ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_subscription_tier();
