-- M02: identity — profiles, user_settings, signup trigger
-- Day-math inputs (timezone, day_rollover_hour) live on profiles. v3.1 §1 M02.

create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  display_name      text,
  timezone          text not null default 'Asia/Kolkata',
  day_rollover_hour time not null default '04:00',
  reminder_time     time,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table public.user_settings (
  user_id                uuid primary key references auth.users (id) on delete cascade,
  base_currency          char(3) not null default 'INR',
  weekly_export_enabled  boolean not null default false,
  notification_prefs     jsonb not null default '{}'::jsonb,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create trigger trg_profiles_updated_at      before update on public.profiles      for each row execute function public.fn_set_updated_at();
create trigger trg_user_settings_updated_at before update on public.user_settings for each row execute function public.fn_set_updated_at();

-- Zero-step identity: every auth signup gets a profile + settings row.
create or replace function public.fn_create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, timezone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'timezone', 'Asia/Kolkata')
  )
  on conflict (id) do nothing;

  insert into public.user_settings (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function public.fn_create_profile();

-- RLS
alter table public.profiles      enable row level security;
alter table public.user_settings enable row level security;

create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

create policy user_settings_select on public.user_settings for select using (user_id = auth.uid());
create policy user_settings_update on public.user_settings for update using (user_id = auth.uid()) with check (user_id = auth.uid());
