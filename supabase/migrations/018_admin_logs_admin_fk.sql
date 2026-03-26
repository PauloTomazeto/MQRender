-- Corrige a foreign key admin_id na tabela admin_logs para ON DELETE SET NULL
-- Isso garante que as foreign keys não bloqueiem a exclusão de um administrador.

ALTER TABLE admin_logs
  DROP CONSTRAINT IF EXISTS admin_logs_admin_id_fkey,
  ADD CONSTRAINT admin_logs_admin_id_fkey 
    FOREIGN KEY (admin_id) 
    REFERENCES public.profiles(id) 
    ON DELETE SET NULL;
