-- ============================================================
-- 009 — FINANCEIRO
-- ============================================================

-- Receitas e despesas gerais do condomínio
create table financial_records (
  id             uuid primary key default uuid_generate_v4(),
  type           text not null check (type in ('income','expense')),
  amount         numeric not null,
  description    text,
  category       text,
  unit_id        uuid references units(id),
  due_date       date,
  paid_at        date,
  payment_method text,
  gateway_id     text,
  receipt_url    text,
  condominium_id uuid not null references condominiums(id),
  created_by     uuid references profiles(id),
  created_at     timestamp default now()
);
create index idx_financial_condo     on financial_records(condominium_id, type);
create index idx_financial_due       on financial_records(due_date) where paid_at is null;
create index idx_financial_period    on financial_records(condominium_id, paid_at desc);

-- ──────────────────────────────────────────────────────────────
-- COBRANÇAS POR UNIDADE (ciclo de vida próprio)
-- Separado de financial_records propositalmente
-- ──────────────────────────────────────────────────────────────
create table charges (
  id                uuid primary key default uuid_generate_v4(),
  unit_id           uuid not null references units(id),
  profile_id        uuid references profiles(id),
  description       text not null,
  amount            numeric not null,
  due_date          date not null,
  status            text not null default 'pending'
    check (status in ('pending','paid','overdue','cancelled')),
  paid_at           timestamp,
  payment_method    text,
  gateway_charge_id text,
  boleto_url        text,
  pix_qr_code       text,
  pix_key           text,
  condominium_id    uuid not null references condominiums(id),
  created_at        timestamp default now()
);
create index idx_charges_unit    on charges(unit_id, status);
create index idx_charges_overdue on charges(condominium_id, status) where status = 'overdue';
create index idx_charges_pending on charges(due_date) where status = 'pending';
