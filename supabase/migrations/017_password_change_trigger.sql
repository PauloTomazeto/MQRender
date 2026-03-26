-- =============================================================================
-- MQPROMP — Password Change Trigger
-- Versão: 017
-- Gerado: 2026-03-26
--
-- Cria um trigger em auth.users para automaticamente definir 
-- must_change_password = false quando a senha for alterada.
-- Isso previne qualquer race condition no frontend.
-- =============================================================================

-- Função que o trigger executa
CREATE OR REPLACE FUNCTION public.handle_password_update()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Se o encrypted_password mudou, e o novo não é nulo
  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    UPDATE public.profiles
    SET must_change_password = false,
        updated_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_password_update() IS
  'Trigger function to clear must_change_password flat in public.profiles when auth.users.encrypted_password changes';

-- Gatilho (Trigger) na tabela auth.users
DROP TRIGGER IF EXISTS tr_auth_users_password_update ON auth.users;

CREATE TRIGGER tr_auth_users_password_update
AFTER UPDATE ON auth.users
FOR EACH ROW
WHEN (NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password)
EXECUTE FUNCTION public.handle_password_update();
