-- =============================================================================
-- MQv3 — Fix Admin Panel RLS Policies and Missing GRANTs
-- Versão: 014
-- Gerado: 2026-03-26
--
-- Corrige falhas de comunicação entre o painel admin e o banco:
-- 1. subscription_plans: adiciona OR is_admin() para permitir joins em queries admin
-- 2. GRANTs faltantes para role authenticated em tabelas críticas
-- =============================================================================

-- =============================================================================
-- 1. CORRIGIR POLICY "plans_read_all" — ADICIONAR is_admin()
--    Sem isso, embedded joins PostgREST de subscriptions→subscription_plans
--    retornam vazio silenciosamente quando o admin faz queries.
-- =============================================================================

DROP POLICY IF EXISTS "plans_read_all" ON public.subscription_plans;

CREATE POLICY "plans_read_all"
  ON public.subscription_plans FOR SELECT
  TO authenticated, anon
  USING (is_active = TRUE OR public.is_admin());

-- =============================================================================
-- 2. GRANTS FALTANTES PARA TABELAS USADAS PELO PAINEL ADMIN
--    Sem estes GRANTs, PostgREST retorna 403 ou vazio silenciosamente.
-- =============================================================================

-- Profiles (essencial para quase todas as queries)
GRANT SELECT ON public.profiles TO authenticated;
GRANT INSERT, UPDATE ON public.profiles TO authenticated;

-- Configuração de créditos
GRANT SELECT ON public.credit_config TO authenticated, anon;

-- Transações de crédito (leitura pelo admin, escrita pelo sistema)
GRANT SELECT ON public.credit_transactions TO authenticated;
GRANT INSERT ON public.credit_transactions TO authenticated;

-- Sessões e geração de imagens (relatórios)
GRANT SELECT ON public.generation_sessions TO authenticated;
GRANT INSERT ON public.generation_sessions TO authenticated;
GRANT SELECT ON public.image_generations TO authenticated;
GRANT INSERT ON public.image_generations TO authenticated;
GRANT SELECT ON public.prompt_outputs TO authenticated;
GRANT INSERT ON public.prompt_outputs TO authenticated;

-- Logs de admin (somente leitura para authenticated — escrita via service role)
GRANT SELECT ON public.admin_logs TO authenticated;
