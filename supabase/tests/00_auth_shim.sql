-- Test harness bootstrap: minimal Supabase-compatible auth shim for plain Postgres.
-- NOT a migration. Real Supabase provides auth.users / auth.uid() / roles natively.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Mirrors Supabase: auth.uid() reads the JWT 'sub' claim.
create or replace function auth.uid() returns uuid
language sql stable
as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;

-- Roles used by Supabase grants/policies.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin bypassrls;
  end if;
end
$$;

grant usage on schema public to authenticated, anon, service_role;
grant usage on schema auth to authenticated, anon, service_role;
grant select on auth.users to service_role;

-- Supabase grants table privileges to authenticated by default; RLS is the wall.
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public
  grant execute on functions to authenticated, anon;
