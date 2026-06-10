-- Test suite 02: two-user RLS sweep (v3.1 §6 acceptance).
-- Seeds data as user A, then — running as the 'authenticated' role with user B's
-- JWT claims — programmatically enumerates EVERY public table and view and
-- asserts B sees zero of A's rows and cannot write into A's challenge.
-- Any new relation is swept automatically; unprotected tables fail the run.

-- ---------- seed as superuser ----------
do $$
declare
  ua uuid; ub uuid; ca uuid; ta uuid; ia uuid;
begin
  insert into auth.users (email) values ('alice@example.com') returning id into ua;
  insert into auth.users (email) values ('bob@example.com')   returning id into ub;

  insert into public.challenges (user_id, name, start_date)
  values (ua, 'alice challenge', '2026-06-01') returning id into ca;

  insert into public.trackables (user_id, challenge_id, name, unit, primary_metric, baseline_value, target_value)
  values (ua, ca, 'LinkedIn', 'followers', 'followers', 100, 5000) returning id into ta;

  insert into public.metric_snapshots (user_id, trackable_id, local_date, metric_type, value)
  values (ua, ta, '2026-06-11', 'followers', 1247);
  update public.metric_snapshots set value = 1250
   where trackable_id = ta and local_date = '2026-06-11' and metric_type = 'followers'; -- audit row

  insert into public.daily_activities (user_id, trackable_id, local_date, activity_key, count)
  values (ua, ta, '2026-06-11', 'comments_made', 12);

  insert into public.check_ins (user_id, challenge_id, local_date, type)
  values (ua, ca, '2026-06-11', 'daily_log');

  insert into public.annotations (user_id, challenge_id, local_date, label, kind)
  values (ua, ca, '2026-06-11', 'manual note', 'manual');

  insert into public.weekly_reviews (user_id, challenge_id, week_number)
  values (ua, ca, 1);

  insert into public.insights (user_id, challenge_id, rule_key, message, generated_for_date)
  values (ua, ca, 'milestone', 'alice insight', '2026-06-11');

  insert into public.sync_runs (user_id, provider, status)
  values (ua, 'reddit', 'ok');

  insert into public.notification_log (user_id, type) values (ua, 'daily_reminder');

  insert into public.content_pillars (user_id, challenge_id, name) values (ua, ca, 'build-in-public');
  insert into public.content_items (user_id, challenge_id, trackable_id, title)
  values (ua, ca, ta, 'alice post') returning id into ia;
  insert into public.content_metrics (user_id, content_item_id, impressions) values (ua, ia, 1000);
  insert into public.weekly_targets (user_id, challenge_id, trackable_id, target_count)
  values (ua, ca, ta, 5);

  insert into public.leads (user_id, challenge_id, name) values (ua, ca, 'alice lead');
  insert into public.monetization_events (user_id, challenge_id, event_type, amount, currency, base_amount, occurred_on)
  values (ua, ca, 'revenue', 100, 'USD', 8300, '2026-06-10');

  insert into public.experiments (user_id, challenge_id, hypothesis, variable, start_local_date, end_local_date)
  values (ua, ca, 'carousels win', 'format', '2026-06-01', '2026-06-14');

  -- stash ids for the authenticated-role phase
  create temp table _rls_ctx as
    select ua as alice, ub as bob, ca as alice_challenge, ta as alice_trackable;
end
$$;

-- ---------- sweep as user B (authenticated role) ----------
do $$
declare
  rel record;
  n bigint;
  bob uuid;
  alice uuid;
  alice_challenge uuid;
  unprotected text := '';
begin
  select t.bob, t.alice, t.alice_challenge into bob, alice, alice_challenge from _rls_ctx t;

  -- 0) every public table must have RLS enabled (new tables can't sneak in)
  for rel in
    select c.relname
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  loop
    unprotected := unprotected || rel.relname || ' ';
  end loop;
  if unprotected <> '' then
    raise exception 'tables WITHOUT RLS: %', unprotected;
  end if;

  -- impersonate Bob
  perform set_config('request.jwt.claims', json_build_object('sub', bob, 'role', 'authenticated')::text, true);
  set local role authenticated;

  -- 1) Bob sees zero of ALICE's rows through every table and every view
  --    (Bob may see his own auto-created profile/settings; that's correct.)
  for rel in
    select c.relname, c.relkind,
           (select column_name from information_schema.columns col
             where col.table_schema = 'public' and col.table_name = c.relname
               and col.column_name in ('user_id','id')
             order by case col.column_name when 'user_id' then 0 else 1 end
             limit 1) as owner_col
    from pg_class c
    join pg_namespace ns on ns.oid = c.relnamespace
    where ns.nspname = 'public' and c.relkind in ('r', 'v')
      and c.relname not like '\_rls%'
  loop
    if rel.owner_col is null then
      raise exception 'relation % has no owner column to sweep', rel.relname;
    end if;
    execute format('select count(*) from public.%I where %I = $1', rel.relname, rel.owner_col)
      into n using alice;
    if n <> 0 then
      raise exception 'RLS LEAK: % (%) returned % of Alice''s rows for user B',
        rel.relname, case rel.relkind when 'v' then 'view' else 'table' end, n;
    end if;
  end loop;

  -- 2) Bob cannot write into Alice's challenge
  begin
    insert into public.trackables (user_id, challenge_id, name, unit, primary_metric, baseline_value, target_value)
    values (bob, alice_challenge, 'intrusion', 'followers', 'followers', 0, 1);
    raise exception 'RLS WRITE LEAK: cross-user insert succeeded';
  exception
    when insufficient_privilege or foreign_key_violation or check_violation then null; -- blocked
  end;

  -- 3) Bob cannot write audit/insights/sync tables directly
  begin
    insert into public.insights (user_id, challenge_id, rule_key, message, generated_for_date)
    values (bob, alice_challenge, 'x', 'x', '2026-06-11');
    raise exception 'RLS LEAK: user inserted into insights';
  exception
    when insufficient_privilege or foreign_key_violation then null;
  end;

  reset role;
  raise notice 'SUITE 02 PASSED: RLS sweep across all tables and views';
end
$$;

-- ---------- insight column-level grant (Alice can update status, not message) ----------
do $$
declare alice uuid; iid uuid; thid uuid;
begin
  select t.alice into alice from _rls_ctx t;
  select id into iid from public.insights where user_id = alice limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', alice, 'role', 'authenticated')::text, true);
  set local role authenticated;

  update public.insights set status = 'dismissed', suppressed_until = '2026-06-18' where id = iid; -- allowed

  begin
    update public.insights set message = 'tampered' where id = iid;
    raise exception 'COLUMN GRANT LEAK: user updated insight message';
  exception when insufficient_privilege then null; -- expected
  end;

  -- target_history: reason is user-annotatable; the recorded values are not
  update public.trackables set target_value = target_value + 100
   where user_id = alice;  -- trigger writes a history row
  select id into thid from public.target_history where user_id = alice
   order by changed_at desc limit 1;
  if thid is null then raise exception 'target_history row missing after recalibration'; end if;

  update public.target_history set reason = 'mid-sprint recalibration' where id = thid; -- allowed

  begin
    update public.target_history set new_target = 999999 where id = thid;
    raise exception 'COLUMN GRANT LEAK: user rewrote target_history values';
  exception when insufficient_privilege then null; -- expected
  end;

  reset role;
  raise notice 'SUITE 02b PASSED: column-level grants (insights + target_history)';
end
$$;
