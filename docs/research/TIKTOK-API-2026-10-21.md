# TikTok integration research — 2026-10-21

## Decision

Use the existing Zernio server integration and its TikTok for Business authorization. The customer authorizes their account through OAuth, without pasting an access token into FlowNexa. No direct TikTok developer application was provisioned or approved in this change.

Primary sources consulted:

- [TikTok inbox](https://docs.zernio.com/platforms/tiktok/inbox): Business Account eligibility for DMs, regional restrictions, inbound-first conversation, 48-hour / ten-reply policy, text and image constraints, comment support.
- [OAuth connection](https://docs.zernio.com/connect/get-connect-url): profile scope, `reconnectAccountId`, same-account reconnect, missing permission behavior. New connections use the provider's Business application.
- [Send message](https://docs.zernio.com/messages/send-inbox-message): opaque conversation IDs, account ID in body, returned message ID, idempotency key and ambiguous-delivery limitations.
- [Reply to comment](https://docs.zernio.com/comments/reply-to-inbox-post): POST `/v1/inbox/comments/{postId}`, `accountId`, `commentId`, `message`; public replies and idempotency.
- [Inbox webhooks](https://docs.zernio.com/webhooks/inbox): platform/account/profile routing, inbound vs outbound events, comment events on tracked posts, provider-plan requirements.
- [Webhook verification](https://docs.zernio.com/webhooks): HMAC authentication, durable acknowledgment and deduplication.

## Implementation boundaries

DMs require an eligible Business account accepting incoming messages. Provider documentation excludes accounts signed up in the EEA, Switzerland and UK. Comment management has different eligibility; a successful OAuth connection alone does not prove permission to send DMs.

FlowNexa implements text responses only (current common graph limit: 1,000 characters), with one response per inbound event, conditions and wait-for-reply. Comments receive public replies. Comment-to-DM, unsolicited campaigns, media messages, commerce nodes and timed reminders are not implemented for this channel.

FlowNexa conservatively counts ten outgoing attempts accepted/uncertain within a rolling 48-hour conversation period. It does not reset that counter with each incoming message. Native/manual/other-app sends are not counted locally; the provider's own enforcement remains authoritative.

Unknown outcomes are not automatically retried, even with an idempotency key: the provider documents that a failed attempt can have already reached the platform. A worker crash after reserving an effect likewise becomes unknown. Affected conversations stay blocked for the remaining local 48-hour window and require review in TikTok.

## Evidence limits

Documentation review and local tests use provider-shaped fixtures. No real TikTok customer account was authorized or messaged during this implementation. Actual OAuth callback shape, account eligibility, inbox entitlement, webhook delivery and acceptance by TikTok still require a live authorized account test. Automated local success is not live platform homologation.
