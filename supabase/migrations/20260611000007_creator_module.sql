-- M07: creator module — content pipeline (FKs into the spine, never alters it)

create table public.content_pillars (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  name         text not null,
  color        text not null default '#64748b',
  created_at   timestamptz not null default now(),
  unique (challenge_id, name)
);

create table public.content_items (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  challenge_id   uuid not null references public.challenges (id) on delete cascade,
  trackable_id   uuid references public.trackables (id) on delete set null,
  pillar_id      uuid references public.content_pillars (id) on delete set null,
  title          text not null,
  format         public.content_format not null default 'text_post',
  status         public.content_status not null default 'idea',
  planned_date   date,
  published_at   timestamptz,
  url            text,
  subreddit      text,            -- dormant until per-subreddit rollups activate
  effort_minutes int check (effort_minutes is null or effort_minutes >= 0),  -- dormant
  source_url     text,            -- idea capture provenance
  sort_order     real not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index idx_content_items_board   on public.content_items (challenge_id, status, sort_order);
create index idx_content_items_publish on public.content_items (challenge_id, status, published_at desc);

create table public.content_metrics (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  content_item_id uuid not null references public.content_items (id) on delete cascade,
  captured_at     timestamptz not null default now(),
  capture_label   text not null default 'adhoc' check (capture_label in ('48h','7d','adhoc')),
  impressions     int check (impressions  is null or impressions  >= 0),
  reactions       int check (reactions    is null or reactions    >= 0),
  comments        int check (comments     is null or comments     >= 0),
  shares          int check (shares       is null or shares       >= 0),
  views           int check (views        is null or views        >= 0),
  reads           int check (reads        is null or reads        >= 0),
  claps           int check (claps        is null or claps        >= 0),
  upvotes         int check (upvotes      is null or upvotes      >= 0)
);

create index idx_content_metrics_item on public.content_metrics (content_item_id, captured_at desc);

create table public.weekly_targets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  trackable_id uuid references public.trackables (id) on delete cascade,
  format       public.content_format,
  target_count int not null check (target_count >= 0),
  unique (challenge_id, trackable_id, format)
);

create trigger trg_content_items_updated_at before update on public.content_items
  for each row execute function public.fn_set_updated_at();

-- Chart context for free: publishing creates an annotation, exactly once.
create or replace function public.fn_auto_annotate_publish()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tz text;
  v_rollover time;
  v_date date;
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    select p.timezone, p.day_rollover_hour into v_tz, v_rollover
    from public.profiles p where p.id = new.user_id;

    v_date := public.fn_local_date(coalesce(new.published_at, now()), coalesce(v_tz,'UTC'), coalesce(v_rollover,'04:00'::time));

    insert into public.annotations (user_id, challenge_id, trackable_id, local_date, label, kind, source_id)
    values (new.user_id, new.challenge_id, new.trackable_id, v_date,
            'Published: ' || left(new.title, 80), 'auto_publish', new.id)
    on conflict (challenge_id, kind, source_id, local_date) do nothing;
  end if;
  return new;
end;
$$;

create trigger trg_content_auto_annotate
  after update on public.content_items
  for each row execute function public.fn_auto_annotate_publish();

-- RLS
alter table public.content_pillars enable row level security;
alter table public.content_items   enable row level security;
alter table public.content_metrics enable row level security;
alter table public.weekly_targets  enable row level security;

-- Ownership helpers for this module's children
create or replace function public.fn_owns_pillar(p_id uuid)
returns boolean language sql stable set search_path = public
as $$ select exists (select 1 from public.content_pillars p where p.id = p_id and p.user_id = auth.uid()) $$;

create or replace function public.fn_owns_content_item(p_id uuid)
returns boolean language sql stable set search_path = public
as $$ select exists (select 1 from public.content_items i where i.id = p_id and i.user_id = auth.uid()) $$;

create policy content_pillars_all on public.content_pillars
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.fn_owns_challenge(challenge_id));
create policy content_items_all on public.content_items
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and public.fn_owns_challenge(challenge_id)
              and (trackable_id is null or public.fn_owns_trackable(trackable_id))
              and (pillar_id is null or public.fn_owns_pillar(pillar_id)));
create policy content_metrics_all on public.content_metrics
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.fn_owns_content_item(content_item_id));
create policy weekly_targets_all on public.weekly_targets
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and public.fn_owns_challenge(challenge_id)
              and (trackable_id is null or public.fn_owns_trackable(trackable_id)));
