-- ============================================================
-- 022 — RLS — TABELAS SEM COBERTURA NA 021
-- Corrige 10 tabelas sem RLS + policy de INSERT em documents
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- HABILITAR RLS NAS TABELAS FALTANTES
-- ──────────────────────────────────────────────────────────────
alter table vendor_accesses          enable row level security;
alter table proposals                enable row level security;
alter table proposal_interactions    enable row level security;
alter table notification_preferences enable row level security;
alter table morador_invite_rewards   enable row level security;
alter table invite_channel_stats     enable row level security;
alter table metrics_snapshots        enable row level security;
alter table metric_rules             enable row level security;
alter table product_events           enable row level security;
alter table ai_usage_log             enable row level security;

-- ──────────────────────────────────────────────────────────────
-- VENDOR_ACCESSES
-- Síndico/admin do condomínio vê todos; prestador vê os próprios
-- ──────────────────────────────────────────────────────────────
create policy "tenant_vendor_accesses" on vendor_accesses for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
    and (
      get_user_role() in ('sindico', 'admin')
      or exists (
        select 1 from vendors v
        where v.id = vendor_accesses.vendor_id
        and v.profile_id = auth.uid()
      )
    )
  );

-- ──────────────────────────────────────────────────────────────
-- PROPOSALS
-- Síndico/admin do condomínio vê e cria; leitura pública pelo token
-- é resolvida no backend via service_role — não exposta via RLS
-- ──────────────────────────────────────────────────────────────
create policy "tenant_proposals_select" on proposals for select
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
  );

create policy "sindico_proposals_write" on proposals for insert
  with check (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );

create policy "sindico_proposals_update" on proposals for update
  using (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );

-- ──────────────────────────────────────────────────────────────
-- PROPOSAL_INTERACTIONS
-- Síndico/admin do condomínio lê; inserção via service_role (backend)
-- ──────────────────────────────────────────────────────────────
create policy "tenant_proposal_interactions" on proposal_interactions for select
  using (
    auth.uid() is not null
    and exists (
      select 1 from proposals p
      where p.id = proposal_interactions.proposal_id
      and p.condominium_id = get_user_condominium()
    )
  );

-- ──────────────────────────────────────────────────────────────
-- NOTIFICATION_PREFERENCES
-- Apenas o próprio perfil
-- ──────────────────────────────────────────────────────────────
create policy "own_notification_preferences" on notification_preferences for all
  using (profile_id = auth.uid());

-- ──────────────────────────────────────────────────────────────
-- MORADOR_INVITE_REWARDS
-- Morador vê os próprios; síndico/admin vê todos do condomínio
-- ──────────────────────────────────────────────────────────────
create policy "tenant_morador_invite_rewards" on morador_invite_rewards for select
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
    and (
      profile_id = auth.uid()
      or get_user_role() in ('sindico', 'admin')
    )
  );

-- ──────────────────────────────────────────────────────────────
-- INVITE_CHANNEL_STATS
-- Apenas síndico/admin (dados estratégicos de canal)
-- ──────────────────────────────────────────────────────────────
create policy "sindico_invite_channel_stats" on invite_channel_stats for select
  using (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );

-- ──────────────────────────────────────────────────────────────
-- METRICS_SNAPSHOTS
-- Apenas síndico/admin
-- ──────────────────────────────────────────────────────────────
create policy "sindico_metrics_snapshots" on metrics_snapshots for select
  using (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );

-- ──────────────────────────────────────────────────────────────
-- METRIC_RULES
-- Apenas admin (tabela de sistema — modificada apenas por service_role)
-- ──────────────────────────────────────────────────────────────
create policy "admin_metric_rules" on metric_rules for select
  using (
    auth.uid() is not null
    and get_user_role() = 'admin'
  );

-- ──────────────────────────────────────────────────────────────
-- PRODUCT_EVENTS
-- Apenas síndico/admin (analytics do condomínio)
-- ──────────────────────────────────────────────────────────────
create policy "sindico_product_events" on product_events for select
  using (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );

-- ──────────────────────────────────────────────────────────────
-- AI_USAGE_LOG
-- Apenas síndico/admin do próprio condomínio
-- ──────────────────────────────────────────────────────────────
create policy "sindico_ai_usage_log" on ai_usage_log for select
  using (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );

-- ──────────────────────────────────────────────────────────────
-- CORRIGIR POLICY DE INSERT EM DOCUMENTS (021 usou using em vez de with check)
-- ──────────────────────────────────────────────────────────────
drop policy if exists "sindico_docs_write" on documents;

create policy "sindico_docs_insert" on documents for insert
  with check (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );

create policy "sindico_docs_update" on documents for update
  using (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );
