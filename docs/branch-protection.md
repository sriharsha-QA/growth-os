# Branch Protection Setup

This file documents the required GitHub branch protection configuration for `main`.
These settings cannot be applied via code — they require GitHub repository admin access.

## Required settings (GitHub → Settings → Branches → Add rule for `main`)

### Protection rules
- [x] **Restrict pushes that create matching branches** — only branches, not direct pushes
- [x] **Require a pull request before merging**
  - Required approvals: 1 (increase to 2 when team grows)
  - Dismiss stale pull request approvals when new commits are pushed: ✓
- [x] **Require status checks to pass before merging**
  - Require branches to be up to date before merging: ✓
  - Required status checks (exact names from CI workflow):
    - `Lint, types, fences` (from `verify` job)
    - `Migrations, functions, RLS sweep` (from `db` job)
    - `Next.js production build` (from `build` job)
- [x] **Require conversation resolution before merging**
- [x] **Do not allow bypassing the above settings** (applies to admins too)

### Ruleset alternative (newer GitHub UI)
GitHub now uses "Rulesets" instead of classic branch protection. Create a ruleset:
- Target: `main` branch
- Rules: Restrict creations, deletions, require pull request (1 review), require status checks

## Verification
After enabling, attempt a direct push to `main`:
```bash
git push origin HEAD:main
```
This should be **rejected** with "remote: error: GH006: Protected branch update failed."

## Why this matters
The CI pipeline has 3 canary-tested gates:
- ESLint admin-import fence (fires on service-role client leaking to client bundles)
- Dormant-table gate (fires on accidental activation of schema-ready tables)
- No-second-formula gate (fires if pace math is reimplemented in TypeScript)

None of these gates protect production unless branch protection prevents direct pushes to `main`.
