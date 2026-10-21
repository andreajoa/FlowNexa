# TikTok channel

Implemented on `feat/tiktok-integration`, stacked on `feat/commerce-integrations`. Production remains unchanged.

## Customer flow

Open TikTok in the dashboard, connect the account through OAuth, accept the requested permissions and return to the same workspace. Create a text-response draft, select incoming private messages or public comments (all or keywords), and publish. The visual editor supports a message followed by a wait for the customer's reply, conditions and an end. Timeout paths must end without reminders. One published flow per account/event family prevents competing replies; use graph branches for variants.

Owners and admins can manage the channel. Other members can see account and execution state. Each workspace currently permits up to five account records and 50 flows. TikTok responses count toward the shared monthly message allowance. The five-account cap is a channel cap, not a declaration of commercial plan entitlement.

## Configuration and activation

Server configuration:

- Existing `ZERNIO_API_KEY`, `ZERNIO_WEBHOOK_SECRET`, `TOKEN_ENCRYPTION_KEY` and D1 database.
- `TIKTOK_CHANNEL_ENABLED=false` disables connection/API handling. Otherwise the channel is available when all required server secrets exist.
- `TIKTOK_SENDS_ENABLED=true` explicitly enables publishing and queue processing; absent/false allows connection and drafts only.
- `MESSAGING_ENABLED=false` also stops TikTok sends.
- Apply `migrations/0014_tiktok.sql` to the intended environment; runtime initialization also creates missing tables idempotently.

Use `/api/tiktok/callback` on the same deployment origin for OAuth. OAuth state is single-use, expires after ten minutes and is bound to the browser session, user, workspace and provider profile. Reconnection also passes `reconnectAccountId` to the provider and verifies returned identity.

The existing signed `/webhooks/zernio` endpoint routes TikTok `message.received`, `comment.received` and `account.disconnected` events. Register these events for the intended environment; do not redirect an existing production webhook to a preview. Ensure the existing authenticated `/api/internal/tick` schedule reaches the same environment. Protected previews require a provider-accessible webhook route or a dedicated test environment.

Before production activation, validate with an authorized eligible account: OAuth permissions, inbound message and public comment, actual reply in TikTok, graph continuation, pause, opt-out and disconnect. Confirm provider inbox entitlement. A connected label means OAuth/account identity was verified; it does not certify DM eligibility. No live account test or production activation was performed here.

## Runtime behavior

Signed receipts are encrypted at rest and deduplicated by account/platform event ID. A database lease serializes the worker; events are planned durably, and later events for an account wait while a response is pending. Sessions advance only with accepted replies in the same database transaction. Accepted status means the provider returned an identifier, not a delivery/read receipt.

Connection and flow versions, opt-out, billing and send windows are checked before each effect. STOP, PARAR, SAIR and CANCELAR disable further private replies for that contact. There is no automated opt-in reset in this version. Explicit throttling is retried with bounded backoff; network/5xx ambiguity is never blindly retried. An in-flight send cannot be recalled by a later pause or opt-out.

Disconnect pauses local flows and cancels queued responses; it does not revoke the provider's upstream TikTok grant. Revoke that permission in TikTok/provider settings if desired. A stale disconnect webhook rechecks the provider before changing local state.

Pending payloads remain encrypted. Processed inbound bodies and final response payloads are erased; dedupe, execution and opt-out metadata remain. Account-level serialization is intentionally conservative; higher-volume throughput and a metadata-retention policy remain follow-up operational work.

## Local validation

Run `npm test`. `tests/tiktok.test.js` covers signed ingress, account/profile isolation, session-bound OAuth, graph continuation, concurrency/crash recovery, opt-out, publication conflicts, quota, stale/echo events and ambiguous delivery. `review/tiktok/browser-check.mjs` exercises the actual API and SQLite with a mocked provider at 375, 768 and 1440px, including an account with no Instagram connection. It requires `PUPPETEER_PATH` pointing to a local puppeteer-core installation.
