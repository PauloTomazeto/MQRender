-- =============================================================================
-- Migration: Sistema de Convites de Usuários
-- Permite que novos usuários criem sua senha no primeiro acesso
-- =============================================================================

-- Tabela de convites
CREATE TABLE IF NOT EXISTS public.user_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    target_plan TEXT NOT NULL,
    target_role TEXT DEFAULT 'user',
    expires_at TIMESTAMPTZ NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para buscar convites por token
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON public.user_invites(token);

-- Índice para buscar convites por email
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON public.user_invites(email);

-- Índice para buscar convites pendentes
CREATE INDEX IF NOT EXISTS idx_user_invites_pending ON public.user_invites(email, used) WHERE used = FALSE;

-- RLS Policies
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- Apenas admins podem gerenciar convites (insert, update, delete)
CREATE POLICY "Admins can manage invites" ON public.user_invites
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Qualquer pessoa pode verificar um convite pelo token (SELECT)
-- Isso é necessário para a página de aceite de convite
CREATE POLICY "Anyone can view invite by token" ON public.user_invites
    FOR SELECT
    USING (true);

-- Função para limpar convites expirados (manutenção)
CREATE OR REPLACE FUNCTION public.cleanup_expired_invites()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count integer;
BEGIN
    DELETE FROM public.user_invites
    WHERE expires_at < NOW() OR (used = TRUE AND used_at < NOW() - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;

-- Job para limpar convites expirados (executar diariamente)
-- Nota: Agendar via external cron ou Supabase Scheduling
-- SELECT public.cleanup_expired_invites();

-- Comentários
COMMENT ON TABLE public.user_invites IS 'Armazena convites para novos usuários criarem senha no primeiro acesso';
COMMENT ON COLUMN public.user_invites.token IS 'Token único UUID v4 para o link de convite';
COMMENT ON COLUMN public.user_invites.expires_at IS 'Data/hora de expiração do convite (padrão: 24 horas)';
COMMENT ON COLUMN public.user_invites.used IS 'Se true, o convite já foi utilizado';
COMMENT ON COLUMN public.user_invites.used_at IS 'Quando o convite foi utilizado';
