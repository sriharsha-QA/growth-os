-- M03: the spine — challenges, trackables, target_history
-- A trackable is anything with a number, baseline, target, direction, unit. v3.0 §1.
-- Design note (deviation from v3.1, ratified): primary_metric is promoted from
-- config jsonb to a typed column — every trackable measures *something*, so the
-- spine owns it; platform-only details (handle, sync provider, token ref) stay in config.

create table public.challenges (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  name          text not null,
  start_date    date not null,
  duration_days int  not null default 90 check (duration_days between 1 and 3650),
  pacing_model  public.pacing_model not null default 'compounding',
  status        public.challenge_status not null default 'active',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.trackables (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  challenge_id   uuid not null references public.challenges (id) on delete cascade,
  name           text not null,
  kind           public.trackable_kind not null default 'platform_account',
  direction      public.direction not null default 'increase',
  unit           text not null default 'followers',
  primary_metric public.metric_type not null default 'followers',
  baseline_value numeric not null default 0,
  target_value   numeric not null,
  config         jsonb not null default '{}'::jsonb,  -- platform, handle, oauth_token_ref, etc.
  sync_enabled   boolean not null default false,
  sort_order     real not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (challenge_id, name),
  constraint trackable_target_direction check (
    (direction = 'increase' and target_value >= baseline_value) or
    (direction = 'decrease' and target_value <= baseline_value)
  )
);

create table public.target_history (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  trackable_id uuid not null references public.trackables (id) on delete cascade,
  old_target   numeric not null,
  new_target   numeric not null,
  reason       text,
  changed_at   timestamptz not null default now()
);

create index idx_trackables_challenge on public.trackables (challenge_id, sort_order);
create index idx_target_history_trackable on public.target_history (trackable_id, changed_at);

create trigger trg_challenges_updated_at before update on public.challenges for each row execute function public.fn_set_updated_at();
create trigger trg_trackables_updated_at before update on public.trackables for each row execute function public.fn_set_updated_at();

-- Recalibration audit: every target change is mirrored automatically.
create or replace function public.fn_record_target_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_value is distinct from old.target_value then
    insert into public.target_history (user_id, trackable_id, old_target, new_target)
    values (new.user_id, new.id, old.target_value, new.target_value);
  end if;
  return new;
end;
$$;

create trigger trg_trackables_target_history
  after update on public.trackables
  for each row execute function public.fn_record_target_change();

-- Ownership helpers: parent-integrity checks for child-table policies.
-- WITH CHECK (user_id = auth.uid()) alone is NOT enough — FK validation bypasses
-- RLS, so a user could attach their own rows to another user's parent. Caught by
-- the two-user sweep; closed here and in every child table's policy.
create or replace function public.fn_owns_challenge(p_id uuid)
returns boolean language sql stable set search_path = public
as $$ select exists (select 1 from public.challenges c where c.id = p_id and c.user_id = auth.uid()) $$;

create or replace function public.fn_owns_trackable(p_id uuid)
returns boolean language sql stable set search_path = public
as $$ select exists (select 1 from public.trackables t where t.id = p_id and t.user_id = auth.uid()) $$;

-- RLS
alter table public.challenges     enable row level security;
alter table public.trackables     enable row level security;
alter table public.target_history enable row level security;

create policy challenges_all on public.challenges
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy trackables_all on public.trackables
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.fn_owns_challenge(challenge_id));
create policy target_history_select on public.target_history
  for select using (user_id = auth.uid());
-- inserts come from the trigger (definer) or service role; users do not write history directly.
-- Users MAY annotate a recalibration with a reason — and only a reason
-- (column-level grant, same pattern as insights lifecycle columns).
create policy target_history_update_reason on public.target_history
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
revoke update on public.target_history from authenticated;
grant  update (reason) on public.target_history to authenticated;
