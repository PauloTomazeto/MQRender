-- =============================================================================
-- MQv3 — Fix admin_logs FK to allow user deletion without constraint violation
-- Versão: 015
-- Gerado: 2026-03-26
--
-- admin_logs.target_user_id referencia profiles(id) sem ON DELETE SET NULL.
-- Quando um usuário é excluído (cascade profiles), qualquer insert posterior
-- em admin_logs viola a FK. Esta migration torna a FK tolerante a deleções.
-- =============================================================================

ALTER TABLE public.admin_logs
  DROP CONSTRAINT IF EXISTS admin_logs_target_user_id_fkey;

ALTER TABLE public.admin_logs
  ADD CONSTRAINT admin_logs_target_user_id_fkey
    FOREIGN KEY (target_user_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
