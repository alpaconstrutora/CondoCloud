-- ============================================================
-- 031 — STORAGE BUCKET: comprovantes financeiros
-- ============================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'financial-attachments',
  'financial-attachments',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Leitura pública (URL armazenada no DB que já tem RLS)
CREATE POLICY "Public read financial attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'financial-attachments');

-- Upload restrito a usuários autenticados
CREATE POLICY "Authenticated upload financial attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'financial-attachments');

-- Exclusão restrita a usuários autenticados
CREATE POLICY "Authenticated delete financial attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'financial-attachments');
