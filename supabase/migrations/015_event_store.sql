-- ============================================================
-- 015 — EVENT STORE (fonte única de verdade operacional)
-- NUNCA apagar registros desta tabela
-- Separado de product_events (analytics)
-- ============================================================
create table events (
  event_id       uuid primary key default uuid_generate_v4(),
  event_name     text not null,
  aggregate_id   uuid not null,
  aggregate_type text not null check (aggregate_type in (
    'profile','condominium','invite','proposal','ticket','reservation','assembly','notification'
  )),
  event_version  int  not null,
  source         text not null check (source in ('api','worker','job','system')),
  payload        jsonb not null,
  condo_id       uuid references condominiums(id),
  created_at     timestamp not null default now()
);
create unique index idx_events_id        on events(event_id);
create        index idx_events_aggregate on events(aggregate_type, aggregate_id);
create        index idx_events_name      on events(event_name);
create        index idx_events_condo     on events(condo_id, created_at desc);

-- ──────────────────────────────────────────────────────────────
-- IDEMPOTÊNCIA: garante que cada event_id é processado 1x por worker
-- TTL: purgar processed_events com > 30 dias (job semanal)
-- ──────────────────────────────────────────────────────────────
create table processed_events (
  event_id     uuid primary key,
  worker       text not null,
  processed_at timestamp not null default now()
);
create index idx_processed_events_age on processed_events(processed_at);

-- ──────────────────────────────────────────────────────────────
-- EVENT ORDERING: detecta eventos fora de ordem
-- Crítico para consistência — nunca remover
-- ──────────────────────────────────────────────────────────────
create table aggregate_versions (
  aggregate_id    text not null,
  aggregate_type  text not null,
  current_version int not null default 0,
  updated_at      timestamp default now(),
  primary key (aggregate_id, aggregate_type)
);
