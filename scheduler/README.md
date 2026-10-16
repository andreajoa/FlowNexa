# FlowNexa minute runner

The public site and application stay on Vercel. `flownexa-runner` supplies a Cloudflare Cron Trigger every minute and calls only `POST https://flownex.online/api/internal/tick`.

## Configuration

- Cloudflare account: `7ef2450965811249288bc35188f7cbf9`.
- Worker: `flownexa-runner`.
- Schedule: `* * * * *`.
- Required secret binding: `CRON_SECRET`, identical to the application's private Vercel value.
- No routes or DNS changes are required. No unrelated Worker is modified.
- Public `/health` reports Worker availability; all other public HTTP endpoints return 404. HTTP callers cannot run jobs.

Never commit credentials or put the secret into `wrangler.toml`. Configure it with the Cloudflare secrets API or `wrangler secret put CRON_SECRET --config scheduler/wrangler.toml`, supplying it privately. Deploying this config requires an account-scoped Workers Scripts Edit API token.

## Verification

`node --test scheduler/runner.test.js` verifies the fixed authenticated destination, redirect and error handling, and disabled public job triggers. Inspect the Worker Cron Trigger in Cloudflare and its scheduled event logs to confirm successful `tick_completed` events after the Vercel tick route is live. A successful Worker health response alone does not demonstrate successful job processing.

Non-2xx application responses fail the scheduled invocation visibly. Credentials and job contents are never logged; successful logs contain only aggregate counters. Processing, retry eligibility, deduplication and uncertain-delivery handling remain in the application.

Official API references:

- [Module uploads and secret bindings](https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/)
- [Cron Trigger API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/schedules/methods/update/)
- [Worker subdomain API](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/subdomain/)
- [Real-time Worker logs](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/tail/methods/create/)
