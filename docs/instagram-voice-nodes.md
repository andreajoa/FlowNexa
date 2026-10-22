# Instagram audio nodes for every FlowNexa workspace

## Use in the native graph editor or through connected Claude Code/Codex agents

Add **Transcrever áudio** (`transcribe_audio`) and connect it to **Resposta com IA** (`ai_reply`) or to a condition/switch/message. The system transcribes a supported inbound Instagram Direct/story voice note with Cloudflare Whisper BEFORE routing the event into the graph. The recognized words become `event.text` and never become a public account-crossing response. Typed messages follow the same route. The `transcribe_audio` node can be a graph entry point. For a conversational assistant, enable DM/story entry points and `reply_per_message: true`, then publish the flow. Only a **published graph with the node** (or a previously enabled `paul_en` flow) authorizes inbound audio recognition.

Add **Resposta com IA** (`ai_reply`) to generate contextual text using **only** that workspace's node instructions and the incoming text/transcript. An unavailable AI service fails closed; the app must not pretend to have understood an audio it did not understand. The existing Gilberto-specific Paul mode and published flows stay untouched.

Add **Áudio (arquivo)** (`audio`) to send a pre-recorded audio attachment to a user who messaged that Instagram account, with a public HTTPS media URL to an MP3/M4A/OGG/WAV file. The platform's delivery rules still apply, including the 24-hour response window. Instagram may render it as a regular audio attachment rather than a recorded voice bubble. Supported via Zernio attachmentType=audio and native Meta attachment type=audio. No third-party audio-upload service or text-to-speech cost is silently enabled.

## Cost and security guarantees

The features reuse the account-wide Cloudflare Workers AI configuration, not customers' Claude Code or Codex subscriptions or model API keys. `CLOUDFLARE_AI_ONLY=true` is REQUIRED for generic `ai_reply`; this prevents use of OpenAI/Vercel fallback. A Free plan provides 10,000 neurons per UTC day; Cloudflare blocks further inference after exhaustion. **A Workers Paid plan can incur usage charges, so do not upgrade.** New Workspaces share the free allowance, hence conservative initial quotas of 20 audio transcriptions and 40 contextual replies per workspace/UTC day, capped globally at 150 transcriptions and 250 contextual replies. Counters use atomic per-workspace and global rows in the existing auth_rate_limits D1 table, no migration. Failed requests count toward allocation. All tenants' AI instructions are contained in their own graph nodes. Sender signed media links remain encrypted until used, and are removed when a transcript is stored.

Voice synthesis (TTS) is not part of this release. Cloudflare offers `@cf/myshell-ai/melotts` for TTS, but sending auto-generated sound also needs media hosting/upload, lifetime and size policy, additional quota protection, media verification and an end-to-end Instagram delivery test. Do not promise spoken replies from the new **Áudio (arquivo)** node; it sends **pre-existing** audio files only.

## Node shapes

```json
{
  "version": 1,
  "start": "voice",
  "nodes": [
    {"id": "voice", "type": "transcribe_audio", "next": "respond"},
    {"id": "respond", "type": "ai_reply", "instructions": "You are the online bakery assistant. Respond in Portuguese and never invent prices.", "next": "end"},
    {"id": "end", "type": "end"}
  ]
}
```

An outbound attachment can replace or follow a message or AI reply: `{ "id":"send_recording", "type":"audio", "url":"https://example.com/recording.mp3", "next":"end" }`.

## Test scope

Automated tests cover validated graph shapes and UI preview, cross-workspace instruction isolation, simulated live Meta voice webhook -> encrypted event -> Cloudflare mock transcription -> tenant-specific AI reply -> message sender, quota exhaustion, and outbound Zernio audio attachment serialization. Tests **do not** prove that every third-party Instagram account will accept any particular file format or that a synthesized voice bubble will be rendered. Keep the existing flows unchanged; new nodes are opt-in on individually published graphs.
