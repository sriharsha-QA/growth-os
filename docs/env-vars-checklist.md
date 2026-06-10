# Production Environment Variables Checklist

Verify each variable is set in Vercel before the first production deployment.

## Vercel → Settings → Environment Variables

| Variable | Required | Scope | Where to find |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | YES | All | Supabase → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | YES | All | Supabase → Settings → API → anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | YES | Production + Preview | Supabase → Settings → API → service_role key |
| `CRON_SECRET` | YES | Production only | Generate: `openssl rand -hex 32` |
| `NEXT_PUBLIC_SENTRY_DSN` | YES (for error monitoring) | All | Sentry → Project → Settings → Client Keys (DSN) |

## Verification commands (run after setting)

```bash
# Verify env vars are not empty in a deployed Vercel function
# Add this temporary check to /api/cron/nightly and hit it once:
console.log('Env check:', {
  supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  serviceRole: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  cronSecret: !!process.env.CRON_SECRET,
  sentry: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})
```

## Security rules
1. `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` must NEVER be prefixed `NEXT_PUBLIC_`
2. For preview deployments: use a separate staging Supabase project. Never point preview at production DB.
3. Rotate `CRON_SECRET` if it appears in any log or is committed accidentally.
4. The ESLint fence (`eslint.config.mjs`) prevents the service role key from reaching client bundles via code — but env var configuration must also be correct.

## CI environment variables (GitHub Secrets)
The `db` job uses these in `.github/workflows/ci.yml`:
- `PGHOST=localhost` (set via `env:` in the workflow — no secret needed)
- `PGUSER=postgres` (idem)
- `PGPASSWORD=postgres` (idem)
- `TEST_DB=growth_os_ci` (idem)

No production secrets should ever be added to GitHub Actions for the `db` job.
