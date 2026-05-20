-- ============================================================
-- 017 — NOTIFICAÇÕES E PREFERÊNCIAS ADAPTATIVAS
-- ============================================================
create table notifications (
  id             uuid primary key default uuid_generate_v4(),
  profile_id     uuid not null references profiles(id) on delete cascade,
  title          text not null,
  body           text,
  type           text not null
    check (type in ('ticket','message','financial','assembly','reservation','system','activation','digest')),
  entity_id      uuid,
  channel        text default 'push' check (channel in ('push','email','whatsapp')),
  read_at        timestamp,
  clicked_at     timestamp,  -- distingue "abriu" de "clicou"
  sent_at        timestamp,
  condominium_id uuid references condominiums(id),
  created_at     timestamp default now()
);
create index idx_notifications_profile  on notifications(profile_id, read_at, created_at desc);
create index idx_notifications_unread   on notifications(profile_id) where read_at is null;

-- ──────────────────────────────────────────────────────────────
-- PREFERÊNCIAS ADAPTATIVAS
-- cooldown: quando o sistema pausou notificações para o perfil
-- consecutive_ignored: contador de notificações ignoradas seguidas
-- ──────────────────────────────────────────────────────────────
create table notification_preferences (
  profile_id          uuid primary key references profiles(id) on delete cascade,
  consecutive_ignored int default 0,
  cooldown_until      timestamp,
  last_opened_at      timestamp,
  silenced_types      text[] default '{}',
  updated_at          timestamp default now()
);
