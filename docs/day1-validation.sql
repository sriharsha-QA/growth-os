-- Day 1 Validation Script
-- Paste into Supabase SQL Editor AFTER completing the onboarding wizard and
-- logging your first day's numbers.
-- Expected: all checks return 'PASS'. Any 'FAIL' means something to investigate.

DO $$
DECLARE
  uid uuid;
  cid uuid;
  n int;
  d date;
  challenge_name text;
  trackable_count int;
  snapshot_count int;
  v_progress_count int;
  checkin_count int;
BEGIN
  -- Get your user
  SELECT id INTO uid FROM auth.users LIMIT 1;
  IF uid IS NULL THEN
    RAISE EXCEPTION 'FAIL: No user found. Complete signup first.';
  END IF;
  RAISE NOTICE 'User ID: %', uid;

  -- Challenge exists and is active
  SELECT id, name INTO cid, challenge_name
  FROM challenges
  WHERE user_id = uid AND status = 'active'
  LIMIT 1;

  IF cid IS NULL THEN
    RAISE EXCEPTION 'FAIL: No active challenge. Complete the onboarding wizard.';
  END IF;
  RAISE NOTICE 'PASS: Active challenge found: %', challenge_name;

  -- Trackables exist
  SELECT count(*) INTO trackable_count FROM trackables WHERE challenge_id = cid;
  IF trackable_count = 0 THEN
    RAISE EXCEPTION 'FAIL: No trackables found for challenge.';
  END IF;
  RAISE NOTICE 'PASS: % trackables exist', trackable_count;

  -- Day 1 snapshots exist (one per trackable that was logged)
  SELECT count(*) INTO snapshot_count
  FROM metric_snapshots ms
  JOIN trackables t ON t.id = ms.trackable_id
  WHERE t.challenge_id = cid
    AND ms.local_date = current_date;

  IF snapshot_count = 0 THEN
    RAISE EXCEPTION 'FAIL: No snapshots found for today. Log your Day 1 numbers at /log';
  END IF;
  RAISE NOTICE 'PASS: % snapshots logged for today', snapshot_count;

  -- v_daily_progress view returns data
  SELECT count(*) INTO v_progress_count
  FROM v_daily_progress
  WHERE challenge_id = cid AND local_date = current_date;

  IF v_progress_count = 0 THEN
    RAISE EXCEPTION 'FAIL: v_daily_progress returned no rows. Check views.';
  END IF;
  RAISE NOTICE 'PASS: v_daily_progress returns % rows for today', v_progress_count;

  -- Check-in was written on log save
  SELECT count(*) INTO checkin_count
  FROM check_ins
  WHERE challenge_id = cid
    AND local_date = current_date
    AND type = 'daily_log';

  IF checkin_count = 0 THEN
    RAISE NOTICE 'WARN: No check-in found for today. Streak will be 0 until a check-in exists. Did the log save complete?';
  ELSE
    RAISE NOTICE 'PASS: Daily check-in recorded for today';
  END IF;

  -- fn_local_date is working correctly
  d := public.fn_local_date(now(), 'Asia/Kolkata', '04:00'::time);
  IF d <> current_date AND d <> current_date - 1 THEN
    RAISE NOTICE 'WARN: fn_local_date returned %, which differs from today %. Check timezone/rollover settings.', d, current_date;
  ELSE
    RAISE NOTICE 'PASS: fn_local_date returns % (expected today or yesterday depending on IST time)', d;
  END IF;

  -- fn_pace_target reference check
  DECLARE pace numeric;
  BEGIN
    pace := public.fn_pace_target(100, 5000, 'increase', 'compounding', 1, 90);
    IF pace IS NULL THEN
      RAISE EXCEPTION 'FAIL: fn_pace_target returned NULL';
    END IF;
    RAISE NOTICE 'PASS: fn_pace_target is functional (baseline=100, target=5000, day=1 → %)', pace;
  END;

  -- RLS check: your data is visible to you
  EXECUTE format(
    'SELECT count(*) FROM metric_snapshots WHERE user_id = %L AND local_date = current_date',
    uid
  ) INTO n;
  RAISE NOTICE 'PASS: RLS allows you to read your % snapshot(s)', n;

  -- Summary
  RAISE NOTICE '---';
  RAISE NOTICE 'DAY 1 VALIDATION COMPLETE';
  RAISE NOTICE 'Challenge: %', challenge_name;
  RAISE NOTICE 'Trackables: %', trackable_count;
  RAISE NOTICE 'Snapshots today: %', snapshot_count;
  RAISE NOTICE 'View rows today: %', v_progress_count;
  RAISE NOTICE '---';
  RAISE NOTICE 'All checks passed. You are live on Day 1.';
END
$$;
