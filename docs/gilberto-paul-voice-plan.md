# Gilberto Rebuild | Paul, voice notes and natural English replies

## Published live copy, October 22, 2026

Both saved Instagram automations were updated through the authenticated FlowNexa account and republished. Paul is introduced as Gilberto's assistant. Rigid quick-reply menus and instructions to rewrite voice notes as text were removed. **The published greeting does not invite audio yet.**

## Proposed server implementation in this branch

- Zernio and direct Meta message normalizers preserve recognized incoming audio attachment URLs.
- Authorized, signed webhooks queue encrypted event references and acknowledge promptly. A worker downloads only HTTPS Meta CDN media from allowlisted domains with bounded size/timeouts, then transcribes via direct OpenAI `gpt-transcribe` or Vercel AI Gateway `xai/grok-stt` (no separate OpenAI API key needed when OIDC is authorized).
- The transcript replaces the inbound message text *before* rules, safety checks and topic routing. Short-lived signed CDN URLs are stored encrypted only until a successful transcription; success overwrites them with transcript text.
- With explicit per-flow `assistant_mode: "paul_en"`, and server enablement, Paul answers what the person said in natural English using a remote language model, including transcribed audio; safety, personal-contact, order support and STOP paths remain deterministic.
- If voice transcription is disabled, audio is not passed to a canned reply as if it had been understood.
- Duplicate deliveries already saved in `automation_events` avoid repeated transcription.

## Production preconditions

1. Verify the correct Vercel project/team can use AI Gateway with runtime OIDC. Set `AI_GATEWAY_ENABLED=true` only when the Gateway is provisioned and has spending limits; alternatively provide `OPENAI_API_KEY` **only in server-side environment variables**. Do not paste credentials into the FlowNexa graph, GitHub or chat.
2. Review consent/privacy disclosure for customer voice recordings processed by the speech and language service.
3. Set `VOICE_TRANSCRIPTION_ENABLED=true` and `PAUL_ASSISTANT_ENABLED=true` only after audio-to-transcript-and-reply E2E testing is successful.
4. Assign `assistant_mode: "paul_en"` only to the Direct/story automation and republish after code deployment. Comment automation remains scripted.
5. Test with *real* English Instagram voice notes in the connected account, verify transcript accuracy and the actual outgoing reply. Check error paths, Meta's allowed reply window, signed URL expiry, opt-out, account connection and duplicates.
6. Invite voice notes in the welcome message **only after** step 5 succeeds.

## Validation so far

Automated tests exercise both inbound audio schemas, allowlisting, successful mocked transcription, disabled mode and conversational English responses. All repository tests pass with dependencies installed. These are local tests, **not a live Instagram/audio-provider end-to-end test**.

## Operational limitations

Signed CDN media URLs expire. Events are encrypted and queued before audio retrieval; webhook processing is scheduled with the platform's deferred execution context. Measure queue latency, CDN expiry, Vercel function execution limits and AI Gateway account availability with real voice notes before enabling. A failed transcription or response must not fabricate an understanding of the recording. Apply a bounded spending limit in AI Gateway.

If a user directly asks whether Paul is automated, answer truthfully. Paul must not pretend to be Gilberto or a human employee.

## Zero-cost Cloudflare Workers AI integration (October 22, 2026)

The dedicated zero-billing provider is Cloudflare Workers AI. Both operations are now implemented via authenticated server-side Cloudflare API REST calls:

- Speech to text: `@cf/openai/whisper`, binary input and `result.text` output.
- Paul contextual English response: `@cf/meta/llama-3.1-8b-instruct-fp8`, chat messages input and `result.response` output.
- Server-only feature configuration (set **only** on the app server, never in client-side flows):
  - `CLOUDFLARE_AI_ONLY=true` (critical fail-closed guard: **never** use existing OpenAI or Vercel AI Gateway credentials)
  - `CLOUDFLARE_AI_ENABLED=true`
  - `CLOUDFLARE_AI_ACCOUNT_ID=<Cloudflare account ID>`
  - `CLOUDFLARE_AI_TOKEN=<Workers AI scoped API token>`
  - `VOICE_TRANSCRIPTION_ENABLED=true` and `PAUL_ASSISTANT_ENABLED=true`
- Cloudflare Workers AI Free plan includes 10,000 neurons a day, and fails further inference requests once the free allocation is spent. **Do not upgrade the Cloudflare account or enable paid AI billing.** The application never silently falls back to other providers when `CLOUDFLARE_AI_ONLY=true`. Test this limit by simulating HTTP 429 errors before shipping.
- No additional Cloudflare Worker deployment is required: the existing FlowNexa server uses Workers AI REST API directly. A Cloudflare Worker would be an optional future architecture change, not a prerequisite.
- Missing in live production until verified: secure token provision, published flow `assistant_mode: paul_en`, team `flownexa3` Vercel permission, the enabled feature flags, and a **real** authenticated Instagram voice-message-to-reply test. Do not claim the feature is live until all these complete.
- Production safeguards: privacy disclosure, signed attachment handling, audio expiry and processing latency, maximum message age, free plan only, no paid credential fallback, and no hallucinated answers to unintelligible recordings.
