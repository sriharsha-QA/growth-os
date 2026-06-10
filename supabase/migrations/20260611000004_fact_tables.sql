-- M04: fact tables — metric_snapshots (+ audit trail), daily_activities
-- One canonical value per (trackable, local_date, metric_type); corrections are audited.

create table public.metric_snapshots (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  trackable_id uuid not null references public.trackables (id) on delete cascade,
  local_date   date not null,
  metric_type  public.metric_type not null,
  value        numeric not null check (value >= 0),
  source       public.snapshot_source not null default 'manual',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (trackable_id, local_date, metric_type)
);

-- Hot-path covering index (v3.1 §5)
create index idx_snapshots_series
  on public.metric_snapshots (trackable_id, metric_type, local_date)
  include (value);

create trigger trg_snapshots_updated_at before update on public.metric_snapshots
  for each row execute function public.fn_set_updated_at();

-- Correction history: written only by trigger (security definer); never by users.
create table public.snapshot_audit (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  snapshot_id uuid not null references public.metric_snapshots (id) on delete cascade,
  old_value   numeric not null,
  new_value   numeric not null,
  changed_by  uuid,
  changed_at  timestamptz not null default now(),
  reason      text
);

create index idx_snapshot_audit_snapshot on public.snapshot_audit (snapshot_id, changed_at);

create or replace function public.fn_snapshot_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.value is distinct from old.value then
    insert into public.snapshot_audit (user_id, snapshot_id, old_value, new_value, changed_by)
    values (new.user_id, new.id, old.value, new.value, auth.uid());
  end if;
  return new;
end;
$$;

create trigger trg_snapshot_audit
  after update on public.metric_snapshots
  for each row execute function public.fn_snapshot_audit();

-- Leading indicators (inputs, not outcomes). EAV by activity_key so future
-- domains define their own input metrics with zero migrations. v3.0 §1 ruling 3.
create table public.daily_activities (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  trackable_id uuid not null references public.trackables (id) on delete cascade,
  local_date   date not null,
  activity_key text not null check (activity_key ~ '^[a-z][a-z0-9_]{1,49}$'),
  count        int  not null check (count >= 0),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (trackable_id, local_date, activity_key)
);

create index idx_activities_date on public.daily_activities (trackable_id, local_date);

create trigger trg_activities_updated_at before update on public.daily_activities
  for each row execute function public.fn_set_updated_at();

-- RLS
alter table public.metric_snapshots enable row level security;
alter table public.snapshot_audit   enable row level security;
alter table public.daily_activities enable row level security;

create policy snapshots_all on public.metric_snapshots
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.fn_owns_trackable(trackable_id));

create policy snapshot_audit_select on public.snapshot_audit
  for select using (user_id = auth.uid());
-- no insert/update/delete policies: direct writes by users are denied by default

create policy activities_all on public.daily_activities
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.fn_owns_trackable(trackable_id));
