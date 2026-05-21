-- ============================================================
-- 033 — DOCUMENTOS: soft delete + storage_path + audit log
-- ============================================================

-- Adiciona storage_path (caminho no bucket) e soft delete
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS deleted_at   timestamp;

-- Índice para filtrar apenas documentos ativos
CREATE INDEX IF NOT EXISTS idx_documents_active
  ON documents(condominium_id, category)
  WHERE deleted_at IS NULL;

-- Tabela de auditoria de documentos
CREATE TABLE IF NOT EXISTS document_audit_log (
  id            uuid primary key default uuid_generate_v4(),
  document_id   uuid not null references documents(id),
  action        text not null check (action in ('created', 'downloaded', 'deleted')),
  performed_by  uuid references profiles(id),
  performed_at  timestamp default now(),
  meta          jsonb
);

CREATE INDEX IF NOT EXISTS idx_doc_audit_document
  ON document_audit_log(document_id, performed_at DESC);
