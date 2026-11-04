# FlowNexa: migration from Vercel to Cloudflare

## Current status (2026-10-30)

- Original production site: `https://flownex.online` (HTTP 402 while the Vercel account is paused).
- Cloudflare test Worker: `https://flownexa-migration-staging.andrealmeidashop.workers.dev`.
- Isolated Cloudflare D1 test database: `flownexa-migration-staging`. All 10 repository migrations were applied.
- Cloudflare test Worker handles landing pages, Portuguese/English assets, `/app`, sitemap, authenticated API routing, and health checks.
- Staging is deliberately configured with `MESSAGING_ENABLED=false` and `PUBLIC_SIGNUP_ENABLED=false`. Its `robots.txt` disallows indexing.
- The original production D1 database remains unchanged.
- No production DNS, Stripe webhook destination, Meta app callback, Zernio webhook destination, or cron has been switched yet.

## Files

- `src/cloudflare-entry.js`: Worker HTTP adapter for Vercel-only landing routes, with a scheduled handler disabled unless explicitly configured.
- `wrangler.staging.example.toml`: staging template, no secrets.
- `wrangler.production.example.toml`: production template, no secrets, with messaging and cron disabled by default.
- `tests/cloudflare-entry.test.js`: endpoint and authorization regression tests.
- Actual local Wrangler configurations containing account-specific database IDs are intentionally ignored by Git.

## Important production blockers

Vercel exports configuration variables, but 19 production **Secret** values cannot be downloaded via `vercel env pull`; its export uses `[SENSITIVE]` placeholders. Eight of these are present in an older, independent local runtime configuration, but are not automatically assumed to be current. Other missing values include:

- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `ZERNIO_API_KEY`, `ZERNIO_WEBHOOK_SECRET`
- `CLOUDFLARE_AI_TOKEN`, `CLOUDFLARE_AI_ACCOUNT_ID`
- `RESEND_WEBHOOK_SECRET`
- related AI feature flags

Recover or rotate missing credentials through each official provider and set them directly in Cloudflare Workers Secrets. Do not place secrets in git, chat, public CLI output, or Wrangler plaintext variables. Test that existing encrypted customer data remains decryptable using its original `TOKEN_ENCRYPTION_KEY`.

## Required checks before production cutover

1. Ensure production Cloudflare Workers CPU limits and billing are suitable for the real workload.
2. Configure all server-only production secrets and verify Stripe sandbox billing, webhook signature handling, Resend account email, Meta OAuth and real authorized Instagram webhook, and Zernio account flows.
3. Verify production D1 access **without** applying staging migrations to production or copying staging data to production.
4. Establish exactly one reliable scheduled queue drain. The previous scheduler must be disabled or reconfigured before enabling a Cloudflare Cron Trigger, avoiding duplicate sends.
5. Verify login, identity/session cookies, subscription enforcement, Meta permission checks, all workspaces and customer data, and processing idempotency with controlled tests.
6. Back up DNS records and preserve the ability to roll back; only then move `flownex.online` to the new Worker. Validate `/app`, `/api/health`, `/webhooks/instagram`, `/webhooks/stripe` and monitor logs.

A successful landing page and health check **do not** establish production readiness.
