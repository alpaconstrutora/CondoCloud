-- ============================================================
-- 003 — CONDOMÍNIOS (tenant raiz)
-- Estado real vem de events — aqui apenas estado mínimo para decisão rápida
-- ============================================================
create table condominiums (
  id                     uuid primary key default uuid_generate_v4(),
  name                   text not null,
  address                text,
  cnpj                   text,
  plan_id                uuid references plans(id),
  -- billing
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  subscription_status    text default 'trialing'
    check (subscription_status in ('trialing','active','past_due','canceled','paused')),
  trial_ends_at          timestamp default (now() + interval '14 days'),
  past_due_since         timestamp,
  -- estado derivado (atualizado por workers, nunca por API direta)
  current_version        int default 0,
  activated              boolean default false,
  onboarding_completed   boolean default false,
  onboarding_step        int default 1,
  active                 boolean default true,
  settings               jsonb default '{}',
  created_at             timestamp default now()
);

create index idx_condominiums_status on condominiums(subscription_status);
create index idx_condominiums_trial  on condominiums(trial_ends_at) where subscription_status = 'trialing';
