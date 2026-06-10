-- M05: engagement spine — check_ins, annotations, weekly_reviews

create table public.check_ins (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  local_date   date not null,
  type         public.checkin_type not null,
  completed_at timestamptz not null default now(),
  unique (challenge_id, local_date, type)
);

create index idx_check_ins_challenge on public.check_ins (challenge_id, local_date);

create table public.annotations (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  trackable_id uuid references public.trackables (id) on delete set null,
  local_date   date not null,
  label        text not null,
  kind         public.annotation_kind not null default 'manual',
  source_id    uuid,  -- e.g. content_item id for auto_publish; enables idempotency
  created_at   timestamptz not null default now(),
  unique (challenge_id, kind, source_id, local_date)
);

create index idx_annotations_date on public.annotations (challenge_id, local_date);

create table public.weekly_reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  week_number  int not null check (week_number between 1 and 522),
  summary      jsonb not null default '{}'::jsonb,
  reflections  jsonb not null default '{}'::jsonb,
  completed_at timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (challenge_id, week_number)
);

create trigger trg_weekly_reviews_updated_at before update on public.weekly_reviews
  for each row execute function public.fn_set_updated_at();

-- RLS
alter table public.check_ins      enable row level security;
alter table public.annotations    enable row level security;
alter table public.weekly_reviews enable row level security;

create policy check_ins_all on public.check_ins
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.fn_owns_challenge(challenge_id));
create policy annotations_all on public.annotations
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and public.fn_owns_challenge(challenge_id)
              and (trackable_id is null or public.fn_owns_trackable(trackable_id)));
create policy weekly_reviews_all on public.weekly_reviews
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.fn_owns_challenge(challenge_id));
