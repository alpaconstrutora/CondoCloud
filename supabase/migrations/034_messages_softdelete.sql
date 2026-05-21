-- ============================================================
-- 034 — MENSAGENS: soft delete
-- ============================================================
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamp;

CREATE INDEX IF NOT EXISTS idx_messages_active
  ON messages(condominium_id, publish_at DESC)
  WHERE deleted_at IS NULL;
