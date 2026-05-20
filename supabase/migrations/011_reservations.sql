-- ============================================================
-- 011 — RESERVAS DE ÁREAS COMUNS
-- Conflito de horário: validado na aplicação (ReservationService)
-- Migrar para GIST constraint após estabilidade de volume
-- ============================================================
create table common_areas (
  id                 uuid primary key default uuid_generate_v4(),
  name               text not null,
  description        text,
  capacity           int,
  requires_approval  boolean default false,
  min_advance_hours  int default 24,
  max_duration_hours int default 4,
  fee                numeric default 0,
  rules              text,
  active             boolean default true,
  condominium_id     uuid not null references condominiums(id) on delete cascade,
  created_at         timestamp default now()
);
create index idx_common_areas_condo on common_areas(condominium_id) where active = true;

create table reservations (
  id             uuid primary key default uuid_generate_v4(),
  common_area_id uuid not null references common_areas(id) on delete cascade,
  profile_id     uuid not null references profiles(id),
  unit_id        uuid references units(id),
  starts_at      timestamp not null,
  ends_at        timestamp not null,
  status         text not null default 'pending'
    check (status in ('pending','confirmed','cancelled','rejected')),
  notes          text,
  approved_by    uuid references profiles(id),
  condominium_id uuid not null references condominiums(id),
  created_at     timestamp default now(),
  -- Garantia de integridade temporal
  check (ends_at > starts_at)
);
create index idx_reservations_area     on reservations(common_area_id, starts_at);
create index idx_reservations_profile  on reservations(profile_id, starts_at desc);
create index idx_reservations_status   on reservations(condominium_id, status) where status in ('pending','confirmed');
