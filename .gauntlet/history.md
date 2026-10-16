Initial diagnosis: real public root works; backend configuration path returns503 before request reaches app. Hypotheses ranked: (1) gateway expects absent Worker origin despite provisioned D1, (2) missing runtime schema/adapter, (3) Meta external setup. Implement direct Vercel runtime using existing dedicated D1, preserving legacy proxy fallback and the exact public landing.

## Runtime implementation checkpoint
- Incorporated public main45fa5eb without changing landing/client/assets.
- Applied immutable D1 migrations0005runtime and0006identity to dedicated FlowNexa DB.
- 42 tests pass, including provider-boundary integration, tenant isolation, recovery, OAuth browser binding and subscription confirmation, queue duplicate/lease/unknown handling and account lifecycle.
- Independent critic approves deployment only with MESSAGING_ENABLED=false. UI accepted/unknown status issue fixed; numeric media IDs rejected.
- Dedicated Cloudflare minute scheduler deployed, health200, existing workers preserved. Full application tick awaits runtime release.
- CLI staged production deployment blocked by Vercel commit-author/team association. Existing authorized linked Git deployment route remains available and is being used instead; no permission or identity metadata changed.
- Meta app creation prepared as FlowNexa, Instagram messaging/content usecase, official contact email, existing AJFutureSolutions portfolio. Meta explicitly requires user password reauthentication; user prompted to complete directly in browser. App is not yet created.
