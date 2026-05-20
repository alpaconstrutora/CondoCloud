-- ============================================================
-- 021 — RLS — ROW LEVEL SECURITY
-- Habilitar RLS em TODAS as tabelas com dados de tenant
-- ============================================================

alter table profiles           enable row level security;
alter table tickets            enable row level security;
alter table ticket_updates     enable row level security;
alter table messages           enable row level security;
alter table message_reads      enable row level security;
alter table financial_records  enable row level security;
alter table charges            enable row level security;
alter table assemblies         enable row level security;
alter table assembly_items     enable row level security;
alter table votes              enable row level security;
alter table units              enable row level security;
alter table blocks             enable row level security;
alter table common_areas       enable row level security;
alter table reservations       enable row level security;
alter table documents          enable row level security;
alter table vendors            enable row level security;
alter table notifications      enable row level security;
alter table audit_logs         enable row level security;
alter table invites            enable row level security;
alter table activation_sequences enable row level security;

-- ──────────────────────────────────────────────────────────────
-- FUNÇÕES DE TENANT ISOLATION
-- SECURITY DEFINER + search_path = public para evitar SQL injection
-- ──────────────────────────────────────────────────────────────
create or replace function get_user_condominium()
returns uuid language sql stable security definer set search_path = public as $$
  select condominium_id from profiles where id = auth.uid() limit 1
$$;

create or replace function get_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() limit 1
$$;

-- ──────────────────────────────────────────────────────────────
-- POLÍTICAS RLS
-- Padrão: autenticado + tenant válido + mesmo tenant
-- ──────────────────────────────────────────────────────────────

-- Profiles: síndico/admin vê todos do condomínio, morador vê apenas o próprio
create policy "profiles_select" on profiles for select
  using (
    auth.uid() is not null
    and (
      id = auth.uid()
      or (
        get_user_condominium() is not null
        and condominium_id = get_user_condominium()
        and get_user_role() in ('sindico', 'admin')
      )
    )
  );

create policy "profiles_update_own" on profiles for update
  using (id = auth.uid());

-- Tickets: todos do mesmo condomínio
create policy "tenant_tickets" on tickets for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
  );

-- Ticket updates
create policy "tenant_ticket_updates" on ticket_updates for all
  using (
    auth.uid() is not null
    and exists (
      select 1 from tickets t
      where t.id = ticket_updates.ticket_id
      and t.condominium_id = get_user_condominium()
    )
  );

-- Mensagens
create policy "tenant_messages" on messages for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
  );

-- Message reads
create policy "own_message_reads" on message_reads for all
  using (profile_id = auth.uid());

-- Financeiro: apenas síndico/admin
create policy "tenant_financial" on financial_records for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
    and get_user_role() in ('sindico', 'admin')
  );

-- Charges: morador vê as próprias, síndico/admin vê todas
create policy "tenant_charges" on charges for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
    and (
      get_user_role() in ('sindico', 'admin')
      or profile_id = auth.uid()
    )
  );

-- Assembleias: todos do condomínio
create policy "tenant_assemblies" on assemblies for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
  );

-- Assembly items
create policy "tenant_assembly_items" on assembly_items for all
  using (
    auth.uid() is not null
    and exists (
      select 1 from assemblies a
      where a.id = assembly_items.assembly_id
      and a.condominium_id = get_user_condominium()
    )
  );

-- Votos: todos do condomínio, mas só pode votar 1 vez (enforced por unique)
create policy "tenant_votes" on votes for all
  using (
    auth.uid() is not null
    and exists (
      select 1 from assembly_items ai
      join assemblies a on a.id = ai.assembly_id
      where ai.id = votes.assembly_item_id
      and a.condominium_id = get_user_condominium()
    )
  );

-- Unidades e Blocos
create policy "tenant_units" on units for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
  );

create policy "tenant_blocks" on blocks for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
  );

-- Áreas comuns e reservas
create policy "tenant_common_areas" on common_areas for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
  );

create policy "tenant_reservations" on reservations for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
  );

-- Documentos: visibilidade por role
create policy "tenant_docs" on documents for select
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
    and (
      visible_to = 'all'
      or (visible_to = 'sindico' and get_user_role() in ('sindico', 'admin'))
      or get_user_role() = 'admin'
    )
  );

create policy "sindico_docs_write" on documents for insert
  with check (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );

-- Prestadores
create policy "tenant_vendors" on vendors for all
  using (
    auth.uid() is not null
    and get_user_condominium() is not null
    and condominium_id = get_user_condominium()
  );

-- Notificações: apenas o próprio perfil
create policy "own_notifications" on notifications for all
  using (profile_id = auth.uid());

-- Auditoria: apenas síndico/admin
create policy "tenant_audit" on audit_logs for select
  using (
    get_user_role() in ('sindico', 'admin')
    and condominium_id = get_user_condominium()
  );

-- Convites: síndico/admin cria, qualquer um resolve pelo token
create policy "tenant_invites_select" on invites for select
  using (
    auth.uid() is not null
    and (
      condominium_id = get_user_condominium()
      or get_user_role() in ('sindico', 'admin')
    )
  );

create policy "sindico_invites_write" on invites for insert
  with check (
    auth.uid() is not null
    and get_user_role() in ('sindico', 'admin')
  );

-- Activation sequences: apenas backend (service_role via API)
create policy "system_activation_sequences" on activation_sequences for all
  using (get_user_role() in ('sindico', 'admin'));
