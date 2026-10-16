# Acceptance
- Landing files and response unchanged: hash and regression tests.
- Registration verifies email; recovery one-use/revokes sessions; brute-force limits; tenant isolation: SQLite integration tests.
- Account connection validates OAuth browser/state/membership, subscribes official webhook, encrypted tokens, refresh/disconnect: mocked API contracts plus real authorized Meta account when available.
- Save/edit/test/publish/pause real flows; media ownership; workspace permissions: API+browser tests.
- Verified webhooks enqueue durably, return fast, duplicate-safe; workers claim leases; private reply dedupe across flows; policy windows rechecked; uncertain sends never blindly repeated: SQLite and controlled HTTP tests.
- Provider success requires actual message ID, failures visible; queue retry and dead letter operational.
- No production-ready claim without actual authorized Instagram comment -> delivered reply and trace.
