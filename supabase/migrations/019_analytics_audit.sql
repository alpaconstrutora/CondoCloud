-- ============================================================
-- 019 — ANALYTICS, AUDITORIA E IA
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- ANALYTICS (separado do event store operacional)
-- product_events são para análise de produto, NÃO para decisões do sistema
-- ──────────────────────────────────────────────────────────────
create table product_events (
  id             uuid primary key default uuid_generate_v4(),
  condominium_id uuid references condominiums(id),
  profile_id     uuid references profiles(id),
  event_name     text not null,
  properties     jsonb default '{}',
  created_at     timestamp default now()
);
create index idx_product_events on product_events(condominium_id, event_name, created_at);

-- ──────────────────────────────────────────────────────────────
-- AUDITORIA (requisito legal — não opcional)
-- Toda ação automática do sistema DEVE ser registrada aqui
-- ──────────────────────────────────────────────────────────────
create table audit_logs (
  id             uuid primary key default uuid_generate_v4(),
  event_id       uuid,
  condominium_id uuid references condominiums(id),
  profile_id     uuid references profiles(id),
  action         text not null,
  entity_type    text,
  entity_id      uuid,
  payload        jsonb,
  reason         text,
  ip_address     inet,
  created_at     timestamp default now()
);
create index idx_audit_condo on audit_logs(condominium_id, created_at desc);

-- ──────────────────────────────────────────────────────────────
-- USO DE IA (stub — pronto para integração futura)
-- Apenas 2 funções no MVP: classifyTicket e generateAssemblyMinutes
-- ──────────────────────────────────────────────────────────────
create table ai_usage_log (
  id             uuid primary key default uuid_generate_v4(),
  condominium_id uuid not null references condominiums(id),
  function_name  text not null check (function_name in ('classifyTicket','generateAssemblyMinutes')),
  tokens_used    int,
  duration_ms    int,
  success        boolean default true,
  error_message  text,
  created_at     timestamp default now()
);
create index idx_ai_usage on ai_usage_log(condominium_id, created_at);
