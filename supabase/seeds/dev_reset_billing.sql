-- ============================================================
-- DEV RESET — Billing Status
-- Uso: rode no Supabase SQL Editor ou via `pnpm db:dev-reset`
--
-- O que faz:
--   1. Mostra os condomínios afetados ANTES de alterar
--   2. Reseta subscription_status → 'active'
--   3. Limpa past_due_since
--   4. Estende trial_ends_at para +1 ano (evita o job marcar novamente)
--
-- ⚠️  NÃO execute em produção. Apenas em ambiente de desenvolvimento.
-- ============================================================

-- 1. Diagnóstico — veja o que será alterado
SELECT
  id,
  name,
  subscription_status,
  past_due_since,
  trial_ends_at
FROM condominiums
WHERE subscription_status IN ('past_due', 'trialing', 'canceled')
   OR past_due_since IS NOT NULL;

-- 2. Reset de todos os condomínios com problema de billing
UPDATE condominiums
SET
  subscription_status = 'active',
  past_due_since      = NULL,
  trial_ends_at       = NOW() + INTERVAL '1 year'
WHERE subscription_status IN ('past_due', 'trialing', 'canceled')
   OR past_due_since IS NOT NULL;

-- 3. Confirmar resultado
SELECT
  id,
  name,
  subscription_status,
  past_due_since,
  trial_ends_at
FROM condominiums
ORDER BY created_at DESC;
