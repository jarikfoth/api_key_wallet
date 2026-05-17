# API Key Wallet

OAuth for AI API keys. A personal wallet for your OpenAI/Anthropic/Google/Deepgram keys, plus a vendor integration platform so software providers can offer one-click "Connect API Key Wallet" instead of asking users to paste 4 keys.

## What's in the box

```
apps/
  web/     Next.js 15 — consumer wallet, OAuth authorization server, vendor portal, landing
  proxy/   Hono on Cloudflare Workers — the always-on gateway that swaps virtual keys for real keys

packages/
  crypto/    AES-256-GCM envelope encryption (MEK → DEK → root keys)
  db/        Typed Supabase client + queries
  providers/ Adapters for OpenAI, Anthropic, Google Gemini, Deepgram
  sdk/       @apikeywallet/sdk — React button + vanilla JS + server-side exchangeCode()
```

## Quick start

See [SETUP.md](./SETUP.md) for one-time cloud-account setup (Supabase, Cloudflare, Google OAuth).

Once configured:

```bash
pnpm install
pnpm dev   # web on :3000, proxy on :8787
```

## Architecture, security, OAuth spec

See the build plan: `~/.claude/plans/alright-i-ll-just-copy-paste-precious-crystal.md`
