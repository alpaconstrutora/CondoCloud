-- ============================================================
-- 032 — STORAGE BUCKET: documentos condominiais
-- ============================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  false,
  52428800, -- 50 MB
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Leitura via signed URL (acesso direto bloqueado — bucket privado)
CREATE POLICY "Authenticated read documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documents');

-- Upload restrito a usuários autenticados
CREATE POLICY "Authenticated upload documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documents');

-- Exclusão restrita a usuários autenticados
CREATE POLICY "Authenticated delete documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documents');
