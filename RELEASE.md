# FlowNexa: release checklist and operational runbook

## Verified implementation
- Node.js tests and syntax checks run in GitHub Actions.
- Signup, login, workspace listing and Instagram OAuth endpoints exist.
- Signed webhook payloads can be converted into idempotent **draft-only** execution logs.
- Automation drafts can be created and edited; sending real messages is intentionally disabled.
- `GET /api/ready` checks whether required runtime settings are present and returns HTTP 503 otherwise. A 200 response confirms configuration **only**, never Meta authorization or actual message delivery.

## External setup (requires account access; never commit secrets)
1. Create a Cloudflare D1 database. Put its actual ID in `wrangler.toml` or environment-specific config. Apply the D1 migrations to the intended target.
2. Set production mode and keep `MESSAGING_ENABLED=false`. Supply secure secrets using Cloudflare secrets management: `META_APP_ID`, `META_APP_SECRET`, `META_VERIFY_TOKEN`, `META_REDIRECT_URI`, `TOKEN_ENCRYPTION_KEY` (32-byte hex), `SESSION_SECRET` (32+ chars).
3. Deploy to a controlled staging hostname with HTTPS, run health/readiness checks, and test access controls and account isolation.
4. Create/configure a Meta app and Instagram professional account; request only necessary permissions. Configure redirect URI and signed webhook subscriptions and validate them against the current official Meta documentation.
5. Test representative comment/DM webhook payloads in staging, including duplicated events, invalid signatures, rejected access, malformed JSON, expired tokens, and rate limits.
6. Only after app review, compliant API senders, retry queues, operational monitoring, opt-out/data deletion, and full end-to-end delivery tests are implemented should the live messaging kill switch be considered for modification.

## Known release blockers
- No real outbound Instagram comment reply / private reply / DM service or confirmed API permissions.
- No reliable asynchronous event queue with retries/dead-letter semantics.
- No production OAuth renewal scheduler, recovery flow or full customer tenant administration.
- No completed no-code drag-and-drop journey builder, live metrics, or delivery receipts.
- No verified production D1 ID / Cloudflare deployment and no confirmed Meta app review.
- No complete security assessment, abusive-traffic rate limiter or realistic E2E tests.

## Launch acceptance test
A real authorized test Instagram user comments the subscribed keyword under a chosen post; the Meta webhook arrives with a verified signature; exactly one matching flow is executed; the permitted Instagram API reply is sent exactly once; the actual delivery status and API response are stored; failures retry without duplicate sends; customer data stays scoped to the workspace. Repeat across separate workspaces and simulate token expiry.

**Do not advertise FlowNexa as production-ready before this acceptance test passes.**
