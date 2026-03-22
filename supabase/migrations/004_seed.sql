-- =============================================================================
-- MQPROMP — Seed: Dados Iniciais
-- Versão: 004
-- =============================================================================

-- =============================================================================
-- PLANOS DE ASSINATURA
-- Baseado em SubscriptionStep.tsx
-- =============================================================================

INSERT INTO public.subscription_plans (name, display_name, price_monthly, description, features, image_monthly_quota)
VALUES

-- BASIC — $157.99/mês
(
  'basic',
  'Basic',
  157.99,
  'Para arquitetos e designers que precisam de prompts profissionais ilimitados.',
  '[
    "Geração de Prompts Ilimitada",
    "Escaneamento de Imagens (Scan)",
    "Acesso ao M&Q Move (Base)",
    "Acesso ao Detail Scan",
    "Suporte via Comunidade"
  ]'::jsonb,
  0  -- Sem geração de imagens
),

-- PREMIUM — $199/mês
(
  'premium',
  'Premium',
  199.00,
  'O plano mais popular. Tudo do Basic mais geração de imagens e suporte prioritário.',
  '[
    "Geração de Prompts Ilimitada",
    "Escaneamento de Imagens (Scan)",
    "Acesso ao M&Q Move Completo",
    "Acesso ao Detail Scan",
    "100 Imagens Geradas por Mês",
    "Prioridade no Processamento",
    "Suporte Prioritário",
    "Acesso a Novos Recursos em Beta"
  ]'::jsonb,
  100  -- 100 imagens/mês
),

-- ENTERPRISE — sob consulta
(
  'enterprise',
  'Enterprise',
  0.00,  -- Preço sob consulta
  'Para escritórios e equipes. Cota personalizada, suporte dedicado e treinamento.',
  '[
    "Tudo do Premium",
    "Cota de Imagens Personalizada",
    "Gerente de Conta Dedicado",
    "Treinamento da Equipe",
    "Integrações Personalizadas",
    "SLA Garantido",
    "Suporte 24/7"
  ]'::jsonb,
  NULL  -- NULL = ilimitado
);

-- =============================================================================
-- PACOTE DE IMAGENS AVULSO (referência para a UI)
-- =============================================================================
-- Nota: Pacotes avulsos são registrados em image_credits por usuário.
-- Aqui apenas documenta o preço no schema para referência.
-- Em produção, o preço seria gerenciado via Stripe products.

COMMENT ON TABLE public.image_credits IS
  'Créditos avulsos de imagem. Pacote padrão: 100 imagens por $59.99 (gerenciado via Stripe).';

-- =============================================================================
-- CONFIGURAÇÃO DO SUPABASE STORAGE BUCKETS
-- =============================================================================
-- Execute no SQL Editor do Supabase Dashboard:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  -- Imagens de entrada (upload do usuário)
  (
    'input-images',
    'input-images',
    FALSE,           -- Privado: acesso via signed URLs
    10485760,        -- 10MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  ),
  -- Imagens geradas pela IA
  (
    'generated-images',
    'generated-images',
    FALSE,
    20971520,        -- 20MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp']
  )
ON CONFLICT (id) DO NOTHING;

-- Políticas de Storage
CREATE POLICY "storage_input_own"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'input-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );

CREATE POLICY "storage_generated_own"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'generated-images'
    AND (storage.foldername(name))[1] = auth.uid()::TEXT
  );
