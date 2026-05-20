-- 029: Vincula fornecedor à categoria financeira
ALTER TABLE financial_categories
  ADD COLUMN IF NOT EXISTS vendor_id uuid REFERENCES vendors(id) ON DELETE SET NULL;
