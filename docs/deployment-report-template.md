# Deployment Report — Growth OS

**Status:** [ ] In Progress  [ ] Complete  
**Date:**  
**Deployer:**  

---

## Production URLs

| Resource | URL | Status |
|----------|-----|--------|
| Application | https://_________________.vercel.app | [ ] Live |
| Login | https://_________________.vercel.app/login | [ ] Accessible |
| Dashboard | https://_________________.vercel.app/dashboard | [ ] Accessible |
| Quick Log | https://_________________.vercel.app/log | [ ] Accessible |
| Supabase Project | https://app.supabase.com/project/_____________ | [ ] Active |
| GitHub Repo | https://github.com/___________/growth-os | [ ] Pushed |

---

## Environment Verification

### Supabase
- [ ] Project status: Active
- [ ] Region: ap-south-1 (Mumbai)
- [ ] Plan: Pro (PITR enabled)
- [ ] All 21 tables visible in Table Editor
- [ ] All tables show lock icon (RLS enabled)
- [ ] Auth: Email (magic link) enabled
- [ ] Auth: Google OAuth enabled
- [ ] Site URL set to production URL
- [ ] Redirect URL includes `/auth/callback`
- [ ] `fn_local_date(now(), 'Asia/Kolkata', '04:00')` returns today
- [ ] `fn_pace_target(100, 5000, 'increase', 'compounding', 45, 90)` returns 707.1068

### Vercel
- [ ] Build: Compiled successfully
- [ ] All 11 routes deployed
- [ ] Environment variables set (5 total)
- [ ] No NEXT_PUBLIC_ prefix on service_role or cron_secret
- [ ] Custom domain configured (optional)
- [ ] Cron job visible in Vercel → Settings → Crons

### GitHub
- [ ] All code pushed to main
- [ ] CI workflow triggered (Actions tab)
- [ ] Branch protection enabled on main
- [ ] Status checks: 3 required checks added
- [ ] First PR attempted direct push → rejected

---

## First User Onboarding Verification

**User email:** ________________  
**Signup method:** [ ] Magic link  [ ] Google OAuth  
**Signup time:**  

| Step | Status | Notes |
|------|--------|-------|
| Email received magic link | [ ] PASS / [ ] FAIL | |
| Clicked link → landed on /onboarding | [ ] PASS / [ ] FAIL | |
| Profile row created in Supabase | [ ] PASS / [ ] FAIL | |
| Completed wizard step 1 (name/date/pacing) | [ ] PASS / [ ] FAIL | |
| Completed wizard step 2 (platforms + baselines) | [ ] PASS / [ ] FAIL | |
| Completed wizard step 3 (pillars) | [ ] PASS / [ ] FAIL | |
| Redirected to /dashboard after wizard | [ ] PASS / [ ] FAIL | |
| Dashboard shows DAY 01 / 90 | [ ] PASS / [ ] FAIL | |
| Check-in banner visible | [ ] PASS / [ ] FAIL | |

---

## Day 1 Data Validation

**Log submission time:**  
**Numbers logged:**

| Platform | Baseline | Target | Day 1 Value |
|----------|---------|--------|-------------|
| LinkedIn | | 5,000 | |
| Medium | | 5,000 | |
| Reddit | | 5,000 | |
| Newsletter | | 1,000 | |

| Check | Status | Evidence |
|-------|--------|---------|
| Snapshots in metric_snapshots table | [ ] PASS / [ ] FAIL | Row count: |
| v_daily_progress returns rows | [ ] PASS / [ ] FAIL | Row count: |
| Dashboard cards show logged values | [ ] PASS / [ ] FAIL | |
| Streak counter shows 1🔥 | [ ] PASS / [ ] FAIL | |
| Check-in row in check_ins table | [ ] PASS / [ ] FAIL | |
| Day 1 SQL validation script output | [ ] ALL PASS / [ ] FAIL | |

---

## Export Verification

| Check | Status |
|-------|--------|
| JSON export downloaded | [ ] PASS / [ ] FAIL |
| JSON contains challenge data | [ ] PASS / [ ] FAIL |
| JSON contains trackables | [ ] PASS / [ ] FAIL |
| JSON contains today's snapshots | [ ] PASS / [ ] FAIL |
| CSV export downloaded | [ ] PASS / [ ] FAIL |
| CSV row count = trackable count + 1 header | [ ] PASS / [ ] FAIL |

---

## Issues Found

| # | Issue | Severity | Resolution |
|---|-------|---------|------------|
| | | | |

---

## Final Assessment

[ ] **GO** — All checks passed. Challenge is live. Day 1 logged.  
[ ] **NO-GO** — Issues found (see table above). Do not continue until resolved.

**Notes:**

---

## Day 2+ Reminders

- [ ] Set a daily phone alarm for log time
- [ ] Bookmark `/log` on your phone
- [ ] Install as PWA (Safari: Share → Add to Home Screen)
- [ ] Run restore drill before Day 7 (README → Restore drill section)
- [ ] Add Sentry DSN if not done
- [ ] Confirm CI is green on first PR
