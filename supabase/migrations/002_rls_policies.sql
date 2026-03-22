-- =============================================================================
-- MQPROMP — Row Level Security (RLS)
-- Versão: 002
-- =============================================================================
-- Regra geral: usuário só vê/edita seus próprios dados.
-- Admin vê tudo (via role = 'admin' no profiles).
-- =============================================================================

-- Helper function: verifica se o usuário autenticado é admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Helper function: retorna o user_id autenticado com cast para UUID
CREATE OR REPLACE FUNCTION public.current_user_id()
RETURNS UUID
LANGUAGE sql STABLE
AS $$
  SELECT auth.uid()
$$;

-- =============================================================================
-- HABILITAR RLS EM TODAS AS TABELAS
-- =============================================================================

ALTER TABLE public.profiles                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auth_sessions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_plans          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_credits               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.images                      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scans                       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_materials              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_openings               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_camera                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_light                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_light_points           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_context                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.floor_plan_environments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_configs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.light_point_configs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mirror_configs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_outputs              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_blocks               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.image_generations           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_production_analyses    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_production_pipeline    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detail_scans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.detail_closes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_scans                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suggested_movements         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_configs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_outputs                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.move_output_options         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_logs                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_call_logs                ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- PROFILES
-- =============================================================================

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = 'user'); -- Não pode alterar o próprio role

CREATE POLICY "profiles_update_admin"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- Trigger: criado automaticamente via handle_new_user() (ver 003_functions.sql)

-- =============================================================================
-- AUTH_SESSIONS
-- =============================================================================

CREATE POLICY "auth_sessions_own"
  ON public.auth_sessions FOR ALL
  USING (user_id = auth.uid() OR public.is_admin());

-- =============================================================================
-- SUBSCRIPTION_PLANS (Leitura pública)
-- =============================================================================

CREATE POLICY "plans_read_all"
  ON public.subscription_plans FOR SELECT
  TO authenticated, anon
  USING (is_active = TRUE);

CREATE POLICY "plans_manage_admin"
  ON public.subscription_plans FOR ALL
  USING (public.is_admin());

-- =============================================================================
-- SUBSCRIPTIONS
-- =============================================================================

CREATE POLICY "subscriptions_own"
  ON public.subscriptions FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "subscriptions_insert_own"
  ON public.subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "subscriptions_update_admin"
  ON public.subscriptions FOR UPDATE
  USING (public.is_admin());

-- =============================================================================
-- IMAGE_CREDITS
-- =============================================================================

CREATE POLICY "credits_own"
  ON public.image_credits FOR ALL
  USING (user_id = auth.uid() OR public.is_admin());

-- =============================================================================
-- PROJECTS
-- =============================================================================

CREATE POLICY "projects_own"
  ON public.projects FOR ALL
  USING (user_id = auth.uid() OR public.is_admin());

-- =============================================================================
-- GENERATION_SESSIONS
-- =============================================================================

CREATE POLICY "gen_sessions_own"
  ON public.generation_sessions FOR ALL
  USING (user_id = auth.uid() OR public.is_admin());

-- =============================================================================
-- IMAGES
-- =============================================================================

CREATE POLICY "images_own"
  ON public.images FOR ALL
  USING (user_id = auth.uid() OR public.is_admin());

-- =============================================================================
-- SCANS E SUB-TABELAS (acesso via session → user)
-- =============================================================================

CREATE POLICY "scans_own"
  ON public.scans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.generation_sessions gs
      WHERE gs.id = scans.session_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "scan_materials_own"
  ON public.scan_materials FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.generation_sessions gs ON gs.id = s.session_id
      WHERE s.id = scan_materials.scan_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "scan_openings_own"
  ON public.scan_openings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.generation_sessions gs ON gs.id = s.session_id
      WHERE s.id = scan_openings.scan_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "scan_camera_own"
  ON public.scan_camera FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.generation_sessions gs ON gs.id = s.session_id
      WHERE s.id = scan_camera.scan_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "scan_light_own"
  ON public.scan_light FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.generation_sessions gs ON gs.id = s.session_id
      WHERE s.id = scan_light.scan_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "scan_light_points_own"
  ON public.scan_light_points FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.generation_sessions gs ON gs.id = s.session_id
      WHERE s.id = scan_light_points.scan_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "scan_context_own"
  ON public.scan_context FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.generation_sessions gs ON gs.id = s.session_id
      WHERE s.id = scan_context.scan_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "floor_plan_env_own"
  ON public.floor_plan_environments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.scans s
      JOIN public.generation_sessions gs ON gs.id = s.session_id
      WHERE s.id = floor_plan_environments.scan_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

-- =============================================================================
-- PROMPT CONFIGS E SUB-TABELAS
-- =============================================================================

CREATE POLICY "prompt_configs_own"
  ON public.prompt_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.generation_sessions gs
      WHERE gs.id = prompt_configs.session_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "light_point_configs_own"
  ON public.light_point_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.prompt_configs pc
      JOIN public.generation_sessions gs ON gs.id = pc.session_id
      WHERE pc.id = light_point_configs.prompt_config_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "mirror_configs_own"
  ON public.mirror_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.prompt_configs pc
      JOIN public.generation_sessions gs ON gs.id = pc.session_id
      WHERE pc.id = mirror_configs.prompt_config_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

-- =============================================================================
-- PROMPT OUTPUTS
-- =============================================================================

CREATE POLICY "prompt_outputs_own"
  ON public.prompt_outputs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.generation_sessions gs
      WHERE gs.id = prompt_outputs.session_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "prompt_blocks_own"
  ON public.prompt_blocks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.prompt_outputs po
      JOIN public.generation_sessions gs ON gs.id = po.session_id
      WHERE po.id = prompt_blocks.prompt_output_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

-- =============================================================================
-- IMAGE GENERATIONS & PÓS-PRODUÇÃO
-- =============================================================================

CREATE POLICY "img_gen_own"
  ON public.image_generations FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.generation_sessions gs
      WHERE gs.id = image_generations.session_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "post_prod_own"
  ON public.post_production_analyses FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.image_generations ig
      JOIN public.generation_sessions gs ON gs.id = ig.session_id
      WHERE ig.id = post_production_analyses.image_generation_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "post_prod_pipeline_own"
  ON public.post_production_pipeline FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.post_production_analyses ppa
      JOIN public.image_generations ig ON ig.id = ppa.image_generation_id
      JOIN public.generation_sessions gs ON gs.id = ig.session_id
      WHERE ppa.id = post_production_pipeline.post_production_analysis_id
        AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

-- =============================================================================
-- DETAIL SCANS
-- =============================================================================

CREATE POLICY "detail_scans_own"
  ON public.detail_scans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.generation_sessions gs
      WHERE gs.id = detail_scans.session_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "detail_closes_own"
  ON public.detail_closes FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.detail_scans ds
      JOIN public.generation_sessions gs ON gs.id = ds.session_id
      WHERE ds.id = detail_closes.detail_scan_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

-- =============================================================================
-- MOVE MODE
-- =============================================================================

CREATE POLICY "move_scans_own"
  ON public.move_scans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.generation_sessions gs
      WHERE gs.id = move_scans.session_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "suggested_movements_own"
  ON public.suggested_movements FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.move_scans ms
      JOIN public.generation_sessions gs ON gs.id = ms.session_id
      WHERE ms.id = suggested_movements.move_scan_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "move_configs_own"
  ON public.move_configs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.generation_sessions gs
      WHERE gs.id = move_configs.session_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "move_outputs_own"
  ON public.move_outputs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.generation_sessions gs
      WHERE gs.id = move_outputs.session_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

CREATE POLICY "move_output_options_own"
  ON public.move_output_options FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.move_outputs mo
      JOIN public.generation_sessions gs ON gs.id = mo.session_id
      WHERE mo.id = move_output_options.move_output_id AND (gs.user_id = auth.uid() OR public.is_admin())
    )
  );

-- =============================================================================
-- LOGS (admin only para admin_logs, próprio para ai_call_logs)
-- =============================================================================

CREATE POLICY "admin_logs_admin_only"
  ON public.admin_logs FOR ALL
  USING (public.is_admin());

CREATE POLICY "ai_call_logs_own"
  ON public.ai_call_logs FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

CREATE POLICY "ai_call_logs_insert"
  ON public.ai_call_logs FOR INSERT
  WITH CHECK (user_id = auth.uid());
