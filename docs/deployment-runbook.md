# Deployment Runbook — Growth OS
**Execute in order. Each section has an expected output. Do not proceed if it differs.**

Estimated total time: **45 minutes** (30 min setup + 15 min Day 1 logging)

---

## Prerequisites

Have open in your browser before starting:
- https://supabase.com (logged in)
- https://vercel.com (logged in, GitHub connected)
- https://github.com (repo pushed)
- https://sentry.io (account ready, or skip Sentry and add post-Day 1)
- Your terminal with the `growth-os` repo checked out

Have ready:
- Your current LinkedIn followers count
- Your current Medium followers count
- Your current Reddit karma count
- Your current newsletter subscribers count (if tracking)

---

## STEP 1 — Push repo to GitHub

```bash
cd /path/to/growth-os
git init  # if not already a repo
git add -A
git commit -m "feat: Growth OS Phase 1 — complete daily loop"
git remote add origin https://github.com/YOUR_USERNAME/growth-os.git
git branch -M main
git push -u origin main
```

**Expected:** GitHub shows the repo with all files. CI will fail on the first push (no Postgres service yet) — that's expected until step 8.

---

## STEP 2 — Create Supabase project

1. Go to https://supabase.com → New project
2. **Settings:**
   - Name: `growth-os-prod`
   - Database password: generate a strong one and **save it in your password manager**
   - Region: `South Asia (Mumbai)` — closest to you
   - Plan: **Pro ($25/mo)** — required for PITR backups. Do not use Free tier for real data.
3. Click **Create new project**. Wait ~2 minutes for provisioning.

**Expected output from Supabase dashboard:**
- Project status: `Active`
- Database: `Running`

---

## STEP 3 — Configure Supabase Auth

In your Supabase project dashboard:

### 3a. Enable Email (magic link)
- Authentication → Providers → Email → Enable
- Confirm emails: **OFF** for now (you're the only user; turn on before adding others)
- Secure email change: ON

### 3b. Enable Google OAuth (optional but recommended)
- Authentication → Providers → Google → Enable
- Create OAuth credentials at https://console.cloud.google.com:
  - APIs & Services → Credentials → Create OAuth 2.0 Client ID
  - Application type: Web application
  - Authorized redirect URI: `https://YOUR-PROJECT-REF.supabase.co/auth/v1/callback`
- Paste Client ID and Secret into Supabase

### 3c. Set production URL (do this AFTER Vercel deploy in step 6 gives you the URL)
- Authentication → URL Configuration
- Site URL: `https://YOUR-VERCEL-APP.vercel.app`
- Redirect URLs: add `https://YOUR-VERCEL-APP.vercel.app/auth/callback`

---

## STEP 4 — Run migrations

Install Supabase CLI if not installed:
```bash
npm install -g supabase
```

Link and push:
```bash
cd /path/to/growth-os
supabase login  # opens browser, authenticate
supabase link --project-ref YOUR-PROJECT-REF  # found in Supabase → Settings → General
supabase db push
```

**Expected output:**
```
Applying migration 20260611000001_init_extensions_and_helpers.sql...
Applying migration 20260611000002_identity.sql...
...
Applying migration 20260611000012_storage_exports.sql...
Finished supabase db push.
```

**Verify in Supabase Table Editor:** you should see 21 tables, all with a lock icon (RLS enabled).

**Manual smoke test** — run in Supabase SQL Editor:
```sql
SELECT public.fn_local_date(now(), 'Asia/Kolkata', '04:00'::time);
-- Expected: today's date in IST (or yesterday if it's before 04:00 IST)

SELECT public.fn_pace_target(100, 5000, 'increase', 'compounding', 45, 90);
-- Expected: 707.1068 (± 0.001)
```

If either fails, stop and check the migration output.

---

## STEP 5 — Collect environment variables

From Supabase → Settings → API, copy:

```
NEXT_PUBLIC_SUPABASE_URL=https://YOURREF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...  (the "anon public" key)
SUPABASE_SERVICE_ROLE_KEY=eyJ...      (the "service_role" key — keep secret)
```

Generate CRON_SECRET:
```bash
openssl rand -hex 32
# Copy the output — this is your CRON_SECRET
```

(Optional) Sentry DSN:
- https://sentry.io → New Project → Next.js
- Copy the DSN: `https://KEY@oXXX.ingest.sentry.io/XXXXX`

---

## STEP 6 — Deploy to Vercel

1. Go to https://vercel.com → New Project → Import Git Repository
2. Select `growth-os`
3. Framework: **Next.js** (auto-detected)
4. Root directory: `.` (default)
5. **Before clicking Deploy**, add environment variables:

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | from step 5 | All |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 5 | All |
| `SUPABASE_SERVICE_ROLE_KEY` | from step 5 | Production, Preview |
| `CRON_SECRET` | from step 5 | Production |
| `NEXT_PUBLIC_SENTRY_DSN` | from step 5 (if using) | All |

6. Click **Deploy**

**Expected:** Build completes in ~2 minutes. You get a URL like `growth-os-xxx.vercel.app`.

**Verify the deploy:**
```
https://growth-os-xxx.vercel.app/login
```
Should show the Growth OS login page with email input and "Continue with Google".

---

## STEP 7 — Complete Supabase URL configuration

Now that you have the Vercel URL, go back to Supabase:
- Authentication → URL Configuration
- Site URL: `https://growth-os-xxx.vercel.app`
- Redirect URLs: `https://growth-os-xxx.vercel.app/auth/callback`

---

## STEP 8 — Enable GitHub branch protection

Go to: `https://github.com/YOUR_USERNAME/growth-os/settings/branches`

1. Click **Add branch protection rule** (or "Add ruleset" in newer UI)
2. Branch name pattern: `main`
3. Check these options:
   - ✅ Require a pull request before merging (1 required approval)
   - ✅ Require status checks to pass before merging
     - Add these required checks:
       - `Lint, types, fences`
       - `Migrations, functions, RLS sweep`
       - `Next.js production build`
   - ✅ Require branches to be up to date
   - ✅ Include administrators
4. Save

**Verify:** Try `git push origin HEAD:main` from a dirty branch — should be rejected.

> Note: Status checks only appear after the first CI run completes. If CI hasn't run yet, save the rule and add the status checks after the first PR.

---

## STEP 9 — First login and onboarding

1. Go to `https://growth-os-xxx.vercel.app/login`
2. Enter your email → click "Email me a sign-in link"
3. Open your email → click the magic link
4. You land on `/onboarding` (redirected because no active challenge exists)

### Wizard Step 1 — Name the sprint
- Challenge name: `90-Day Creator Sprint` (or your preferred name)
- Day 1: today's date
- Pace: `Compounding` (recommended — slower start, steeper finish)

### Wizard Step 2 — Platforms
Fill in your **actual current numbers** (open each app now):

| Platform | Today's count | Day-90 target |
|----------|--------------|---------------|
| LinkedIn | [your followers] | 5,000 |
| Medium | [your followers] | 5,000 |
| Reddit | [your karma] | 5,000 |
| Newsletter | [your subscribers] | 1,000 (or skip) |

Reddit metric: choose **karma** or **followers** depending on what you're optimizing.

If you want to track anything else (weight, savings, words written): click "+ Add anything else" at the bottom and set direction to ↓ reduce or ↑ grow.

### Wizard Step 3 — Content pillars
Default: `build-in-public, lessons-learned, how-to`
Change to whatever themes you'll write about. You can edit in Settings later.

Publishing target: how many posts per week across all platforms?

Click **Start Day 1**.

**Expected:** Redirected to `/dashboard`. You see:
- `DAY 01 / 90` counter
- The check-in banner ("Today's numbers aren't in yet")
- Your trackable cards showing baselines, no pace yet (pace appears after Day 2)
- Empty trajectory state ("Your trajectory appears after a couple of days...")

---

## STEP 10 — Log Day 1

1. Click **Log today** or go to `/log`
2. Open each platform in another tab, copy your current numbers
3. Enter each number in the field (formats accepted: `1247`, `1,247`, `1.2k`)
4. Fill in the activity fields if shown (comments made, connection requests, etc.)
5. Click **Save Day · [today's date]**

**Expected:** Redirected to `/dashboard`. You see:
- `DAY 01 / 90` counter
- Streak counter: `1🔥`
- Check-in banner: gone (replaced by your data)
- Cards showing Day 1 values with pace badges
- Trajectory chart still empty (needs 2+ days)

**Verify the data landed:**
Go to Supabase → Table Editor → `metric_snapshots`
Filter: `local_date = today`
You should see one row per trackable with your values.

---

## STEP 11 — Verify export

1. Go to `/settings`
2. Click **Download JSON**
3. Open the file — verify it contains your challenges, trackables, and today's snapshot
4. Click **Download CSV (snapshots)**
5. Open in a spreadsheet — verify your Day 1 row is there

**Export integrity check:**
```bash
# Count snapshot rows in the downloaded CSV
wc -l growth-os-snapshots-*.csv
# Should be: 2 (header + 1 row for Day 1 × however many trackables)
# e.g., for 4 trackables: 5 rows (header + 4 snapshots)
```

---

## STEP 12 — Final production verification checklist

Run through this before closing the laptop:

| Check | How to verify | Expected |
|-------|--------------|----------|
| Login works | Sign out → sign back in | Magic link received, redirected to /dashboard |
| Day counter | Dashboard header | `DAY 01 / 90` |
| Streak | Dashboard header | `1🔥` |
| All trackables show | Dashboard cards | One card per platform + custom |
| Values match what you entered | Compare cards to log page | Identical numbers |
| Export contains data | Download JSON | Your challenge, trackables, 1 snapshot row per trackable |
| Supabase PITR enabled | Supabase → Settings → Add-ons | Point-in-Time Recovery: ON |
| No errors in Sentry | Sentry dashboard | Zero events (after a clean session) |

---

## STEP 13 — Day 2 onwards

The daily ritual:
1. Log into the app whenever you have 2 minutes (morning or evening)
2. Open each platform, copy your follower/karma counts
3. Go to `/log` → paste numbers → Save
4. Check the dashboard for your trajectory

The chart becomes useful from Day 3. By Day 7 you'll see velocity trends.

**If you miss a day:** The dashboard shows a "Backfill" banner for yesterday. You can log past dates via `/log?date=YYYY-MM-DD` as long as the date is within the challenge window.

---

## Troubleshooting

### Magic link not arriving
- Check spam folder
- Verify Supabase → Authentication → Email is enabled
- Check Supabase → Authentication → Logs for errors

### After clicking magic link, redirected to /login with `?error=auth`
- The Supabase redirect URL allowlist is missing your Vercel URL
- Fix: Authentication → URL Configuration → add `https://YOUR-APP.vercel.app/auth/callback`

### Dashboard loads but shows "Redirecting to onboarding"
- No active challenge exists yet — the wizard creates it
- If wizard was completed but still redirecting: check Supabase → challenges table for `status = 'active'`

### Numbers saved but dashboard still shows baselines
- Hard refresh the page (Cmd+Shift+R / Ctrl+Shift+R)
- The dashboard is `force-dynamic` but browser cache can interfere

### Vercel build fails
- Check Vercel → Deployments → Build logs
- Most common cause: missing environment variable
- Verify all 4 variables are set (SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY, CRON_SECRET)

---

## Post-Day 1 tasks (within the week)

- [ ] Run the restore drill (README → Restore drill section) — 30 minutes, required before Day 7
- [ ] Add Sentry DSN if not done in step 6
- [ ] Verify CI passes on GitHub Actions (check the Actions tab)
- [ ] Confirm branch protection status checks are wired (after first CI run)
- [ ] Set a daily reminder for your log time (phone alarm or calendar event)
