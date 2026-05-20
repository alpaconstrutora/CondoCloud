-- 027: Allow amount = 0 in financial_recurring (variable expenses)

ALTER TABLE financial_recurring
  DROP CONSTRAINT IF EXISTS financial_recurring_amount_check;

ALTER TABLE financial_recurring
  ADD CONSTRAINT financial_recurring_amount_check CHECK (amount >= 0);
