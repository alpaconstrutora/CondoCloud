-- ============================================================
-- 010 — ASSEMBLEIAS E VOTAÇÃO
-- REGRA: Assembleia NUNCA bloqueada em nenhum plano
-- ============================================================
create table assemblies (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  description     text,
  date            timestamp not null,
  location        text,
  status          text not null default 'scheduled'
    check (status in ('scheduled','open','closed','cancelled')),
  quorum_required int default 0,
  minutes_url     text,
  condominium_id  uuid not null references condominiums(id),
  created_by      uuid references profiles(id),
  created_at      timestamp default now()
);
create index idx_assemblies_condo  on assemblies(condominium_id, date desc);
create index idx_assemblies_status on assemblies(condominium_id, status) where status in ('scheduled','open');

-- ──────────────────────────────────────────────────────────────
-- PAUTAS DA ASSEMBLEIA
-- ──────────────────────────────────────────────────────────────
create table assembly_items (
  id          uuid primary key default uuid_generate_v4(),
  assembly_id uuid not null references assemblies(id) on delete cascade,
  title       text not null,
  description text,
  order_index int not null default 0,
  result      text,
  created_at  timestamp default now()
);
create index idx_assembly_items_assembly on assembly_items(assembly_id, order_index);

-- ──────────────────────────────────────────────────────────────
-- VOTOS (1 voto por perfil por pauta — enforced por unique)
-- ──────────────────────────────────────────────────────────────
create table votes (
  id               uuid primary key default uuid_generate_v4(),
  assembly_item_id uuid not null references assembly_items(id) on delete cascade,
  profile_id       uuid not null references profiles(id),
  vote             text not null check (vote in ('yes','no','abstain')),
  created_at       timestamp default now(),
  unique(assembly_item_id, profile_id)
);
create index idx_votes_item on votes(assembly_item_id);
