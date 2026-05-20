-- ============================================================
-- 012 — DOCUMENTOS
-- ============================================================
create table documents (
  id              uuid primary key default uuid_generate_v4(),
  title           text not null,
  category        text not null
    check (category in ('regulamento','ata','contrato','planta','financeiro','outro')),
  file_url        text not null,
  file_size_bytes int,
  version         int default 1,
  parent_id       uuid references documents(id),  -- para versionamento
  visible_to      text not null default 'all'
    check (visible_to in ('all','sindico','admin')),
  condominium_id  uuid not null references condominiums(id) on delete cascade,
  uploaded_by     uuid references profiles(id),
  created_at      timestamp default now()
);
create index idx_documents_condo    on documents(condominium_id, category);
create index idx_documents_parent   on documents(parent_id) where parent_id is not null;
