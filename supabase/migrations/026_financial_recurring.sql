-- ──────────────────────────────────────────────────────────────────
-- 026: Despesas fixas recorrentes
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_recurring (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id  uuid        NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  description     text        NOT NULL,
  category        text        NOT NULL,
  amount          numeric(12,2) NOT NULL CHECK (amount > 0),
  day_of_month    int         NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 28),
  active          boolean     NOT NULL DEFAULT true,
  created_by      uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  last_generated  date,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_recurring_condo ON financial_recurring(condominium_id);
CREATE INDEX IF NOT EXISTS idx_financial_recurring_active ON financial_recurring(active) WHERE active = true;

ALTER TABLE financial_recurring ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sindico_manage_recurring" ON financial_recurring
  FOR ALL USING (
    condominium_id = (
      SELECT condominium_id FROM profiles
      WHERE id = auth.uid() AND role IN ('sindico', 'sindico_administradora', 'desenvolvedor')
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'desenvolvedor'
    )
  );
