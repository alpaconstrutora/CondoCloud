-- ──────────────────────────────────────────────────────────────────
-- 028: Competência mensal + Fechamento financeiro
-- ──────────────────────────────────────────────────────────────────

-- 1. Adiciona coluna competencia em financial_records
ALTER TABLE financial_records
  ADD COLUMN IF NOT EXISTS competencia date;

-- Backfill: usa due_date ou created_at como referência de mês
UPDATE financial_records
  SET competencia = date_trunc('month', COALESCE(due_date::date, created_at::date))::date
  WHERE competencia IS NULL;

-- 2. Tabela de fechamentos mensais
CREATE TABLE IF NOT EXISTS financial_closings (
  id              uuid          DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id  uuid          NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  competencia     date          NOT NULL,
  closed_at       timestamptz   NOT NULL DEFAULT now(),
  closed_by       uuid          REFERENCES profiles(id) ON DELETE SET NULL,
  saldo_inicial   numeric(12,2) NOT NULL DEFAULT 0,
  total_income    numeric(12,2) NOT NULL DEFAULT 0,
  total_expense   numeric(12,2) NOT NULL DEFAULT 0,
  saldo_final     numeric(12,2) NOT NULL DEFAULT 0,
  notes           text,
  UNIQUE(condominium_id, competencia)
);

CREATE INDEX IF NOT EXISTS idx_financial_closings_condo ON financial_closings(condominium_id);

ALTER TABLE financial_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_read_closings" ON financial_closings
  FOR SELECT USING (
    condominium_id IN (SELECT condominium_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "sindico_manage_closings" ON financial_closings
  FOR ALL USING (
    condominium_id IN (
      SELECT condominium_id FROM profiles
      WHERE id = auth.uid() AND role IN ('sindico', 'sindico_administradora', 'desenvolvedor')
    )
  );
