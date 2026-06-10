-- M11: read-model views — ALL created with security_invoker = on (v3.1 X1).
-- Clients never hand-aggregate raw rows; these views are the contract.

-- Per-trackable daily progress for the primary metric.
create or replace view public.v_daily_progress
with (security_invoker = on)
as
with series as (
  select
    s.user_id,
    s.trackable_id,
    s.local_date,
    s.value,
    lag(s.value)      over w as prev_value,
    lag(s.value, 7)   over w as value_7_back,
    lag(s.local_date, 7) over w as date_7_back
  from public.metric_snapshots s
  join public.trackables t on t.id = s.trackable_id
  where s.metric_type = t.primary_metric
  window w as (partition by s.trackable_id order by s.local_date)
)
select
  se.user_id,
  t.challenge_id,
  se.trackable_id,
  t.name,
  t.unit,
  t.direction,
  t.baseline_value,
  t.target_value,
  se.local_date,
  (se.local_date - c.start_date) + 1                       as day_index,
  se.value,
  se.value - se.prev_value                                  as delta,
  public.fn_pace_target(
    t.baseline_value, t.target_value, t.direction,
    c.pacing_model, (se.local_date - c.start_date) + 1, c.duration_days
  )                                                         as pace_target,
  case
    when t.target_value = t.baseline_value then 1
    else round((se.value - t.baseline_value) / (t.target_value - t.baseline_value), 4)
  end                                                       as pct_of_target,
  case
    when se.date_7_back is not null and se.local_date > se.date_7_back
      then round((se.value - se.value_7_back) / (se.local_date - se.date_7_back)::numeric, 2)
  end                                                       as velocity_7d,
  case
    when c.duration_days - ((se.local_date - c.start_date) + 1) > 0
      then round((t.target_value - se.value)
                 / (c.duration_days - ((se.local_date - c.start_date) + 1))::numeric, 2)
    else t.target_value - se.value
  end                                                       as required_velocity
from series se
join public.trackables t on t.id = se.trackable_id
join public.challenges c on c.id = t.challenge_id;

-- Pivoted convenience view: common metrics side by side per trackable/day.
create or replace view public.v_daily_wide
with (security_invoker = on)
as
select
  s.user_id,
  s.trackable_id,
  s.local_date,
  max(s.value) filter (where s.metric_type = 'followers')      as followers,
  max(s.value) filter (where s.metric_type = 'karma')          as karma,
  max(s.value) filter (where s.metric_type = 'value')          as value,
  max(s.value) filter (where s.metric_type = 'subscribers')    as subscribers,
  max(s.value) filter (where s.metric_type = 'impressions')    as impressions,
  max(s.value) filter (where s.metric_type = 'profile_views')  as profile_views,
  max(s.value) filter (where s.metric_type = 'views')          as views,
  max(s.value) filter (where s.metric_type = 'reads')          as reads,
  max(s.value) filter (where s.metric_type = 'read_ratio')     as read_ratio,
  max(s.value) filter (where s.metric_type = 'claps')          as claps
from public.metric_snapshots s
group by s.user_id, s.trackable_id, s.local_date;

-- Content items joined with their latest performance capture.
create or replace view public.v_content_performance
with (security_invoker = on)
as
select
  ci.user_id,
  ci.challenge_id,
  ci.id as content_item_id,
  ci.title,
  ci.format,
  ci.status,
  ci.pillar_id,
  ci.trackable_id,
  ci.published_at,
  ci.url,
  cm.captured_at as metrics_captured_at,
  cm.impressions, cm.reactions, cm.comments, cm.shares,
  cm.views, cm.reads, cm.claps, cm.upvotes,
  case
    when coalesce(cm.impressions, 0) > 0
      then round((coalesce(cm.reactions,0) + coalesce(cm.comments,0))::numeric
                 / cm.impressions, 4)
  end as engagement_rate
from public.content_items ci
left join lateral (
  select * from public.content_metrics m
  where m.content_item_id = ci.id
  order by m.captured_at desc
  limit 1
) cm on true;

-- Revenue and proto-revenue attribution (base currency).
create or replace view public.v_revenue_attribution
with (security_invoker = on)
as
select
  e.user_id,
  e.challenge_id,
  e.source_platform,
  ci.pillar_id,
  count(*) filter (where e.event_type = 'revenue')                          as revenue_events,
  coalesce(sum(e.base_amount) filter (where e.event_type = 'revenue'), 0)   as total_revenue,
  coalesce(sum(e.base_amount) filter (where e.event_type = 'revenue'
                                        and e.recurrence = 'monthly'), 0)   as mrr,
  count(*) filter (where e.event_type = 'signup')                           as signups,
  count(*) filter (where e.event_type = 'booking')                          as bookings
from public.monetization_events e
left join public.content_items ci on ci.id = e.content_item_id
group by e.user_id, e.challenge_id, e.source_platform, ci.pillar_id;

-- Funnel: signups → open leads → won leads, per challenge.
create or replace view public.v_funnel
with (security_invoker = on)
as
select
  c.user_id,
  c.id as challenge_id,
  (select count(*) from public.monetization_events e
    where e.challenge_id = c.id and e.event_type = 'signup')               as signups,
  (select count(*) from public.leads l
    where l.challenge_id = c.id)                                            as leads_total,
  (select count(*) from public.leads l
    where l.challenge_id = c.id and l.stage not in ('won','lost'))          as leads_open,
  (select count(*) from public.leads l
    where l.challenge_id = c.id and l.stage = 'won')                        as leads_won,
  (select coalesce(sum(l.closed_amount), 0) from public.leads l
    where l.challenge_id = c.id and l.stage = 'won')                        as won_amount
from public.challenges c;
