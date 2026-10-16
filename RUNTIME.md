# FlowNexa runtime

The approved public landing remains in `src/landing.js` and `src/landing-script.js`.
The private application is `/app`; Vercel executes `api/index.js` directly and persists data with the Cloudflare D1 REST API. No Worker proxy origin is required.

## Configuration

Use server-only Vercel environment settings from `.env.example`. Generate an independent 32-byte hex token encryption key. Never rotate this key without re-encrypting existing records. Account emails use the verified FlowNexa Resend domain. Apply immutable migrations using `node scripts/migrate.js` with the D1 environment supplied privately.

Meta requires an Instagram app with Instagram Login. Configure its exact redirect URI, callback `https://flownex.online/webhooks/instagram`, verification token and `comments,messages` fields. Request `instagram_business_basic`, `instagram_business_manage_comments`, `instagram_business_manage_messages`. Account OAuth subscribes and confirms the account subscription before saving a connected account. Subscription POST/DELETE use `/me/subscribed_apps`, while the professional identifier from `/me?fields=user_id,username` is stored for webhook matching. Confirmation requires a successful authenticated POST with `success === true`, as documented in the [Meta webhook setup guide](https://developers.facebook.com/documentation/instagram-platform/webhooks/setup). GET subscription record IDs are not compared with OAuth/parent app IDs. Use the Instagram product secret for `META_APP_SECRET` (OAuth), and explicitly configure `META_WEBHOOK_SECRET` for incoming webhook HMAC for the same Instagram product. Do not assume the parent Meta app secret signs events for this product. Webhook validation fails closed if the signing secret is missing. Production access to third-party accounts depends on Meta app eligibility and approvals; local mocks do not establish approval.

The minute scheduler in `scheduler/` invokes the fixed authenticated internal tick endpoint. Keep its CRON_SECRET identical to Vercel. The public handler never starts jobs. The endpoint rejects unauthenticated ticks. Verify a scheduled invocation after any release.

## Operation semantics

Flows are created as drafts. Editing pauses a flow and increments its version. Publishing requires a configured sender and connected, unexpired account. Set MESSAGING_ENABLED=true only after completing the authorized Meta account test. Simulation never sends.

For an interaction matching more than one flow, the oldest matching enabled flow wins (created_at then id). Each comment has one private reply effect across all flows. Contact-once suppression is per flow/account and requires a known interaction author. Own comments and nested replies are ignored to prevent response loops. Only selected/all media scopes are supported.

A verified webhook is stored encrypted before acknowledgement. Concurrent consumers use atomic leases and durable action reservations. Each successful provider response must include a message/comment ID. `accepted` means API acceptance, not delivery or read confirmation. An ambiguous POST result is `unknown`; do not retry it automatically. Investigate with Meta before any manual recovery. A rejected 429 can retry with bounded exponential backoff. A flow pause/version change cancels actions not already being sent; it cannot recall a request already handed to Meta.

Instagram private replies recheck the original comment timestamp through Meta. Direct replies require an inbound interaction within 24 hours. There are no unsolicited recipient uploads or human-agent window exceptions. Private comment rules must also be validated against the app's current Meta policy before launch, including live content eligibility.

## Release verification

Run `npm ci --ignore-scripts`, `npm test`, `npm run check`. Tests use real SQLite for tenant isolation, recovery tokens, queue leases, duplicate events, pauses, expiry, rate limits, uncertain responses and provider acceptance persistence failures. UI browser smoke verifies editing and mobile overflow; it is not a real Instagram integration test.

Release only after comparing public landing sources and assets with current origin/main. Test the deployed app, D1 health, verification email delivery, Meta OAuth/subscriptions, one authorized Instagram interaction, its provider ID and the periodic retry invocation. Until that Instagram test passes, describe the product as integration pending, never fully operational.


## Recurring subscriptions (Stripe Embedded Checkout)

The application uses Stripe API `2026-08-26.dahlia`, `mode=subscription`, `ui_mode=embedded_page` and Stripe.js `initEmbeddedCheckout`. The mode name is confirmed by [the version-pinned official Stripe SDK](https://github.com/stripe/stripe-node/blob/v22.6.0/src/resources/Checkout/Sessions.ts). Checkout mounts inside `/app` after an explicit customer click. It is not loaded on initial page access. The private panel uses the original brand mark and favicon.

Server-only configuration: restricted `STRIPE_SECRET_KEY` with the necessary Customers/Prices/Checkout/Subscriptions/Portal permissions, publishable `STRIPE_PUBLISHABLE_KEY` matching test/live mode, `STRIPE_WEBHOOK_SECRET`, and `STRIPE_PRICE_MAP` as a JSON object mapping approved public plan IDs to existing recurring Stripe Price IDs. Never provide browser-selected amounts or customer IDs. Plan names, prices, currency and intervals are read from Stripe; no production prices have been invented. `PUBLIC_BASE_URL` must be the canonical HTTPS site origin. Create and test a separate Stripe sandbox before using live keys.

Apply migration `0007_billing.sql` before deploying the new routes. Expose `POST /webhooks/stripe` with the exact raw request bytes and `Stripe-Signature` preserved. Configure events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `invoice.paid`, `invoice.payment_failed`. Signature timestamp tolerance is 300 seconds. Event IDs and body hashes detect replay/conflicts; processing failures remain retryable. Webhooks retrieve the current subscription under a workspace lease so event arrival order never grants stale access. Unknown customer metadata cannot attach another workspace.

The return URL and the JavaScript completion callback never grant paid access. Checkout creation uses durable idempotency keys; open sessions resume instead of duplicating. Customers can manage subscriptions through the official Stripe Customer Portal, which must be configured for the merchant account. No tax collection or registration was enabled. Configure those only with the owner's actual business/tax requirements.

`GET /api/billing/status?workspace=...` returns configuration status, authorized plan information and webhook-derived subscription state. Authenticated owner/admin `POST /api/billing/checkout` accepts `{workspace_id,plan}`; `POST /api/billing/portal` accepts `{workspace_id}`. Responses containing `client_secret` are private and must not be logged, cached, rendered as text or stored in browser storage.

`BILLING_ENFORCED=false` preserves the current authorized testing/free experience until commercial plans and their access policy are approved. With `true`, publishing and queued sends require a current active/trialing subscription for an allowlisted price; cancellation, unpaid status or expiration prevent sends. This switch does not define a free-plan quota. Define that policy before commercial activation. Live billing still requires the correct merchant account, approved prices, webhook configuration and a completed sandbox payment/renewal/cancellation test. Mocked contract tests and an embedded mock iframe are not a real Stripe payment.


## Live Instagram activation (2026-10-16)

The Meta parent app is now published. The official dashboard previously blocked live webhooks while the app was unpublished. Global `MESSAGING_ENABLED=true` is authorized for the owner account, and only the owner-created legacy flow `automacao 1` was published through the actual app. The live Instagram subscription confirms `comments,messages`.

The first actual provider webhook requests returned403. The signing configuration initially used the parent app key; it has been changed to the Instagram product key for this integration. A real signed comment subsequently persisted, completed, and produced an accepted provider message ID; the endpoint still verifies exactly one explicitly configured `META_WEBHOOK_SECRET`, with no signature bypass or multiple-secret fallback. OAuth and webhook settings are distinct configuration variables even where the provider uses the same secret value. Confirm HTTP200 plus durable event/provider result before claiming live delivery.
