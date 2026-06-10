-- Test suite 01: canonical functions + integrity triggers.
-- Runs as superuser; pure assertions via DO blocks (fails loudly on violation).

do $main$
declare
  v numeric;
  d date;
  uid uuid;
  cid uuid;
  tid uuid;
  sid uuid;
  n int;
begin
  ------------------------------------------------------------------
  -- fn_local_date: rollover boundary matrix (IST, rollover 04:00)
  ------------------------------------------------------------------
  -- 2026-06-11 03:59 IST = 2026-06-10 22:29 UTC → belongs to 2026-06-10
  d := public.fn_local_date('2026-06-10 22:29:00+00', 'Asia/Kolkata', '04:00');
  if d <> date '2026-06-10' then raise exception 'local_date 03:59 boundary failed: %', d; end if;

  -- 2026-06-11 04:00 IST exactly → belongs to 2026-06-11
  d := public.fn_local_date('2026-06-10 22:30:00+00', 'Asia/Kolkata', '04:00');
  if d <> date '2026-06-11' then raise exception 'local_date 04:00 boundary failed: %', d; end if;

  -- 2026-06-11 04:01 IST → 2026-06-11
  d := public.fn_local_date('2026-06-10 22:31:00+00', 'Asia/Kolkata', '04:00');
  if d <> date '2026-06-11' then raise exception 'local_date 04:01 boundary failed: %', d; end if;

  -- Midnight rollover (00:00) degenerates to plain local date
  d := public.fn_local_date('2026-06-10 22:31:00+00', 'Asia/Kolkata', '00:00');
  if d <> date '2026-06-11' then raise exception 'local_date midnight rollover failed: %', d; end if;

  -- DST locale forward-compat (America/New_York spring-forward day)
  d := public.fn_local_date('2026-03-08 07:30:00+00', 'America/New_York', '04:00');
  if d <> date '2026-03-07' then raise exception 'local_date DST case failed: %', d; end if;

  ------------------------------------------------------------------
  -- fn_pace_target: 4-combo matrix + guards + clamps
  ------------------------------------------------------------------
  -- linear increase: 100 → 1000 over 90, day 45 → 550
  v := public.fn_pace_target(100, 1000, 'increase', 'linear', 45, 90);
  if v <> 550 then raise exception 'pace linear increase failed: %', v; end if;

  -- linear decrease: 90 → 82 (kg) over 90, day 45 → 86
  v := public.fn_pace_target(90, 82, 'decrease', 'linear', 45, 90);
  if v <> 86 then raise exception 'pace linear decrease failed: %', v; end if;

  -- compounding increase: 100 → 1000, day 45 → 100 * 10^0.5 ≈ 316.2278
  v := public.fn_pace_target(100, 1000, 'increase', 'compounding', 45, 90);
  if abs(v - 316.2278) > 0.01 then raise exception 'pace compounding increase failed: %', v; end if;

  -- compounding decrease: 90 → 82, day 45 → 90 * (82/90)^0.5 ≈ 85.9069
  v := public.fn_pace_target(90, 82, 'decrease', 'compounding', 45, 90);
  if abs(v - 85.9069) > 0.01 then raise exception 'pace compounding decrease failed: %', v; end if;

  -- endpoints: day 0 = baseline, day D = target (both models)
  if public.fn_pace_target(100, 1000, 'increase', 'compounding', 0, 90) <> 100
     then raise exception 'pace day-0 failed'; end if;
  if abs(public.fn_pace_target(100, 1000, 'increase', 'compounding', 90, 90) - 1000) > 0.001
     then raise exception 'pace day-D failed'; end if;

  -- clamp: day beyond duration clamps to target
  if abs(public.fn_pace_target(100, 1000, 'increase', 'linear', 120, 90) - 1000) > 0.001
     then raise exception 'pace clamp failed'; end if;

  -- guard: baseline 0 + compounding falls back to linear (no div-by-zero / 0^x)
  v := public.fn_pace_target(0, 1000, 'increase', 'compounding', 45, 90);
  if v <> 500 then raise exception 'pace baseline-0 guard failed: %', v; end if;

  -- guard: direction/target mismatch falls back to linear, never errors
  v := public.fn_pace_target(100, 50, 'increase', 'compounding', 45, 90);
  if v <> 75 then raise exception 'pace mismatch guard failed: %', v; end if;

  ------------------------------------------------------------------
  -- Identity trigger: signup creates profile + settings
  ------------------------------------------------------------------
  insert into auth.users (email) values ('fn-test@example.com') returning id into uid;
  if not exists (select 1 from public.profiles where id = uid)
     then raise exception 'profile auto-create failed'; end if;
  if not exists (select 1 from public.user_settings where user_id = uid)
     then raise exception 'settings auto-create failed'; end if;

  ------------------------------------------------------------------
  -- Snapshot upsert-unique + audit trigger
  ------------------------------------------------------------------
  insert into public.challenges (user_id, name, start_date)
  values (uid, 'fn-test challenge', '2026-06-01') returning id into cid;

  insert into public.trackables (user_id, challenge_id, name, unit, primary_metric, baseline_value, target_value)
  values (uid, cid, 'LinkedIn', 'followers', 'followers', 100, 5000) returning id into tid;

  insert into public.metric_snapshots (user_id, trackable_id, local_date, metric_type, value)
  values (uid, tid, '2026-06-11', 'followers', 1247) returning id into sid;

  -- same-key upsert updates, not duplicates
  insert into public.metric_snapshots (user_id, trackable_id, local_date, metric_type, value)
  values (uid, tid, '2026-06-11', 'followers', 1250)
  on conflict (trackable_id, local_date, metric_type)
  do update set value = excluded.value;

  select count(*) into n from public.metric_snapshots
   where trackable_id = tid and local_date = '2026-06-11' and metric_type = 'followers';
  if n <> 1 then raise exception 'snapshot upsert produced % rows', n; end if;

  -- exactly one audit row for the value change
  select count(*) into n from public.snapshot_audit where snapshot_id = sid;
  if n <> 1 then raise exception 'audit rows after change: % (want 1)', n; end if;

  -- no-op update writes no audit row
  update public.metric_snapshots set value = 1250 where id = sid;
  select count(*) into n from public.snapshot_audit where snapshot_id = sid;
  if n <> 1 then raise exception 'audit rows after no-op: % (want 1)', n; end if;

  ------------------------------------------------------------------
  -- Target-history trigger
  ------------------------------------------------------------------
  update public.trackables set target_value = 4000 where id = tid;
  select count(*) into n from public.target_history where trackable_id = tid;
  if n <> 1 then raise exception 'target_history rows: % (want 1)', n; end if;

  ------------------------------------------------------------------
  -- fn_day_index: Day 1 on start date, clamped sentinels
  ------------------------------------------------------------------
  -- start 2026-06-01; 2026-06-01 05:00 IST = 2026-05-31 23:30 UTC
  if public.fn_day_index(cid, '2026-05-31 23:30:00+00') <> 1
     then raise exception 'day_index day-1 failed'; end if;
  -- pre-start clamps to 0
  if public.fn_day_index(cid, '2026-05-20 12:00:00+00') <> 0
     then raise exception 'day_index pre-start clamp failed'; end if;
  -- post-end clamps to duration+1
  if public.fn_day_index(cid, '2027-06-01 12:00:00+00') <> 91
     then raise exception 'day_index post-end clamp failed'; end if;

  ------------------------------------------------------------------
  -- Auto-annotation on publish: exactly once, idempotent on re-save
  ------------------------------------------------------------------
  declare iid uuid;
  begin
    insert into public.content_items (user_id, challenge_id, trackable_id, title, format, status)
    values (uid, cid, tid, 'Why I quit my job', 'carousel', 'drafting') returning id into iid;

    update public.content_items
      set status = 'published', published_at = '2026-06-10 06:00:00+00', url = 'https://example.com/p/1'
      where id = iid;

    select count(*) into n from public.annotations where source_id = iid;
    if n <> 1 then raise exception 'publish annotation rows: % (want 1)', n; end if;

    -- re-save while published: no duplicate
    update public.content_items set title = 'Why I quit my job (edited)' where id = iid;
    select count(*) into n from public.annotations where source_id = iid;
    if n <> 1 then raise exception 'publish annotation idempotency failed: %', n; end if;
  end;

  ------------------------------------------------------------------
  -- Insight idempotency unique
  ------------------------------------------------------------------
  insert into public.insights (user_id, challenge_id, rule_key, message, generated_for_date)
  values (uid, cid, 'pace_alert', 'test', '2026-06-11');
  begin
    insert into public.insights (user_id, challenge_id, rule_key, message, generated_for_date)
    values (uid, cid, 'pace_alert', 'dup', '2026-06-11');
    raise exception 'insight idempotency unique DID NOT fire';
  exception when unique_violation then
    null; -- expected
  end;

  ------------------------------------------------------------------
  -- v_daily_progress parity spot-check against fn_pace_target
  ------------------------------------------------------------------
  declare
    view_pace numeric;
    fn_pace numeric;
    didx int;
  begin
    select pace_target, day_index into view_pace, didx
    from public.v_daily_progress
    where trackable_id = tid and local_date = '2026-06-11';

    fn_pace := public.fn_pace_target(100, 4000, 'increase', 'compounding', didx, 90);
    if view_pace is distinct from fn_pace then
      raise exception 'view/function pace parity failed: % vs %', view_pace, fn_pace;
    end if;
  end;

  raise notice 'SUITE 01 PASSED: functions, triggers, constraints, view parity';
end
$main$;
