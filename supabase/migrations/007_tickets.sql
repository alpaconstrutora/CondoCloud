-- ============================================================
-- 007 — TICKETS
-- ============================================================
create table tickets (
  id                uuid primary key default uuid_generate_v4(),
  title             text not null,
  description       text,
  status            text not null default 'open'
    check (status in ('open','in_progress','resolved','closed')),
  priority          text not null default 'medium'
    check (priority in ('low','medium','high','urgent')),
  category          text not null
    check (category in ('manutencao','seguranca','limpeza','barulho','area_comum','outro')),
  sla_deadline      timestamp,
  rating            int check (rating between 1 and 5),
  created_by        uuid references profiles(id),
  assigned_to       uuid references profiles(id),
  condominium_id    uuid not null references condominiums(id),
  unit_id           uuid references units(id),
  ai_classification jsonb,   -- stub para futura integração de IA
  created_at        timestamp default now(),
  updated_at        timestamp default now()
);
create index idx_tickets_condo_status on tickets(condominium_id, status);
create index idx_tickets_sla          on tickets(sla_deadline) where status not in ('resolved','closed');
create index idx_tickets_assigned     on tickets(assigned_to) where assigned_to is not null;

-- Trigger para atualizar updated_at automaticamente
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tickets_updated_at
  before update on tickets
  for each row execute procedure update_updated_at();

-- ──────────────────────────────────────────────────────────────
-- ATUALIZAÇÕES DE TICKET (histórico + comentários)
-- ──────────────────────────────────────────────────────────────
create table ticket_updates (
  id          uuid primary key default uuid_generate_v4(),
  ticket_id   uuid not null references tickets(id) on delete cascade,
  author_id   uuid references profiles(id),
  content     text,
  status_from text,
  status_to   text,
  attachments jsonb default '[]',
  created_at  timestamp default now()
);
create index idx_ticket_updates_ticket on ticket_updates(ticket_id, created_at);
