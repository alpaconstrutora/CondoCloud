-- ============================================================
-- 014 — PROPOSTAS COMERCIAIS (modo venda)
-- ============================================================
create table proposals (
  id             uuid primary key default uuid_generate_v4(),
  condominium_id uuid not null references condominiums(id),
  plan_id        uuid references plans(id),
  created_by     uuid references profiles(id),
  token          text not null unique,
  pdf_url        text,
  trial_snapshot jsonb,  -- dados do trial capturados no momento da geração
  expires_at     timestamp default (now() + interval '30 days'),
  converted_at   timestamp,
  created_at     timestamp default now()
);
create index idx_proposals_token on proposals(token);
create index idx_proposals_condo  on proposals(condominium_id);
create index idx_proposals_active on proposals(expires_at, converted_at) where converted_at is null;

-- ──────────────────────────────────────────────────────────────
-- INTERAÇÕES COM PROPOSTAS (tracking de visualizações)
-- ──────────────────────────────────────────────────────────────
create table proposal_interactions (
  id                    uuid primary key default uuid_generate_v4(),
  proposal_id           uuid not null references proposals(id) on delete cascade,
  viewer_name           text,
  viewer_email          text,
  action                text not null check (action in ('viewed','approved','questioned')),
  comment               text,
  time_on_page_seconds  int,
  visit_count           int default 1,
  ip_address            inet,
  created_at            timestamp default now()
);
create index idx_proposal_interactions on proposal_interactions(proposal_id, created_at);
