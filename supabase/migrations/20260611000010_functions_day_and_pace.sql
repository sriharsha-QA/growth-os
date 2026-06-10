-- M10: canonical math — fn_local_date, fn_day_index, fn_pace_target
-- THE single source of day and pace math (v3.0 guardrail T1/T4).
-- TypeScript calls these (via views or RPC); it never reimplements them.

-- A "challenge day" is the local calendar date after applying the user's
-- day-rollover hour: activity at 00:30 with a 04:00 rollover belongs to the
-- previous date. STABLE (not IMMUTABLE) because timezone() consults tz data.
create or replace function public.fn_local_date(
  ts timestamptz,
  tz text,
  rollover time
) returns date
language sql
stable
parallel safe
set search_path = public
as $$
  select case
    when (timezone(tz, ts))::time < rollover
      then ((timezone(tz, ts))::date - 1)
    else (timezone(tz, ts))::date
  end;
$$;

-- Day index within a challenge: Day 1 = start_date. Clamped to [0, duration+1]:
-- 0 = before start, duration+1 = after end (sentinel semantics, documented).
create or replace function public.fn_day_index(
  p_challenge_id uuid,
  p_ts timestamptz default now()
) returns int
language sql
stable
set search_path = public
as $$
  select greatest(0, least(c.duration_days + 1,
           (public.fn_local_date(p_ts, p.timezone, p.day_rollover_hour) - c.start_date) + 1))
  from public.challenges c
  join public.profiles p on p.id = c.user_id
  where c.id = p_challenge_id;
$$;

-- Expected value at day d of D.
--   linear:       baseline + (target - baseline) * d/D
--   compounding:  baseline * (target/baseline)^(d/D)   — works for both directions:
--                 ratio > 1 grows, ratio < 1 decays (decrease targets).
-- Guards (fall back to linear): baseline <= 0, target <= 0, ratio = 1 trivial,
-- or direction/target sign mismatch. d clamped to [0, D]. IMMUTABLE.
create or replace function public.fn_pace_target(
  p_baseline  numeric,
  p_target    numeric,
  p_direction public.direction,
  p_model     public.pacing_model,
  p_day       int,
  p_duration  int
) returns numeric
language plpgsql
immutable
parallel safe
set search_path = public
as $$
declare
  d numeric := greatest(0, least(coalesce(p_day, 0), p_duration));
  frac numeric;
begin
  if p_duration is null or p_duration <= 0 then
    return p_baseline;
  end if;
  frac := d / p_duration::numeric;

  if p_model = 'compounding'
     and p_baseline > 0
     and p_target  > 0
     and p_target <> p_baseline
     and ((p_direction = 'increase' and p_target > p_baseline)
       or (p_direction = 'decrease' and p_target < p_baseline))
  then
    return round(p_baseline * power(p_target / p_baseline, frac), 4);
  end if;

  -- linear (also the guarded fallback)
  return round(p_baseline + (p_target - p_baseline) * frac, 4);
end;
$$;
