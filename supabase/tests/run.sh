#!/usr/bin/env bash
# Database verification harness (CI `db` job + local).
# Fresh database → auth shim → migrations in filename order → test suites.
set -euo pipefail

DB="${TEST_DB:-growth_os_test}"
PSQL="psql -v ON_ERROR_STOP=1 -q -d $DB"

dropdb --if-exists "$DB"
createdb "$DB"

echo "→ auth shim"
$PSQL -f supabase/tests/00_auth_shim.sql

echo "→ migrations"
for f in supabase/migrations/*.sql; do
  echo "   $f"
  $PSQL -f "$f"
done

echo "→ suite 01: functions & triggers"
$PSQL -f supabase/tests/01_functions_and_triggers.sql

echo "→ suite 02: two-user RLS sweep"
$PSQL -f supabase/tests/02_rls_two_user.sql

echo "→ suite 03: challenge atomicity (D01 + D04)"
$PSQL -f supabase/tests/03_challenge_atomicity.sql

echo "→ seed smoke"
$PSQL -f supabase/seed.sql
$PSQL -c "select count(*) as snapshot_rows from public.metric_snapshots;" \
      -c "select count(*) as progress_rows from public.v_daily_progress;"

echo "ALL DATABASE CHECKS PASSED"
