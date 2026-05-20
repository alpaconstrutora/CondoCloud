-- ──────────────────────────────────────────────────────────────────
-- 025: Tabela de categorias financeiras customizáveis por condomínio
-- ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS financial_categories (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  condominium_id  uuid        NOT NULL REFERENCES condominiums(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  type            text        NOT NULL CHECK (type IN ('income', 'expense')),
  active          boolean     NOT NULL DEFAULT true,
  is_default      boolean     NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financial_categories_condo ON financial_categories(condominium_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_categories_name ON financial_categories(condominium_id, name, type);

-- RLS
ALTER TABLE financial_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "condo_members_read_categories" ON financial_categories
  FOR SELECT USING (
    condominium_id = (
      SELECT condominium_id FROM profiles WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'desenvolvedor'
    )
  );

CREATE POLICY "sindico_manage_categories" ON financial_categories
  FOR ALL USING (
    condominium_id = (
      SELECT condominium_id FROM profiles WHERE id = auth.uid() AND role IN ('sindico', 'sindico_administradora', 'desenvolvedor')
    )
    OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'desenvolvedor'
    )
  );

-- Seed categorias padrão para todos os condomínios existentes
INSERT INTO financial_categories (condominium_id, name, type, is_default)
SELECT c.id, cat.name, cat.type, true
FROM condominiums c
CROSS JOIN (VALUES
  ('taxa_condominial', 'income'),
  ('multa',            'income'),
  ('reserva',          'income'),
  ('outro',            'income'),
  ('manutencao',       'expense'),
  ('limpeza',          'expense'),
  ('seguranca',        'expense'),
  ('energia',          'expense'),
  ('agua',             'expense'),
  ('administracao',    'expense'),
  ('outro',            'expense')
) AS cat(name, type)
ON CONFLICT DO NOTHING;
