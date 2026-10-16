Initial diagnosis: real public root works; backend configuration path returns503 before request reaches app. Hypotheses ranked: (1) gateway expects absent Worker origin despite provisioned D1, (2) missing runtime schema/adapter, (3) Meta external setup. Implement direct Vercel runtime using existing dedicated D1, preserving legacy proxy fallback and the exact public landing.

## Runtime implementation checkpoint
- Incorporated public main45fa5eb without changing landing/client/assets.
- Applied immutable D1 migrations0005runtime and0006identity to dedicated FlowNexa DB.
- 42 tests pass, including provider-boundary integration, tenant isolation, recovery, OAuth browser binding and subscription confirmation, queue duplicate/lease/unknown handling and account lifecycle.
- Independent critic approves deployment only with MESSAGING_ENABLED=false. UI accepted/unknown status issue fixed; numeric media IDs rejected.
- Dedicated Cloudflare minute scheduler deployed, health200, existing workers preserved. Full application tick awaits runtime release.
- CLI staged production deployment blocked by Vercel commit-author/team association. Existing authorized linked Git deployment route remains available and is being used instead; no permission or identity metadata changed.
- Meta app creation prepared as FlowNexa, Instagram messaging/content usecase, official contact email, existing AJFutureSolutions portfolio. Meta explicitly requires user password reauthentication; user prompted to complete directly in browser. App is not yet created.

## Live disabled-messaging release
- PR4 merged as2f70b649be45a5e6eb418e403535ec62ee6fc50f; linked Git integration deployed production successfully on dedicatedflownexa3 team.
- /app200, /app.js200, /api/health200. Anonymous API401 and unauthenticated internal tick403 verified. Homepage returned exactly the pre-release bytes (SHA256379b0ec3739d76253a8de4ff94f4ddcdfcc9840f5bebe80394b2c9be2c26b942).
- Chromium acceptance:12 complete paths using actual runtime/SQLite and only mocked external providers. Live mobile application opens without script errors or horizontal overflow (anonymous me401 expected).
- Actual production registration returned202 and Resend accepted verification email sent solely to its official delivery-test recipient. Unverified login403 and hashed token persistence confirmed. Test tenant removed; inbox delivery was not independently confirmed.
- First actual scheduler observation exposed Workers rejecting redirect:error. Changed to manual, still rejects redirects/non2xx;3 tests passed. Dedicated worker redeployed, real cron outcomeok with processed0 while messaging disabled.
- Meta creation still awaits user's password confirmation in the native provider browser dialog. No real account connected or Instagram message sent. Do not enable messaging or describe Instagram as operational yet.
