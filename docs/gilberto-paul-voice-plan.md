# Gilberto Rebuild | Paul, voice notes and natural English replies

## Published live copy, October 22, 2026

Both saved Instagram automations were updated through the authenticated FlowNexa account and republished. Paul is introduced as Gilberto's assistant. Rigid quick-reply menus and instructions to rewrite voice notes as text were removed. **The published greeting does not invite audio yet.**

## Proposed server implementation in this branch

- Zernio and direct Meta message normalizers preserve recognized incoming audio attachment URLs.
- Authorized, signed webhook ingestion downloads only HTTPS CDN media from allowlisted Meta media domains, with bounded size and timeouts, and requests a transcription using `gpt-transcribe`.
- The transcript replaces the inbound message text *before* rules, safety checks and topic routing. Raw signed CDN URLs are not stored with successful events.
- With explicit per-flow `assistant_mode: "paul_en"`, and server enablement, Paul answers what the person said in natural English using a remote language model, including transcribed audio; safety, personal-contact, order support and STOP paths remain deterministic.
- If voice transcription is disabled, audio is not passed to a canned reply as if it had been understood.
- Duplicate deliveries already saved in `automation_events` avoid repeated transcription.

## Production preconditions

1. Provide the `OPENAI_API_KEY` secret **only in Vercel server-side Environment Variables**, not in Instagram flows, GitHub, chat messages or browser code.
2. Review consent/privacy disclosure for customer voice recordings processed by the speech and language service.
3. Set `VOICE_TRANSCRIPTION_ENABLED=true` and `PAUL_ASSISTANT_ENABLED=true` only after audio-to-transcript-and-reply E2E testing is successful.
4. Assign `assistant_mode: "paul_en"` only to the Direct/story automation and republish after code deployment. Comment automation remains scripted.
5. Test with *real* English Instagram voice notes in the connected account, verify transcript accuracy and the actual outgoing reply. Check error paths, Meta's allowed reply window, signed URL expiry, opt-out, account connection and duplicates.
6. Invite voice notes in the welcome message **only after** step 5 succeeds.

## Validation so far

Automated tests exercise both inbound audio schemas, allowlisting, successful mocked transcription, disabled mode and conversational English responses. All repository tests pass with dependencies installed. These are local tests, **not a live Instagram/audio-provider end-to-end test**.

## Operational limitations

The signed media URL expires, and the prototype downloads/transcribes synchronously during webhook ingestion. Production must measure the provider's webhook acknowledgement deadline under real voice-note sizes. If that deadline is shorter than the network round trip, use durable short-lived audio storage plus queued transcription before enabling voice-note invitations.

If a user directly asks whether Paul is automated, answer truthfully. Paul must not pretend to be Gilberto or a human employee.
