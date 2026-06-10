-- M08: money module — leads pipeline + monetization events
-- Currency triple (amount, currency, base_amount, fx_rate) is stored at entry
-- time and never recomputed historically (v2.0 M3).

create table public.leads (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  challenge_id    uuid not null references public.challenges (id) on delete cascade,
  name            text not null,
  note            text,
  stage           public.lead_stage not null default 'new',
  value_estimate  numeric check (value_estimate is null or value_estimate >= 0),
  source_platform public.platform,
  content_item_id uuid references public.content_items (id) on delete set null,
  opened_at       date not null default current_date,
  closed_at       date,
  closed_amount   numeric check (closed_amount is null or closed_amount >= 0),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint lead_closed_consistency check (
    (stage in ('won','lost')) = (closed_at is not null)
  )
);

create index idx_leads_pipeline on public.leads (challenge_id, stage);

create table public.monetization_events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  challenge_id    uuid not null references public.challenges (id) on delete cascade,
  event_type      public.event_type not null,
  amount          numeric check (amount is null or amount >= 0),
  currency        char(3),
  base_amount     numeric check (base_amount is null or base_amount >= 0),
  fx_rate         numeric check (fx_rate is null or fx_rate > 0),
  recurrence      public.recurrence not null default 'one_time',  -- MRR view dormant
  category        text,
  source_platform public.platform,
  content_item_id uuid references public.content_items (id) on delete set null,
  lead_id         uuid references public.leads (id) on delete set null,
  occurred_on     date not null default current_date,
  note            text,
  created_at      timestamptz not null default now(),
  -- revenue events must carry the full currency triple; non-revenue must not carry amounts
  constraint money_currency_triple check (
    (event_type = 'revenue' and amount is not null and currency is not null and base_amount is not null)
    or (event_type <> 'revenue' and amount is null)
  )
);

create index idx_money_events on public.monetization_events (challenge_id, occurred_on desc);

create trigger trg_leads_updated_at before update on public.leads
  for each row execute function public.fn_set_updated_at();

-- RLS
alter table public.leads               enable row level security;
alter table public.monetization_events enable row level security;

create or replace function public.fn_owns_lead(p_id uuid)
returns boolean language sql stable set search_path = public
as $$ select exists (select 1 from public.leads l where l.id = p_id and l.user_id = auth.uid()) $$;

create policy leads_all on public.leads
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and public.fn_owns_challenge(challenge_id)
              and (content_item_id is null or public.fn_owns_content_item(content_item_id)));
create policy money_all on public.monetization_events
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid()
              and public.fn_owns_challenge(challenge_id)
              and (content_item_id is null or public.fn_owns_content_item(content_item_id))
              and (lead_id is null or public.fn_owns_lead(lead_id)));
