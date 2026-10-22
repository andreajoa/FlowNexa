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
