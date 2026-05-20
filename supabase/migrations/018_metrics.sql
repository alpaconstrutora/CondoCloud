-- ============================================================
-- 018 — MÉTRICAS E MOTOR DE AUTO-OTIMIZAÇÃO
-- ============================================================
create table metrics_snapshots (
  id             uuid primary key default uuid_generate_v4(),
  condominium_id uuid references condominiums(id),
  metric_name    text not null,
  metric_value   numeric not null,
  created_at     timestamp not null default now()
);
create index idx_metrics_condo_name on metrics_snapshots(condominium_id, metric_name, created_at desc);

-- ──────────────────────────────────────────────────────────────
-- REGRAS DE AUTO-OTIMIZAÇÃO
-- O MetricActionWorker avalia estas regras a cada metrics_updated event
-- Todas as ações são reversíveis via /admin/metric-rules/:id/rollback-last
-- ──────────────────────────────────────────────────────────────
create table metric_rules (
  id                uuid primary key default uuid_generate_v4(),
  name              text not null,
  metric_name       text not null,
  condition         text not null check (condition in ('>','<','>=','<=','=')),
  threshold         numeric not null,
  action_type       text not null check (action_type in (
    'update_activation_template',
    'deprioritize_channel',
    'increase_notification_interval',
    'decrease_notification_interval',
    'activate_sequence',
    'pause_sequence',
    'change_incentive'
  )),
  action_payload    jsonb not null,
  cooldown_hours    int not null default 24,
  active            boolean default true,
  last_triggered_at timestamp,
  created_at        timestamp default now()
);

-- ──────────────────────────────────────────────────────────────
-- REGRAS PADRÃO (inseridas na migration)
-- ──────────────────────────────────────────────────────────────
insert into metric_rules (name, metric_name, condition, threshold, action_type, action_payload, cooldown_hours) values
  (
    'ttv1_alto',
    'ttv_1_hours', '>', 48,
    'update_activation_template',
    '{"template_variant":"more_direct","sequence":"activation"}',
    48
  ),
  (
    'email_baixa_conversao',
    'invite_acceptance_rate_email', '<', 0.2,
    'deprioritize_channel',
    '{"channel":"email","new_rank":3}',
    168
  ),
  (
    'engajamento_baixo',
    'weekly_active_residents_pct', '<', 0.3,
    'increase_notification_interval',
    '{"strategy":"value_only","min_days_between":5}',
    72
  );

-- ──────────────────────────────────────────────────────────────
-- INCENTIVOS DE MORADOR (recompensas por convites)
-- ──────────────────────────────────────────────────────────────
create table morador_invite_rewards (
  id                           uuid primary key default uuid_generate_v4(),
  profile_id                   uuid not null references profiles(id) on delete cascade,
  condominium_id               uuid not null references condominiums(id),
  invites_accepted             int default 0,
  reward_tier                  int default 0,
  priority_reservations_until  timestamp,
  extra_reservations_per_month int default 0,
  badge                        text,
  updated_at                   timestamp default now(),
  unique(profile_id, condominium_id)
);

-- ──────────────────────────────────────────────────────────────
-- CANAL STATS (ranking adaptativo de canais — atualizado semanalmente)
-- ──────────────────────────────────────────────────────────────
create table invite_channel_stats (
  id               uuid primary key default uuid_generate_v4(),
  condominium_id   uuid references condominiums(id),
  channel          text not null check (channel in ('whatsapp','email','qr','csv')),
  invites_sent     int default 0,
  invites_accepted int default 0,
  avg_hours_to_accept numeric,
  week_start       date not null,
  created_at       timestamp default now(),
  unique(condominium_id, channel, week_start)
);
