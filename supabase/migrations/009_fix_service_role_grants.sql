-- =============================================================================
-- MQPROMP — Fix service_role grants for Edge Functions
-- Versão: 009
-- Gerado: 2026-03-25
--
-- Edge Functions use the service_role key which bypasses RLS but still needs
-- explicit GRANT on tables to perform queries via PostgREST.
-- =============================================================================

GRANT SELECT                    ON public.subscription_plans   TO service_role;
GRANT SELECT, INSERT, UPDATE    ON public.profiles             TO service_role;
GRANT SELECT, INSERT            ON public.subscriptions        TO service_role;
GRANT SELECT, INSERT            ON public.admin_logs           TO service_role;
GRANT SELECT, UPDATE            ON public.credit_transactions  TO service_role;
