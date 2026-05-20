-- 023 — adiciona campos de detalhe na unidade
alter table units
  add column if not exists floor        integer,
  add column if not exists size_sqm     numeric(8,2),
  add column if not exists parking_spots integer;
