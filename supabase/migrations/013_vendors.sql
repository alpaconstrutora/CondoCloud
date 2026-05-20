-- ============================================================
-- 013 — PRESTADORES (vendors)
-- ============================================================
create table vendors (
  id             uuid primary key default uuid_generate_v4(),
  profile_id     uuid references profiles(id),
  company_name   text,
  document       text,
  specialty      text,
  phone          text,
  email          text,
  rating_avg     numeric default 0,
  rating_count   int default 0,
  condominium_id uuid not null references condominiums(id) on delete cascade,
  created_at     timestamp default now()
);
create index idx_vendors_condo on vendors(condominium_id);

-- ──────────────────────────────────────────────────────────────
-- ACESSOS DE PRESTADORES (QR Code temporário vinculado a ticket)
-- ──────────────────────────────────────────────────────────────
create table vendor_accesses (
  id             uuid primary key default uuid_generate_v4(),
  vendor_id      uuid not null references vendors(id) on delete cascade,
  ticket_id      uuid references tickets(id),
  valid_from     timestamp not null,
  valid_until    timestamp not null,
  qr_code        text unique,
  used_at        timestamp,
  condominium_id uuid not null references condominiums(id),
  created_at     timestamp default now(),
  check (valid_until > valid_from)
);
create index idx_vendor_accesses_vendor  on vendor_accesses(vendor_id);
create index idx_vendor_accesses_qr      on vendor_accesses(qr_code) where qr_code is not null;
create index idx_vendor_accesses_active  on vendor_accesses(valid_until) where used_at is null;
