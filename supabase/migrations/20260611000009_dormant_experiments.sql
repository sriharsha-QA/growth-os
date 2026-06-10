-- M09: experiments — DORMANT (schema-ready, zero app references; CI grep-gated)
-- Activates when ≥2 decisions have been made from correlation insights (v3.0 §3).

create table public.experiments (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  challenge_id     uuid not null references public.challenges (id) on delete cascade,
  hypothesis       text not null,
  variable         text not null,
  start_local_date date not null,
  end_local_date   date not null check (end_local_date >= start_local_date),
  result           jsonb not null default '{}'::jsonb,
  verdict          text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create trigger trg_experiments_updated_at before update on public.experiments
  for each row execute function public.fn_set_updated_at();

alter table public.experiments enable row level security;
create policy experiments_all on public.experiments
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.fn_owns_challenge(challenge_id));
