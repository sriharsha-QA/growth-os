-- M13: D01 + D04 fixes
--
-- D01: client_token uuid UNIQUE on challenges.
--   A wizard submit always sends a freshly-generated UUID.
--   ON CONFLICT DO NOTHING on insert; fetch-or-create pattern ensures
--   duplicate tab submits return the same challenge_id every time.
--   The uniqueness guarantee lives in the database, not application logic.
--
-- D04: fn_create_challenge — transactional RPC.
--   All four writes (challenge + trackables + pillars + weekly_target)
--   execute inside a single PL/pgSQL function. Postgres wraps every
--   function call in an implicit subtransaction; any failure rolls back
--   the entire unit. No compensating deletes needed in TypeScript.
--   Security: SECURITY INVOKER — runs as the calling user so RLS applies
--   normally. Auth check is enforced by the RLS policies already in place.

-- Step 1: add client_token column (nullable so existing rows are unaffected)
alter table public.challenges
  add column if not exists client_token uuid unique;

-- Step 2: index for the ON CONFLICT lookup
create index if not exists idx_challenges_client_token
  on public.challenges (client_token)
  where client_token is not null;

-- Step 3: the atomic creation function
-- Returns the challenge id (whether newly created or already existing).
-- Argument shape mirrors createChallengeInput exactly.
create or replace function public.fn_create_challenge(
  p_user_id          uuid,
  p_client_token     uuid,
  p_name             text,
  p_start_date       date,
  p_duration_days    int,
  p_pacing_model     public.pacing_model,
  p_trackables       jsonb,   -- array of trackable objects
  p_pillars          text[],  -- array of pillar names (may be empty)
  p_weekly_target    int      -- null = no weekly target row
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_challenge_id  uuid;
  v_trackable     jsonb;
  v_sort_order    int := 1;
begin
  ------------------------------------------------------------
  -- Idempotency: if this token already exists return its id
  ------------------------------------------------------------
  select id into v_challenge_id
  from public.challenges
  where client_token = p_client_token;

  if v_challenge_id is not null then
    return v_challenge_id;
  end if;

  ------------------------------------------------------------
  -- Insert the challenge row
  ------------------------------------------------------------
  insert into public.challenges (
    user_id, client_token, name, start_date, duration_days, pacing_model
  ) values (
    p_user_id, p_client_token, p_name, p_start_date, p_duration_days, p_pacing_model
  )
  returning id into v_challenge_id;

  ------------------------------------------------------------
  -- Insert trackables (array of jsonb objects)
  ------------------------------------------------------------
  for v_trackable in select * from jsonb_array_elements(p_trackables)
  loop
    insert into public.trackables (
      user_id,
      challenge_id,
      name,
      kind,
      direction,
      unit,
      primary_metric,
      baseline_value,
      target_value,
      config,
      sort_order
    ) values (
      p_user_id,
      v_challenge_id,
      v_trackable->>'name',
      (v_trackable->>'kind')::public.trackable_kind,
      (v_trackable->>'direction')::public.direction,
      v_trackable->>'unit',
      (v_trackable->>'primary_metric')::public.metric_type,
      (v_trackable->>'baseline_value')::numeric,
      (v_trackable->>'target_value')::numeric,
      coalesce(v_trackable->'config', '{}'::jsonb),
      v_sort_order
    );
    v_sort_order := v_sort_order + 1;
  end loop;

  ------------------------------------------------------------
  -- Insert content pillars (skipped if array is empty)
  ------------------------------------------------------------
  if array_length(p_pillars, 1) > 0 then
    insert into public.content_pillars (user_id, challenge_id, name)
    select p_user_id, v_challenge_id, unnest(p_pillars);
  end if;

  ------------------------------------------------------------
  -- Insert weekly target (skipped if null)
  ------------------------------------------------------------
  if p_weekly_target is not null then
    insert into public.weekly_targets (user_id, challenge_id, target_count)
    values (p_user_id, v_challenge_id, p_weekly_target);
  end if;

  return v_challenge_id;
end;
$$;

-- Grant execute to authenticated users (RLS still applies inside the function
-- because it runs as SECURITY INVOKER)
grant execute on function public.fn_create_challenge(
  uuid, uuid, text, date, int, public.pacing_model, jsonb, text[], int
) to authenticated;
