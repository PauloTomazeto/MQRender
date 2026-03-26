-- =============================================================================
-- SCRIPT DE LIMPEZA DE USUÁRIOS — Executar MANUALMENTE no SQL Editor do Supabase
-- NÃO é uma migration. Executar UMA VEZ após validar o novo sistema.
--
-- PRESERVA: paulosilvatomazeto@gmail.com
-- DELETA: todos os demais usuários (cascade em profiles e tabelas filhas)
-- =============================================================================

-- PASSO 1: Confirmar que o admin está presente (execute e verifique antes de continuar)
SELECT id, email, role
FROM public.profiles
WHERE email = 'paulosilvatomazeto@gmail.com';
-- Resultado esperado: 1 linha com role = 'admin'
-- Se não aparecer, NÃO execute o PASSO 2.

-- =============================================================================
-- PASSO 2: Deletar todos os usuários EXCETO paulosilvatomazeto@gmail.com
-- CASCADE limpa automaticamente: profiles, subscriptions, generation_sessions,
-- images, scans, credits, admin_logs (onde FK tem ON DELETE CASCADE).
-- =============================================================================

BEGIN;

DELETE FROM auth.users
WHERE id NOT IN (
  SELECT id FROM public.profiles
  WHERE email = 'paulosilvatomazeto@gmail.com'
);

-- Verificações (execute antes do COMMIT):
SELECT count(*) AS total_profiles FROM public.profiles;
-- Esperado: 1

SELECT email FROM public.profiles;
-- Esperado: paulosilvatomazeto@gmail.com

SELECT count(*) AS total_auth_users FROM auth.users;
-- Esperado: 1

-- Se tudo estiver correto:
COMMIT;

-- Para cancelar (se algo estiver errado):
-- ROLLBACK;
