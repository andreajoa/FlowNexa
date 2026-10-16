# Acceptance
- Public landing layout and brand preserved; signup/login links lead to the actual application: regression and browser tests.
- Registration verifies email; recovery one-use/revokes sessions; brute-force limits; tenant isolation: SQLite integration tests.
- Account connection validates OAuth browser/state/membership, subscribes official webhook, encrypted tokens, refresh/disconnect: mocked API contracts plus real authorized Meta account when available.
- Save/edit/test/publish/pause real flows; media ownership; workspace permissions: API+browser tests.
- Verified webhooks enqueue durably, return fast, duplicate-safe; workers claim leases; private reply dedupe across flows; policy windows rechecked; uncertain sends never blindly repeated: SQLite and controlled HTTP tests.
- Provider success requires actual message ID, failures visible; queue retry and dead letter operational.
- No production-ready claim without actual authorized Instagram comment -> delivered reply and trace.

- Beginner experience: ten supported models with editable details and message preview; selection creates no DB records; create-from-scratch path; clear actual onboarding progress; mobile and keyboard usability: browser + runtime validation tests.
- Viral bursts: accept 1000 normalized events, bounded database requests, no dropped events, replay-safe after partial persistence; unknown account events remain isolated: integration tests.
- Recurring billing: authenticated workspace-scoped Embedded Checkout using server allowlisted recurring prices, signed/raw-body/timestamp-checked replay-safe webhooks, authoritative subscription status and customer portal; no paid access from return URLs. Sandbox/provider contract tests and actual Stripe sandbox acceptance when credentials available.
- Marketing benefit inventory and competitor references distinguish implemented, live-verified, planned and permission-dependent features. No invented prices or unlimited-cost AI promises.
