-- =============================================================================
-- Fix: grant SELECT/INSERT/UPDATE to authenticated role on all app tables
-- Sem isso o PostgREST bloqueia queries do cliente JS mesmo com RLS correto.
-- =============================================================================

GRANT SELECT ON public.subscriptions          TO authenticated, anon;
GRANT SELECT ON public.subscription_plans     TO authenticated, anon;
GRANT SELECT ON public.ai_call_logs           TO authenticated;
GRANT SELECT ON public.image_generations      TO authenticated;
GRANT SELECT ON public.generation_sessions    TO authenticated;
GRANT SELECT ON public.prompt_outputs         TO authenticated;
GRANT SELECT ON public.admin_logs             TO authenticated;
GRANT SELECT ON public.auth_sessions          TO authenticated;

GRANT INSERT, UPDATE ON public.subscriptions  TO authenticated;
GRANT INSERT        ON public.ai_call_logs    TO authenticated;
