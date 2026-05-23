-- Tipos de morador dinâmicos por condomínio (proprietário, inquilino, etc.)
create table tipos_morador (
  id            uuid primary key default gen_random_uuid(),
  nome          text not null,
  condominium_id uuid not null references condominiums(id) on delete cascade,
  created_at    timestamp default now(),
  unique (nome, condominium_id)
);

alter table tipos_morador enable row level security;

create policy "tenant_tipos_morador" on tipos_morador
  for all using (
    get_user_role() = 'desenvolvedor'
    or condominium_id = get_user_condominium()
  );
