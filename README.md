# Growth OS

Daily operating system for a 90-day growth challenge — log the numbers in two minutes, see actual-vs-pace trajectories, keep the streak alive. Built on the **trackables spine** (v3.0/v3.1): anything with a number, a baseline, a target, and a direction can be tracked with zero migrations.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres + Auth + RLS) · Recharts · Vercel.

## What's live (Phase 0 + Phase 1)

- Magic-link + Google sign-in; profile auto-created on signup (timezone + day-rollover hour, default `Asia/Kolkata` / `04:00`)
- Challenge wizard: platform presets (LinkedIn / Medium / Reddit / Newsletter), Reddit karma-vs-followers toggle, custom trackables in either direction (the seed includes a decrease-direction "Body weight" trackable to prove the spine), pillars
- Quick Log: prefilled fields, paste-tolerant parsing (`1,247` / `1.2k`), outlier confirm (client + server re-check), leading-indicator inputs, offline queue with idempotent replay
- Dashboard: `DAY NN / 90` strip, streak, per-trackable cards (pace badge · gap · 7-day velocity vs required velocity), trajectory chart with pace overlay, visible gaps, annotation dots
- Auto-annotations when content publishes; audited snapshot corrections; recalibration history
- Full-fidelity export: JSON (everything) + CSV (formula-injection-safe)

**Dormant by design** (schema exists, zero app references, CI-gated): experiments, sync_runs (Reddit OAuth), notification_log, weekly_targets, target recalibration UI, MRR/attribution views, insights generation. Activation criteria live in the phasing doc.

## Setup

1. **Supabase**: create a project (Pro tier recommended for PITR before real data accrues). In *Auth → Providers* enable Email (magic link) and Google. Set the Site URL to your deployment URL and add `…/auth/callback` to the redirect allowlist.
2. **Migrations**: with the Supabase CLI linked (`supabase link --project-ref …`), run `supabase db push`. The 12 files in `supabase/migrations/` apply in filename order.
3. **Env**: copy `.env.example` to `.env.local` and fill in the project URL, anon key, service-role key, and a `CRON_SECRET`.
4. **Run**: `npm install && npm run dev`.
5. **Seed (local/staging only)**: `supabase/seed.sql` creates a synthetic user with 45 days of data — including gaps and an audited correction. **Never run it against production.**

## Verification harness

```bash
TEST_DB=growth_os_test bash supabase/tests/run.sh
```

Fresh database → auth shim (plain-Postgres stand-in for Supabase auth) → all migrations → two suites:

- **Suite 01** — day-math boundary matrix (rollover edges, DST), the 4-combo pace matrix (linear/compounding × increase/decrease), endpoint + clamp + guard cases, upsert/audit/target-history/auto-annotation triggers, insight idempotency, and a view-vs-function pace parity check.
- **Suite 02** — two-user RLS sweep: enumerates **every** table and view from the catalog and asserts user B sees zero of user A's rows; proves cross-tenant writes are blocked (this sweep caught a real hole during development — `WITH CHECK (user_id = auth.uid())` alone lets a user attach rows to someone else's parent, hence the `fn_owns_*` checks in every child policy); verifies the insights column-level grant.

CI (`.github/workflows/ci.yml`) runs three jobs: **verify** (lint, types, service-role import fence, dormant-table gate), **db** (the harness above on a Postgres service), **build**. Both fences are canary-tested: a deliberate violation makes them fire.

## Architecture in one breath

`trackables` is the spine — kind, direction, unit, primary metric, baseline, target, config. Facts land in `metric_snapshots` (one canonical value per trackable/day/metric; corrections audited) and `daily_activities` (EAV inputs). Day and pace math is **canonical in Postgres** (`fn_local_date`, `fn_day_index`, `fn_pace_target`); TypeScript calls it and never reimplements it. All reads go through `security_invoker` views (`v_daily_progress` etc.). The creator module (content, pillars, leads, money) FKs into the spine and never alters it. The service-role client lives in `src/lib/server/admin.ts` behind an ESLint fence.

Decisions that look odd but are deliberate:
- **Rollover changes are forward-only** — historic `local_date`s are never rewritten (streaks and pace history stay stable). The settings UI says so.
- **No multi-statement transaction in quick-log** — each upsert is individually idempotent against DB uniques, so a partial failure is re-runnable and offline replays converge.
- **`primary_metric` is a typed column**, not config jsonb (every trackable measures something; the spine owns it).

## Restore drill (do this once before Day 1)

**Verified procedure** (discovered during Phase 1 audit — documented from an actual test run):

1. In Supabase: *Database → Backups → PITR*, restore to a **new** Supabase project at a point in the past (5 minutes is sufficient for a drill). This gives you a blank database with your schema.

2. Re-apply your migrations to the fresh project:
   ```bash
   supabase link --project-ref <NEW-PROJECT-REF>
   supabase db push
   ```
   All 12 migrations (M01–M12) should apply cleanly.

3. **Critical: disable the profile auto-create trigger before importing data.** The `fn_create_profile` trigger fires on every `auth.users` row insert and would create duplicate profile rows if triggered during a bulk COPY. In the SQL editor of the new project, run:
   ```sql
   ALTER TABLE auth.users DISABLE TRIGGER trg_on_auth_user_created;
   ```

4. Import data tables in FK-dependency order:
   - auth.users → profiles, user_settings
   - challenges → trackables
   - content_pillars, content_items, content_metrics, weekly_targets
   - leads, monetization_events
   - metric_snapshots, snapshot_audit, daily_activities, target_history
   - check_ins, annotations

5. Re-enable the trigger after import:
   ```sql
   ALTER TABLE auth.users ENABLE TRIGGER trg_on_auth_user_created;
   ```

6. Point a local `.env.local` at the restored project, run `npm run dev`, and verify:
   - Dashboard loads with correct data
   - `v_daily_progress` row counts match source
   - `fn_local_date` and `fn_pace_target` return correct values
   - RLS: you can only see your own data

7. Note the total elapsed time. If you skipped this, you don't have backups — you have hope.

**Issue found during drill:** Importing without disabling the trigger causes a `duplicate key` error on `profiles_pkey`. This is a restore-procedure issue, not a schema issue. The trigger correctly creates profiles for new signups; it must be bypassed for bulk restores.
