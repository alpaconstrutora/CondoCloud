-- ============================================================
-- 024 — REDESIGN DE ROLES
-- Novos perfis: desenvolvedor, sindico_administradora, sindico, morador, prestador
-- ============================================================

-- ── 1. Atualizar constraint de role em profiles ───────────────
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('desenvolvedor','sindico_administradora','sindico','morador','prestador'));

-- Renomear admin → desenvolvedor
update profiles set role = 'desenvolvedor' where role = 'admin';

-- Atualizar trigger de novo usuário para aceitar novos roles
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'morador')
  );
  return new;
end;
$$;

-- ── 2. Tabela de vinculo: sindico_administradora ↔ condominios ─
create table if not exists administradora_condominios (
  id             uuid default gen_random_uuid() primary key,
  profile_id     uuid not null references profiles(id) on delete cascade,
  condominium_id uuid not null references condominiums(id) on delete cascade,
  created_at     timestamptz default now(),
  unique(profile_id, condominium_id)
);

create index idx_adm_condominios_profile on administradora_condominios(profile_id);
create index idx_adm_condominios_condo   on administradora_condominios(condominium_id);

alter table administradora_condominios enable row level security;

-- Desenvolvedor vê tudo; sindico_administradora vê os próprios vínculos
create policy "adm_condominios_select" on administradora_condominios for select
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or profile_id = auth.uid()
    )
  );

-- Apenas desenvolvedor pode vincular/desvincular
create policy "adm_condominios_write" on administradora_condominios for all
  using (get_user_role() = 'desenvolvedor');

-- ── 3. Recriar funções de tenant isolation ────────────────────
create or replace function get_user_condominium()
returns uuid language sql stable security definer set search_path = public as $$
  select condominium_id from profiles where id = auth.uid() limit 1
$$;

create or replace function get_user_role()
returns text language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid() limit 1
$$;

-- Função auxiliar: verifica se sindico_administradora tem acesso a um condo
create or replace function adm_has_condo_access(condo_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from administradora_condominios
    where profile_id = auth.uid()
    and condominium_id = condo_id
  )
$$;

-- ── 4. Remover políticas RLS antigas e recriar ────────────────
drop policy if exists "profiles_select"              on profiles;
drop policy if exists "profiles_update_own"          on profiles;
drop policy if exists "tenant_tickets"               on tickets;
drop policy if exists "tenant_ticket_updates"        on ticket_updates;
drop policy if exists "tenant_messages"              on messages;
drop policy if exists "own_message_reads"            on message_reads;
drop policy if exists "tenant_financial"             on financial_records;
drop policy if exists "tenant_charges"               on charges;
drop policy if exists "tenant_assemblies"            on assemblies;
drop policy if exists "tenant_assembly_items"        on assembly_items;
drop policy if exists "tenant_votes"                 on votes;
drop policy if exists "tenant_units"                 on units;
drop policy if exists "tenant_blocks"                on blocks;
drop policy if exists "tenant_common_areas"          on common_areas;
drop policy if exists "tenant_reservations"          on reservations;
drop policy if exists "tenant_docs"                  on documents;
drop policy if exists "sindico_docs_write"           on documents;
drop policy if exists "tenant_vendors"               on vendors;
drop policy if exists "own_notifications"            on notifications;
drop policy if exists "tenant_audit"                 on audit_logs;
drop policy if exists "tenant_invites_select"        on invites;
drop policy if exists "sindico_invites_write"        on invites;
drop policy if exists "system_activation_sequences"  on activation_sequences;

-- ── 5. Novas políticas RLS ────────────────────────────────────

-- Helper inline para checar se o usuário tem acesso ao condominium_id da linha
-- Desenvolvedor: acesso total a todos os condomínios
-- Sindico_administradora: acesso apenas aos condos vinculados
-- Sindico/morador/prestador: apenas próprio condo

-- PROFILES
create policy "profiles_select" on profiles for select
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or id = auth.uid()
      or (
        get_user_role() in ('sindico', 'sindico_administradora')
        and (
          condominium_id = get_user_condominium()
          or adm_has_condo_access(condominium_id)
        )
      )
    )
  );

create policy "profiles_update_own" on profiles for update
  using (id = auth.uid() or get_user_role() = 'desenvolvedor');

-- TICKETS
-- Morador vê apenas os próprios; sindico/adm vê todos do condo
create policy "tenant_tickets" on tickets for select
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or (
        get_user_role() in ('sindico', 'sindico_administradora', 'prestador')
        and (
          condominium_id = get_user_condominium()
          or adm_has_condo_access(condominium_id)
        )
      )
      or (
        get_user_role() = 'morador'
        and condominium_id = get_user_condominium()
        and created_by = auth.uid()
      )
    )
  );

create policy "tenant_tickets_write" on tickets for insert
  with check (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

create policy "tenant_tickets_update" on tickets for update
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

-- TICKET UPDATES
create policy "tenant_ticket_updates" on ticket_updates for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or exists (
        select 1 from tickets t
        where t.id = ticket_updates.ticket_id
        and (
          t.condominium_id = get_user_condominium()
          or adm_has_condo_access(t.condominium_id)
        )
      )
    )
  );

-- MENSAGENS
-- Morador só lê; sindico/adm pode criar e ler
create policy "tenant_messages_select" on messages for select
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

create policy "tenant_messages_write" on messages for insert
  with check (
    auth.uid() is not null
    and get_user_role() in ('desenvolvedor', 'sindico', 'sindico_administradora')
    and (
      condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

create policy "tenant_messages_update" on messages for update
  using (
    auth.uid() is not null
    and get_user_role() in ('desenvolvedor', 'sindico', 'sindico_administradora')
  );

create policy "tenant_messages_delete" on messages for delete
  using (
    auth.uid() is not null
    and get_user_role() in ('desenvolvedor', 'sindico', 'sindico_administradora')
  );

-- MESSAGE READS
create policy "own_message_reads" on message_reads for all
  using (profile_id = auth.uid());

-- FINANCEIRO: sindico/adm/desenvolvedor
create policy "tenant_financial" on financial_records for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or (
        get_user_role() in ('sindico', 'sindico_administradora')
        and (
          condominium_id = get_user_condominium()
          or adm_has_condo_access(condominium_id)
        )
      )
    )
  );

-- CHARGES: morador vê as próprias; gestores veem todas
create policy "tenant_charges" on charges for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or (
        get_user_role() in ('sindico', 'sindico_administradora')
        and (
          condominium_id = get_user_condominium()
          or adm_has_condo_access(condominium_id)
        )
      )
      or (
        get_user_role() = 'morador'
        and profile_id = auth.uid()
        and condominium_id = get_user_condominium()
      )
    )
  );

-- ASSEMBLEIAS
create policy "tenant_assemblies" on assemblies for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

-- ASSEMBLY ITEMS
create policy "tenant_assembly_items" on assembly_items for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or exists (
        select 1 from assemblies a
        where a.id = assembly_items.assembly_id
        and (
          a.condominium_id = get_user_condominium()
          or adm_has_condo_access(a.condominium_id)
        )
      )
    )
  );

-- VOTOS
create policy "tenant_votes" on votes for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or exists (
        select 1 from assembly_items ai
        join assemblies a on a.id = ai.assembly_id
        where ai.id = votes.assembly_item_id
        and (
          a.condominium_id = get_user_condominium()
          or adm_has_condo_access(a.condominium_id)
        )
      )
    )
  );

-- UNITS E BLOCKS
create policy "tenant_units" on units for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

create policy "tenant_blocks" on blocks for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

-- ÁREAS COMUNS E RESERVAS
create policy "tenant_common_areas" on common_areas for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

create policy "tenant_reservations" on reservations for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

-- DOCUMENTOS
create policy "tenant_docs" on documents for select
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or (
        (condominium_id = get_user_condominium() or adm_has_condo_access(condominium_id))
        and (
          visible_to = 'all'
          or (visible_to = 'sindico' and get_user_role() in ('sindico', 'sindico_administradora'))
          or (visible_to = 'admin' and get_user_role() in ('sindico', 'sindico_administradora', 'desenvolvedor'))
        )
      )
    )
  );

create policy "sindico_docs_write" on documents for insert
  with check (
    auth.uid() is not null
    and get_user_role() in ('desenvolvedor', 'sindico', 'sindico_administradora')
    and (
      condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

-- PRESTADORES
create policy "tenant_vendors" on vendors for all
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

-- NOTIFICAÇÕES
create policy "own_notifications" on notifications for all
  using (profile_id = auth.uid() or get_user_role() = 'desenvolvedor');

-- AUDITORIA
create policy "tenant_audit" on audit_logs for select
  using (
    get_user_role() = 'desenvolvedor'
    or (
      get_user_role() in ('sindico', 'sindico_administradora')
      and (
        condominium_id = get_user_condominium()
        or adm_has_condo_access(condominium_id)
      )
    )
  );

-- CONVITES
create policy "tenant_invites_select" on invites for select
  using (
    auth.uid() is not null
    and (
      get_user_role() = 'desenvolvedor'
      or condominium_id = get_user_condominium()
      or adm_has_condo_access(condominium_id)
    )
  );

create policy "sindico_invites_write" on invites for insert
  with check (
    auth.uid() is not null
    and get_user_role() in ('desenvolvedor', 'sindico', 'sindico_administradora')
  );

-- ACTIVATION SEQUENCES
create policy "system_activation_sequences" on activation_sequences for all
  using (
    get_user_role() in ('desenvolvedor', 'sindico', 'sindico_administradora')
  );
