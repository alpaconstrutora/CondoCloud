-- ============================================================
-- 016 — SEQUÊNCIAS DE ATIVAÇÃO
-- Controla a sequência T+30min → T+24h → T+72h → T+7d
-- ============================================================
create table activation_sequences (
  id             uuid primary key default uuid_generate_v4(),
  condominium_id uuid not null references condominiums(id) on delete cascade,
  current_step   text,
  next_run_at    timestamp,
  completed      boolean default false,
  metadata       jsonb default '{}',
  created_at     timestamp default now()
);
-- Índice crítico para o job que roda a cada hora
create index idx_activation_sequences_next
  on activation_sequences(next_run_at, completed)
  where completed = false;
create index idx_activation_sequences_condo
  on activation_sequences(condominium_id)
  where completed = false;
