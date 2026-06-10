-- M06: insights engine storage + system observability
-- Insights are INSERTed only by the service role (nightly job / post-log generation).
-- Users may read them and update lifecycle columns only — enforced by a
-- column-level GRANT, not just policy, so message/payload are immutable to users.

create table public.insights (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  challenge_id       uuid not null references public.challenges (id) on delete cascade,
  rule_key           text not null,
  severity           public.insight_severity not null default 'info',
  message            text not null,
  payload            jsonb not null default '{}'::jsonb,
  status             public.insight_status not null default 'new',
  suppressed_until   date,
  generated_for_date date not null,
  generated_at       timestamptz not null default now(),
  unique (challenge_id, rule_key, generated_for_date)  -- idempotent generation (v3.1 S4)
);

create index idx_insights_active on public.insights (challenge_id, status, generated_for_date desc);

create table public.sync_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  provider    text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  status      public.sync_status,
  error       text,
  summary     jsonb not null default '{}'::jsonb
);

create index idx_sync_runs_recent on public.sync_runs (user_id, provider, started_at desc);

create table public.notification_log (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  type         text not null,
  channel      text not null default 'email',
  sent_at      timestamptz not null default now(),
  dismissed_at timestamptz
);

-- RLS
alter table public.insights         enable row level security;
alter table public.sync_runs        enable row level security;
alter table public.notification_log enable row level security;

create policy insights_select on public.insights
  for select using (user_id = auth.uid());
create policy insights_update_lifecycle on public.insights
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- column-level enforcement: authenticated may update ONLY lifecycle columns
revoke update on public.insights from authenticated;
grant  update (status, suppressed_until) on public.insights to authenticated;

create policy sync_runs_select on public.sync_runs
  for select using (user_id = auth.uid());

create policy notification_log_select on public.notification_log
  for select using (user_id = auth.uid());
create policy notification_log_dismiss on public.notification_log
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.notification_log from authenticated;
grant  update (dismissed_at) on public.notification_log to authenticated;
