-- ============================================================
-- 020 — VIEWS MATERIALIZADAS E VIEWS REGULARES
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- TTV por condomínio (Time-to-Value nas 4 dimensões)
-- Atualizada pelo metrics-refresh.job.ts (job periódico, não em tempo real)
-- ──────────────────────────────────────────────────────────────
create materialized view ttv_by_condominium as
select
  c.id as condominium_id,
  c.name,
  extract(epoch from (
    min(e1.created_at) filter (where e1.event_name = 'invite_accepted')
    - min(e2.created_at) filter (where e2.event_name = 'user_registered')
  ))/3600 as ttv_1_hours,
  extract(epoch from (
    min(t.updated_at) filter (where t.status = 'resolved')
    - min(e2.created_at) filter (where e2.event_name = 'user_registered')
  ))/3600 as ttv_2_hours,
  extract(epoch from (
    min(e1.created_at) filter (where e1.event_name = 'roi_updated')
    - min(e2.created_at) filter (where e2.event_name = 'user_registered')
  ))/3600 as ttv_3_hours,
  extract(epoch from (
    min(p.created_at)
    - min(e2.created_at) filter (where e2.event_name = 'user_registered')
  ))/3600 as ttv_4_hours
from condominiums c
left join events e1 on e1.condo_id = c.id
left join events e2 on e2.condo_id = c.id
left join tickets t  on t.condominium_id = c.id
left join proposals p on p.condominium_id = c.id
group by c.id, c.name
with no data;

-- Índice necessário para refresh parcial por condomínio
create unique index idx_ttv_condo on ttv_by_condominium(condominium_id);

-- ──────────────────────────────────────────────────────────────
-- Ranking de engajamento por bloco
-- ──────────────────────────────────────────────────────────────
create materialized view block_engagement_ranking as
select
  b.id as block_id,
  b.name,
  b.condominium_id,
  count(distinct p.id) as total_residents,
  count(distinct p.id) filter (where p.is_active) as active_residents,
  round(
    count(distinct p.id) filter (where p.is_active)::numeric
    / nullif(count(distinct p.id), 0) * 100, 1
  ) as engagement_pct,
  rank() over (
    partition by b.condominium_id
    order by
      count(distinct p.id) filter (where p.is_active)::numeric
      / nullif(count(distinct p.id), 0) desc
  ) as rank_in_condo
from blocks b
left join units u    on u.block_id = b.id
left join profiles p on p.unit_id = u.id and p.role = 'morador'
group by b.id, b.name, b.condominium_id
with no data;

create unique index idx_block_engagement on block_engagement_ranking(block_id);

-- ──────────────────────────────────────────────────────────────
-- proposal_high_intent: abriu 2+ vezes, ficou >60s, não votou
-- VIEW REGULAR (não materializada — dados em tempo real)
-- ──────────────────────────────────────────────────────────────
create view proposal_high_intent as
select
  pi.proposal_id,
  p.condominium_id,
  sum(pi.visit_count) as total_views,
  max(pi.time_on_page_seconds) as max_time_seconds,
  bool_or(pi.action = 'approved') as has_vote,
  (
    sum(pi.visit_count) >= 2
    and max(pi.time_on_page_seconds) > 60
    and not bool_or(pi.action = 'approved')
  ) as is_high_intent
from proposal_interactions pi
join proposals p on p.id = pi.proposal_id
group by pi.proposal_id, p.condominium_id;
