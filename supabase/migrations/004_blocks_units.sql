-- ============================================================
-- 004 — BLOCOS E UNIDADES
-- ============================================================
create table blocks (
  id             uuid primary key default uuid_generate_v4(),
  name           text not null,
  condominium_id uuid not null references condominiums(id) on delete cascade,
  created_at     timestamp default now()
);
create index idx_blocks_condo on blocks(condominium_id);

create table units (
  id             uuid primary key default uuid_generate_v4(),
  number         text not null,
  block_id       uuid references blocks(id) on delete set null,
  condominium_id uuid not null references condominiums(id) on delete cascade,
  fraction       numeric default 1.0,
  created_at     timestamp default now()
);
create index idx_units_condo on units(condominium_id);
create index idx_units_block on units(block_id);
-- Garante número único de unidade por bloco (ou por condomínio se sem bloco)
create unique index idx_units_unique_number on units(condominium_id, block_id, number);
