-- ============================================================
-- 005 — PROFILES (referencia auth.users — NUNCA tabela users separada)
-- ============================================================
create table profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  name            text,
  email           text,
  phone           text,
  avatar_url      text,
  role            text not null check (role in ('admin','sindico','morador','prestador')),
  condominium_id  uuid references condominiums(id) on delete set null,
  unit_id         uuid references units(id) on delete set null,
  push_token      text,
  whatsapp        text,
  active          boolean default true,
  is_active       boolean default false,  -- materializado: job noturno, nunca query live
  last_active_at  timestamp,
  created_at      timestamp default now()
);
create index idx_profiles_condo on profiles(condominium_id);
create index idx_profiles_role  on profiles(role);

-- ──────────────────────────────────────────────────────────────
-- TRIGGER: criar profile ao registrar no Supabase Auth
-- ──────────────────────────────────────────────────────────────
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
