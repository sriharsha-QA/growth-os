# Reddit karma auto-sync

Syncs `link_karma` and `comment_karma` into `metric_snapshots` once per day
using Reddit's OAuth2 refresh-token flow. No browser interaction after initial
setup.

## One-time setup — ~10 minutes

### 1. Create a Reddit OAuth app (script type)

1. Go to https://www.reddit.com/prefs/apps
2. Click **Create another app**
3. Name: `growth-os-sync`
4. Type: **script** (important — this allows refresh tokens without a web server)
5. Redirect URI: `http://localhost:8080` (unused for script apps, just needs a value)
6. Click Create
7. Note the **Client ID** (under the app name, short string)
8. Note the **Client Secret**

### 2. Get a refresh token

Script-type Reddit apps use password-grant to get the initial token pair.
Run this once from your terminal:

```bash
CLIENT_ID="your_client_id"
CLIENT_SECRET="your_client_secret"
USERNAME="your_reddit_username"
PASSWORD="your_reddit_password"

curl -X POST \
  -H "Authorization: Basic $(echo -n "$CLIENT_ID:$CLIENT_SECRET" | base64)" \
  -H "User-Agent: growth-os/1.0 by $USERNAME" \
  --data "grant_type=password&username=$USERNAME&password=$PASSWORD&scope=identity" \
  https://www.reddit.com/api/v1/access_token
```

Response includes `refresh_token`. Copy it.

> **Note:** For 2FA accounts, use the app-password (Reddit → Settings → Safety →
> Third-party app authorizations) instead of your account password.

### 3. Store credentials in Supabase secrets

```bash
supabase secrets set \
  REDDIT_CLIENT_ID="your_client_id" \
  REDDIT_CLIENT_SECRET="your_client_secret" \
  REDDIT_REFRESH_TOKEN="your_refresh_token" \
  REDDIT_USERNAME="your_reddit_username"
```

### 4. Enable sync on the Reddit trackable

In Supabase SQL Editor:

```sql
UPDATE public.trackables
SET sync_enabled = true
WHERE config->>'platform' = 'reddit'
  AND user_id = '00000000-0000-0000-0000-000000000001';
```

### 5. Deploy the function

```bash
supabase functions deploy reddit-sync
```

### 6. Test it

```bash
supabase functions invoke reddit-sync
```

Should return:
```json
{
  "ok": true,
  "synced": 1,
  "local_date": "2026-06-12",
  "link_karma": 2847,
  "comment_karma": 1203,
  "total_karma": 4050
}
```

### 7. Wire to cron

The nightly cron in `/src/app/api/cron/nightly/route.ts` should call this
function daily. Update it to:

```ts
await fetch(
  `${process.env.SUPABASE_FUNCTIONS_URL}/reddit-sync`,
  { method: "POST", headers: { "Authorization": `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` } }
);
```

Add `SUPABASE_FUNCTIONS_URL` to Vercel env vars:
`https://dygfdlinowdzsvhtfzxa.supabase.co/functions/v1`

## How karma is mapped

| `primary_metric` | Value synced |
|---|---|
| `karma` | `link_karma + comment_karma` (total) |
| `post_karma` | `link_karma` only |
| `comment_karma` | `comment_karma` only |
| anything else | `link_karma + comment_karma` (default) |

## What gets written

- `metric_snapshots` — one row per trackable per day, `source = 'api_sync'`
- `sync_runs` — one row per successful sync, includes raw karma values in `summary`
- The snapshot audit trigger fires on corrections (if you also logged manually)

## Troubleshooting

**`Reddit credentials not configured`** — run `supabase secrets set` again.

**`Reddit token exchange failed: 401`** — refresh token has expired or was
revoked. Re-run the curl command in Step 2 to get a new one.

**`No Reddit trackables with sync_enabled=true found`** — run the UPDATE in Step 4.

**Karma number seems wrong** — check `sync_runs` table in Supabase for the
raw values in the `summary` column.
