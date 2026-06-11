-- Test suite 03: fn_create_challenge — D01 idempotency + D04 atomicity.
--
-- Run as superuser (same as suites 01 and 02).
-- All assertions raise exceptions on failure; test runner treats any non-zero
-- exit as a test failure.

-- ----------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------
do $$
declare
  uid          uuid;
  token_a      uuid := gen_random_uuid();
  token_b      uuid := gen_random_uuid();
  challenge_a  uuid;
  challenge_b  uuid;
  challenge_a2 uuid;    -- second call with same token
  trackable_count int;
  pillar_count    int;
  target_count    int;
  challenge_count int;

  -- A minimal but valid trackables payload
  v_trackables jsonb := '[
    {
      "name": "LinkedIn",
      "kind": "platform_account",
      "direction": "increase",
      "unit": "followers",
      "primary_metric": "followers",
      "baseline_value": 1100,
      "target_value": 5000,
      "config": {"platform": "linkedin"}
    },
    {
      "name": "Reddit",
      "kind": "platform_account",
      "direction": "increase",
      "unit": "karma",
      "primary_metric": "karma",
      "baseline_value": 2200,
      "target_value": 5000,
      "config": {"platform": "reddit"}
    }
  ]'::jsonb;

begin
  -- seed a test user
  insert into auth.users (email) values ('d01-d04-test@example.com')
  returning id into uid;

  -- ----------------------------------------------------------------
  -- D04 test 1: Happy path — all four writes succeed atomically
  -- ----------------------------------------------------------------
  challenge_a := public.fn_create_challenge(
    uid,
    token_a,
    'D04 test challenge',
    '2026-06-11'::date,
    90,
    'compounding'::public.pacing_model,
    v_trackables,
    ARRAY['build-in-public', 'lessons-learned'],
    5   -- weekly_target
  );

  if challenge_a is null then
    raise exception 'D04 happy path: fn_create_challenge returned null';
  end if;

  select count(*) into trackable_count
  from public.trackables where challenge_id = challenge_a;
  if trackable_count <> 2 then
    raise exception 'D04 happy path: expected 2 trackables, got %', trackable_count;
  end if;

  select count(*) into pillar_count
  from public.content_pillars where challenge_id = challenge_a;
  if pillar_count <> 2 then
    raise exception 'D04 happy path: expected 2 pillars, got %', pillar_count;
  end if;

  select count(*) into target_count
  from public.weekly_targets where challenge_id = challenge_a;
  if target_count <> 1 then
    raise exception 'D04 happy path: expected 1 weekly_target, got %', target_count;
  end if;

  raise notice 'D04 TEST 1 PASSED: happy path — challenge + 2 trackables + 2 pillars + weekly_target';

  -- ----------------------------------------------------------------
  -- D04 test 2: Atomicity — bad trackable rolls back the whole unit
  -- Inject a trackable with an invalid primary_metric enum value.
  -- The cast inside the function must fail, rolling back the challenge insert.
  -- ----------------------------------------------------------------
  declare
    bad_trackables jsonb := '[
      {
        "name": "LinkedIn",
        "kind": "platform_account",
        "direction": "increase",
        "unit": "followers",
        "primary_metric": "NOT_A_REAL_METRIC",
        "baseline_value": 100,
        "target_value": 5000,
        "config": {}
      }
    ]'::jsonb;
    v_token_bad uuid := gen_random_uuid();
  begin
    begin
      perform public.fn_create_challenge(
        uid,
        v_token_bad,
        'Should roll back',
        '2026-06-11'::date,
        90,
        'compounding'::public.pacing_model,
        bad_trackables,
        ARRAY[]::text[],
        null
      );
      raise exception 'D04 atomicity: expected error from bad enum cast, but none raised';
    exception when others then
      null; -- expected — the cast fails inside the function
    end;

    -- Verify no challenge row leaked
    select count(*) into challenge_count
    from public.challenges
    where user_id = uid and name = 'Should roll back';
    if challenge_count <> 0 then
      raise exception 'D04 atomicity FAIL: challenge row leaked after trackable insert error (% rows)', challenge_count;
    end if;

    -- Verify the bad token is not in the challenges table
    if exists (select 1 from public.challenges where client_token = v_token_bad) then
      raise exception 'D04 atomicity FAIL: client_token leaked after rollback';
    end if;
  end;

  raise notice 'D04 TEST 2 PASSED: bad trackable enum rolls back challenge row — no partial state';

  -- ----------------------------------------------------------------
  -- D04 test 3: weekly_target failure rolls back the whole unit.
  -- weekly_targets has check (target_count >= 0). Pass -1 to trigger it.
  -- ----------------------------------------------------------------
  declare
    v_token_neg uuid := gen_random_uuid();
  begin
    begin
      perform public.fn_create_challenge(
        uid,
        v_token_neg,
        'Should also roll back',
        '2026-06-11'::date,
        90,
        'linear'::public.pacing_model,
        v_trackables,
        ARRAY[]::text[],
        -1   -- violates check (target_count >= 0)
      );
      raise exception 'D04 weekly_target: expected check violation, none raised';
    exception when check_violation then
      null; -- expected
    end;

    -- Verify no challenge, trackable, or pillar rows leaked
    if exists (select 1 from public.challenges where client_token = v_token_neg) then
      raise exception 'D04 weekly_target FAIL: challenge row leaked after weekly_target check failure';
    end if;
    if exists (select 1 from public.trackables t
               join public.challenges c on c.id = t.challenge_id
               where c.client_token = v_token_neg) then
      raise exception 'D04 weekly_target FAIL: trackable rows leaked';
    end if;
  end;

  raise notice 'D04 TEST 3 PASSED: weekly_target check failure rolls back challenge + trackables — no partial state';

  -- ----------------------------------------------------------------
  -- D01 test 1: Double submit with same client_token → same challenge id
  -- ----------------------------------------------------------------
  challenge_a2 := public.fn_create_challenge(
    uid,
    token_a,               -- SAME TOKEN as the first call above
    'D04 test challenge',  -- same name too
    '2026-06-11'::date,
    90,
    'compounding'::public.pacing_model,
    v_trackables,
    ARRAY['build-in-public', 'lessons-learned'],
    5
  );

  if challenge_a2 is distinct from challenge_a then
    raise exception 'D01 FAIL: double submit returned different id: % vs %', challenge_a, challenge_a2;
  end if;

  -- Verify no duplicate challenge row was created
  select count(*) into challenge_count
  from public.challenges
  where client_token = token_a;
  if challenge_count <> 1 then
    raise exception 'D01 FAIL: expected 1 challenge for token, found %', challenge_count;
  end if;

  -- Verify no duplicate trackables were inserted
  select count(*) into trackable_count
  from public.trackables where challenge_id = challenge_a;
  if trackable_count <> 2 then
    raise exception 'D01 FAIL: trackable count after double submit: % (expected 2)', trackable_count;
  end if;

  raise notice 'D01 TEST 1 PASSED: double submit with same token returns same challenge_id (%), one row in DB', challenge_a;

  -- ----------------------------------------------------------------
  -- D01 test 2: Different token → new challenge (not suppressed)
  -- ----------------------------------------------------------------
  -- Mark first challenge as abandoned so another active one can be created
  update public.challenges set status = 'abandoned' where id = challenge_a;

  challenge_b := public.fn_create_challenge(
    uid,
    token_b,               -- DIFFERENT TOKEN
    'Second challenge',
    '2026-07-01'::date,
    90,
    'linear'::public.pacing_model,
    v_trackables,
    ARRAY[]::text[],
    null
  );

  if challenge_b is null then
    raise exception 'D01 different token: fn_create_challenge returned null';
  end if;
  if challenge_b = challenge_a then
    raise exception 'D01 different token FAIL: returned same id as first challenge';
  end if;

  select count(*) into challenge_count
  from public.challenges where user_id = uid;
  if challenge_count <> 2 then
    raise exception 'D01 different token FAIL: expected 2 total challenges, got %', challenge_count;
  end if;

  raise notice 'D01 TEST 2 PASSED: different token creates a new challenge (%), total challenges for user: 2', challenge_b;

  -- ----------------------------------------------------------------
  -- D01 test 3: UNIQUE constraint prevents raw insert with duplicate token
  -- (proves the DB-level guarantee, not just the function check)
  -- ----------------------------------------------------------------
  begin
    insert into public.challenges (user_id, client_token, name, start_date, duration_days, pacing_model)
    values (uid, token_a, 'raw dup', '2026-06-11', 90, 'linear');
    raise exception 'D01 unique constraint FAIL: duplicate raw insert succeeded';
  exception when unique_violation then
    null; -- expected — the DB constraint enforces uniqueness
  end;

  raise notice 'D01 TEST 3 PASSED: UNIQUE constraint on client_token rejects raw duplicate insert';

  raise notice '---';
  raise notice 'SUITE 03 PASSED: D01 idempotency (3 tests) + D04 atomicity (3 tests)';
end
$$;
