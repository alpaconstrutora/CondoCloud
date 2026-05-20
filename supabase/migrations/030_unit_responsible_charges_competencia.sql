-- 030: Morador responsável por unidade + competência em cobranças

-- Marca qual morador é o responsável financeiro da unidade
ALTER TABLE unit_profiles
  ADD COLUMN IF NOT EXISTS is_responsible boolean NOT NULL DEFAULT false;

-- Garante no máximo 1 responsável por unidade
CREATE UNIQUE INDEX IF NOT EXISTS unit_profiles_one_responsible
  ON unit_profiles (unit_id)
  WHERE is_responsible = true;

-- Vincula cobrança à competência (mês) para detectar duplicatas e relatórios
ALTER TABLE charges
  ADD COLUMN IF NOT EXISTS competencia date;

CREATE INDEX IF NOT EXISTS idx_charges_competencia
  ON charges (condominium_id, competencia);
