-- seed.sql — synthetic development data (LOCAL/STAGING ONLY, never production).
-- 45 days of a challenge: 4 platform trackables + 1 decrease-direction custom
-- trackable (exercises the spine), gaps on "missed" days, one audited correction.

do $$
declare
  uid uuid;
  cid uuid;
  t_li uuid; t_md uuid; t_rd uuid; t_nl uuid; t_wt uuid;
  d date;
  start_d date := current_date - 45;
  i int;
  pillar_bip uuid; pillar_sup uuid;
  item uuid;
  lead_id uuid;
begin
  -- dev user (works on local Supabase / shim; Supabase Auth manages prod users)
  insert into auth.users (id, email, raw_user_meta_data)
  values ('00000000-0000-0000-0000-000000000001', 'dev@growth-os.local',
          '{"full_name":"Dev Creator","timezone":"Asia/Kolkata"}'::jsonb)
  on conflict (id) do nothing
  returning id into uid;
  if uid is null then uid := '00000000-0000-0000-0000-000000000001'; end if;

  insert into public.challenges (user_id, name, start_date, duration_days, pacing_model)
  values (uid, '90-Day Creator Sprint', start_d, 90, 'compounding')
  returning id into cid;

  insert into public.trackables (user_id, challenge_id, name, kind, direction, unit, primary_metric, baseline_value, target_value, config, sort_order) values
    (uid, cid, 'LinkedIn',   'platform_account', 'increase', 'followers',   'followers',   1100, 5000, '{"platform":"linkedin","handle":"devcreator"}', 1),
    (uid, cid, 'Medium',     'platform_account', 'increase', 'followers',   'followers',    420, 5000, '{"platform":"medium","handle":"@devcreator"}', 2),
    (uid, cid, 'Reddit',     'platform_account', 'increase', 'karma',       'karma',       2200, 5000, '{"platform":"reddit","handle":"u/devcreator"}', 3),
    (uid, cid, 'Newsletter', 'platform_account', 'increase', 'subscribers', 'subscribers',   80, 1000, '{"platform":"newsletter"}', 4)
  ;
  select id into t_li from public.trackables where challenge_id = cid and name = 'LinkedIn';
  select id into t_md from public.trackables where challenge_id = cid and name = 'Medium';
  select id into t_rd from public.trackables where challenge_id = cid and name = 'Reddit';
  select id into t_nl from public.trackables where challenge_id = cid and name = 'Newsletter';

  -- the 8-kg test, live in the seed: a decrease-direction custom trackable
  insert into public.trackables (user_id, challenge_id, name, kind, direction, unit, primary_metric, baseline_value, target_value, sort_order)
  values (uid, cid, 'Body weight', 'custom', 'decrease', 'kg', 'value', 84, 78, 5)
  returning id into t_wt;

  -- 45 days of snapshots; skip days 12, 13, 31 (gaps); mild noise around a compounding-ish curve
  for i in 0..45 loop
    if i in (12, 13, 31) then continue; end if;
    d := start_d + i;

    insert into public.metric_snapshots (user_id, trackable_id, local_date, metric_type, value, source) values
      (uid, t_li, d, 'followers',   round(1100 * power(5000/1100.0, i/90.0) + (random()*30 - 10)), 'manual'),
      (uid, t_md, d, 'followers',   round( 420 * power(5000/ 420.0, i/110.0) + (random()*8 - 3)), 'manual'),   -- behind pace
      (uid, t_rd, d, 'karma',       round(2200 * power(5000/2200.0, i/82.0) + (random()*40 - 15)), 'api_sync'), -- ahead
      (uid, t_nl, d, 'subscribers', round(  80 * power(1000/  80.0, i/95.0) + (random()*4 - 1)), 'manual');

    if i % 2 = 0 then
      insert into public.metric_snapshots (user_id, trackable_id, local_date, metric_type, value)
      values (uid, t_wt, d, 'value', round((84 - i * 0.045 + (random()*0.6 - 0.3))::numeric, 1));
    end if;

    -- leading indicators (sparser)
    if i % 3 <> 0 then
      insert into public.daily_activities (user_id, trackable_id, local_date, activity_key, count) values
        (uid, t_li, d, 'comments_made', (random()*25)::int),
        (uid, t_li, d, 'connections_sent', (random()*10)::int),
        (uid, t_rd, d, 'replies_made', (random()*15)::int);
    end if;

    insert into public.check_ins (user_id, challenge_id, local_date, type)
    values (uid, cid, d, 'daily_log');
  end loop;

  -- a fat-finger correction → exercises the audit trail
  update public.metric_snapshots
     set value = value + 9000
   where trackable_id = t_li and local_date = start_d + 20 and metric_type = 'followers';
  update public.metric_snapshots
     set value = value - 9000
   where trackable_id = t_li and local_date = start_d + 20 and metric_type = 'followers';

  -- pillars + content across statuses
  insert into public.content_pillars (user_id, challenge_id, name, color)
  values (uid, cid, 'build-in-public', '#0e7c5b') returning id into pillar_bip;
  insert into public.content_pillars (user_id, challenge_id, name, color)
  values (uid, cid, 'supabase-tips', '#2563eb') returning id into pillar_sup;

  insert into public.content_items (user_id, challenge_id, trackable_id, pillar_id, title, format, status, planned_date) values
    (uid, cid, t_li, pillar_bip, 'RLS gotchas carousel', 'carousel', 'idea', null),
    (uid, cid, t_md, pillar_sup, 'Supabase RLS deep dive', 'article', 'drafting', current_date + 3),
    (uid, cid, t_li, pillar_bip, 'Hiring myths thread', 'text_post', 'scheduled', current_date + 1);

  insert into public.content_items (user_id, challenge_id, trackable_id, pillar_id, title, format, status)
  values (uid, cid, t_li, pillar_bip, 'Why I quit my job', 'carousel', 'drafting')
  returning id into item;
  update public.content_items
     set status = 'published', published_at = (current_date - 2)::timestamptz + interval '6 hours',
         url = 'https://linkedin.com/posts/example'
   where id = item;
  insert into public.content_metrics (user_id, content_item_id, capture_label, impressions, reactions, comments, shares)
  values (uid, item, '48h', 12400, 312, 41, 18);

  -- money: a pipeline lead + a won lead + events
  insert into public.leads (user_id, challenge_id, name, stage, value_estimate, source_platform, opened_at)
  values (uid, cid, 'Consulting inquiry via Medium', 'call', 60000, 'medium', current_date - 6)
  returning id into lead_id;

  insert into public.leads (user_id, challenge_id, name, stage, source_platform, opened_at, closed_at, closed_amount)
  values (uid, cid, 'Audit gig (LinkedIn DM)', 'won', 'linkedin', current_date - 20, current_date - 8, 45000);

  insert into public.monetization_events (user_id, challenge_id, event_type, amount, currency, base_amount, fx_rate, source_platform, occurred_on, note) values
    (uid, cid, 'revenue', 45000, 'INR', 45000, 1, 'linkedin', current_date - 8, 'Audit gig payment'),
    (uid, cid, 'signup',  null, null, null, null, 'medium',  current_date - 4, 'newsletter signups batch'),
    (uid, cid, 'booking', null, null, null, null, 'linkedin', current_date - 3, 'intro call booked');

  raise notice 'SEED COMPLETE: user %, challenge %', uid, cid;
end
$$;
