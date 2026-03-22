-- =============================================================================
-- MQPROMP — Jobs Agendados (pg_cron)
-- Versão: 005
-- Requer extensão pg_cron habilitada no Supabase
-- Dashboard → Database → Extensions → pg_cron
-- =============================================================================

-- Habilitar pg_cron
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Reset de cotas mensais — roda todo dia 1 às 00:00 UTC
SELECT cron.schedule(
  'reset-monthly-quotas',
  '0 0 1 * *',
  $$SELECT public.reset_monthly_quotas()$$
);

-- Limpar sessões de auth expiradas — roda todo dia às 03:00 UTC
SELECT cron.schedule(
  'cleanup-expired-sessions',
  '0 3 * * *',
  $$
    DELETE FROM public.auth_sessions
    WHERE expires_at < NOW()
  $$
);

-- Desbloquear usuários após período de lockout — roda a cada 5 minutos
SELECT cron.schedule(
  'unblock-users',
  '*/5 * * * *',
  $$
    UPDATE public.auth_sessions
    SET failed_attempts = 0, blocked_until = NULL
    WHERE blocked_until IS NOT NULL AND blocked_until < NOW()
  $$
);

-- Expirar assinaturas vencidas — roda todo dia às 01:00 UTC
SELECT cron.schedule(
  'expire-subscriptions',
  '0 1 * * *',
  $$
    UPDATE public.subscriptions
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND billing_cycle_end < NOW()
      AND auto_renew = FALSE
  $$
);

-- Relatório diário de uso de API (logs de auditoria — reter 90 dias)
SELECT cron.schedule(
  'cleanup-old-ai-logs',
  '0 4 * * *',
  $$
    DELETE FROM public.ai_call_logs
    WHERE created_at < NOW() - INTERVAL '90 days'
  $$
);
