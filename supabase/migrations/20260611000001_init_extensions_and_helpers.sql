-- M01: extensions, shared helpers, closed vocabularies
-- v3.1 §1. All enums live here so later migrations only reference them.

create extension if not exists pgcrypto;

-- updated_at maintenance
create or replace function public.fn_set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Closed vocabularies (integrity lives in the database)
create type public.trackable_kind   as enum ('platform_account','custom');
create type public.direction        as enum ('increase','decrease');
create type public.pacing_model     as enum ('linear','compounding');
create type public.challenge_status as enum ('active','completed','abandoned');
create type public.platform         as enum ('linkedin','medium','reddit','newsletter','other');
create type public.metric_type      as enum (
  'followers','karma','value',
  'impressions','profile_views','connection_requests',
  'views','reads','read_ratio','claps',
  'post_karma','comment_karma','subscribers'
);
create type public.snapshot_source  as enum ('manual','api_sync','csv_import');
create type public.content_status   as enum ('idea','drafting','scheduled','published');
create type public.content_format   as enum ('text_post','carousel','video','article','reddit_post','comment_thread','newsletter_issue','other');
create type public.lead_stage       as enum ('new','contacted','call','proposal','won','lost');
create type public.event_type       as enum ('revenue','signup','booking');
create type public.recurrence       as enum ('one_time','monthly');
create type public.insight_severity as enum ('info','warning','win');
create type public.insight_status   as enum ('new','acted','dismissed','expired');
create type public.checkin_type     as enum ('daily_log','weekly_review');
create type public.annotation_kind  as enum ('auto_publish','manual','milestone');
create type public.sync_status      as enum ('ok','error');
