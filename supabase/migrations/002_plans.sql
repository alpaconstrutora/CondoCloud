-- ============================================================
-- 002 — PLANOS
-- ============================================================
create table plans (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null check (name in ('starter','pro','enterprise')),
  max_units       int  not null default 50,
  max_ai_calls    int  not null default 100,
  price_monthly   numeric not null default 0,
  stripe_price_id text,
  created_at      timestamp default now()
);

insert into plans (name, max_units, max_ai_calls, price_monthly) values
  ('starter',    50,   100,  149.90),
  ('pro',        200,  500,  349.90),
  ('enterprise', 9999, 9999, 899.90);
