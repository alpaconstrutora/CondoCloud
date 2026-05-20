-- ============================================================
-- 006 — CONVITES
-- ============================================================
create table invites (
  id             uuid primary key default uuid_generate_v4(),
  token          text not null unique,
  email          text,
  unit_id        uuid references units(id),
  role           text default 'morador' check (role in ('morador','prestador')),
  condominium_id uuid not null references condominiums(id) on delete cascade,
  created_by     uuid references profiles(id),
  channel        text check (channel in ('whatsapp','email','qr','csv')),
  expires_at     timestamp default (now() + interval '7 days'),
  used_at        timestamp,
  used_by        uuid references profiles(id),
  created_at     timestamp default now()
);
create index idx_invites_token         on invites(token);
create index idx_invites_condo_status  on invites(condominium_id, used_at);
create index idx_invites_expires       on invites(expires_at) where used_at is null;
