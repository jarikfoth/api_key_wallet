# API Key Wallet — Setup

This guide walks you through wiring up the cloud accounts and getting the dev server running. It assumes you're starting from a fresh clone of the repo.

## What you'll be setting up

| Service | What for | Cost at MVP |
|---|---|---|
| [Supabase](https://supabase.com) | Database + user authentication (Frankfurt region) | Free tier |
| [Cloudflare](https://cloudflare.com) | Workers proxy | Free tier (100k req/day) |
| [Vercel](https://vercel.com) | Next.js hosting | Free tier (Hobby) |
| [Google Cloud Console](https://console.cloud.google.com) | "Sign in with Google" OAuth credentials | Free |

You'll be back-and-forth between dashboards. Have this file open in one window.

---

## Step 1 — Install tools locally

```bash
# Node 20+
node --version       # if missing, brew install node@20

# pnpm
npm install -g pnpm

# Supabase CLI (for running migrations)
brew install supabase/tap/supabase

# Cloudflare Wrangler (auto-installs via pnpm; or globally:)
# npm install -g wrangler
```

Then install repo deps:

```bash
cd "$REPO_DIR"
pnpm install
```

---

## Step 2 — Create a Supabase project

1. Go to https://supabase.com/dashboard, click **New project**.
2. Name: `api-key-wallet`. Region: **Central EU (Frankfurt)**. Set a database password (save it).
3. Wait ~2 min for provisioning.
4. From the project dashboard, copy these to a scratch file:
   - **Project URL** (looks like `https://xxxxxxxx.supabase.co`)
   - **anon public** key
   - **service_role** key (DANGEROUS — never expose in browser)

---

## Step 3 — Run the database migrations

From the repo root:

```bash
# Link the local repo to your Supabase project
supabase login
supabase link --project-ref <your-project-ref>

# Push the schema
supabase db push
```

(`<your-project-ref>` is the part of the URL before `.supabase.co`.)

You should see one migration applied (`20260514000000_init.sql`).

Verify in the Supabase dashboard → Table Editor: you should see `root_keys`, `virtual_keys`, `vendor_apps`, `usage_events`, etc.

---

## Step 4 — Set up "Sign in with Google"

1. Go to https://console.cloud.google.com/apis/credentials.
2. Create a new project if needed.
3. Configure the OAuth consent screen (External, user type — just for testing your team can be the only users).
4. Create **OAuth client ID** → **Web application**.
5. Authorized redirect URIs:
   - `https://<your-project-ref>.supabase.co/auth/v1/callback`
   - For local dev later: `http://localhost:3000/auth/callback`
6. Copy the **Client ID** + **Client secret**.

Then in Supabase dashboard → Authentication → Providers → Google: paste the Client ID + Secret, save.

---

## Step 5 — Generate a Master Encryption Key (MEK)

```bash
pnpm --filter @akw/scripts gen:mek
```

Copy the base64 string it prints. Save it somewhere safe — losing it means losing access to every encrypted root key in the DB.

---

## Step 6 — Configure local dev env

In the repo root:

```bash
cp .env.example .env.local
```

Edit `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — from step 2
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from step 2
- `SUPABASE_SERVICE_ROLE_KEY` — from step 2
- `MEK` — from step 5
- `NEXT_PUBLIC_APP_URL=http://localhost:3000`
- `NEXT_PUBLIC_PROXY_URL=http://localhost:8787`

Then for the proxy:

```bash
cp apps/proxy/.dev.vars.example apps/proxy/.dev.vars
```

Fill in `MEK`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` with the same values.

---

## Step 7 — Run it locally

```bash
pnpm dev
```

This boots both:
- The Next.js app at http://localhost:3000
- The Cloudflare Workers proxy at http://localhost:8787

Smoke check:
1. Open http://localhost:3000 → landing page renders.
2. Click "Get started" → sign in with Google.
3. After auth, you should land on `/dashboard`.
4. Go to **Root keys** → paste a real OpenAI API key.
5. Go to **Virtual keys** → create one. Copy the `akw_live_…` secret.
6. Test the proxy:
   ```bash
   curl http://localhost:8787/openai/v1/chat/completions \
     -H "Authorization: Bearer akw_live_o_xxx" \
     -H "Content-Type: application/json" \
     -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"hi"}]}'
   ```
   Expect a normal OpenAI response. Check the dashboard — you should see a usage event.

---

## Step 8 — Deploy

### Cloudflare Workers (the proxy)

```bash
cd apps/proxy
npx wrangler login
npx wrangler secret put MEK            # paste your MEK
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler deploy
```

You'll get a URL like `https://akw-proxy.<your-account>.workers.dev`. Use this as `NEXT_PUBLIC_PROXY_URL`.

### Vercel (the web app)

1. Push the repo to GitHub.
2. Go to https://vercel.com → Import Project → select the repo.
3. **Framework**: Next.js. **Root directory**: `apps/web`.
4. Add environment variables (same as `.env.local`).
5. Deploy.

### Custom domains (optional, for production)

- Point `wallet.<your-domain>` → Vercel.
- Point `proxy.<your-domain>` → Cloudflare Workers.
- Update `NEXT_PUBLIC_APP_URL` and `NEXT_PUBLIC_PROXY_URL` accordingly.
- Update Google OAuth redirect URIs to include the prod callback.

---

## Step 9 — Seed omi.me + test the OAuth flow

```bash
pnpm --filter @akw/scripts seed:omi
```

Save the `client_id` + `client_secret` it prints. Then run the smoke test:

```bash
AKW_TEST_CLIENT_ID=akw_client_xxx \
AKW_TEST_CLIENT_SECRET=akw_secret_xxx \
pnpm --filter @akw/scripts smoke
```

Follow the prompts. The script will:
1. Generate a PKCE pair + an `/authorize` URL.
2. Ask you to approve it in a browser.
3. Take the `code` from the redirect URL and exchange it via `/api/oauth/token`.
4. Hit the proxy with the returned virtual key.

If everything's green, you're ready to pitch omi.me with a working demo.

---

## Troubleshooting

| Symptom | Probable cause |
|---|---|
| `MEK env var is empty` | `.env.local` or `.dev.vars` missing MEK |
| 401 on proxy with valid key | Check the proxy's `.dev.vars` for `SUPABASE_SERVICE_ROLE_KEY` |
| Sign-in redirect goes to wrong place | Check `NEXT_PUBLIC_APP_URL` in `.env.local` matches where you're running |
| Migrations fail | Run `supabase db reset` to start clean (loses any test data) |
| Streamed OpenAI response is blank in client | Check `compatibility_flags = ["nodejs_compat"]` in `apps/proxy/wrangler.toml` |
