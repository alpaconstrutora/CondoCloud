-- ============================================================
-- 008 — MENSAGENS / MURAL
-- ============================================================
create table messages (
  id             uuid primary key default uuid_generate_v4(),
  title          text not null,
  content        text not null,
  audience       text not null check (audience in ('all','block','unit')),
  target_id      uuid,   -- block_id ou unit_id dependendo do audience
  pinned         boolean default false,
  publish_at     timestamp default now(),
  created_by     uuid references profiles(id),
  condominium_id uuid not null references condominiums(id),
  created_at     timestamp default now()
);
create index idx_messages_condo        on messages(condominium_id, publish_at desc);
create index idx_messages_pinned       on messages(condominium_id, pinned) where pinned = true;

-- ──────────────────────────────────────────────────────────────
-- CONFIRMAÇÕES DE LEITURA
-- ──────────────────────────────────────────────────────────────
create table message_reads (
  message_id uuid not null references messages(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  read_at    timestamp default now(),
  primary key (message_id, profile_id)
);
create index idx_message_reads_profile on message_reads(profile_id);
