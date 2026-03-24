-- =============================================================================
-- MQPROMP — Storage: bucket input-images + políticas para KIE.ai temp upload
-- Versão: 006
-- =============================================================================

-- ── Criar bucket input-images (se ainda não existir) ─────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'input-images',
  'input-images',
  false,                             -- privado: acesso via signed URL
  31457280,                          -- 30 MB
  ARRAY['image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- ── Políticas de Storage (storage.objects) ───────────────────────────────────

-- 1. Upload: usuário autenticado pode fazer upload das suas imagens
CREATE POLICY "storage_input_images_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'input-images'
    AND auth.uid() IS NOT NULL
  );

-- 2. Leitura/assinatura: usuário autenticado pode ler seus próprios arquivos
CREATE POLICY "storage_input_images_select"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'input-images'
    AND auth.uid() IS NOT NULL
  );

-- 3. Exclusão: usuário autenticado pode deletar seus arquivos (limpeza do kie-temp)
CREATE POLICY "storage_input_images_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'input-images'
    AND auth.uid() IS NOT NULL
  );
