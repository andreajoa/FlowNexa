# NexaCloud FlowNexa staging

This isolated branch deploys a read-only Cloudflare Worker to nexacloud-flownexa-staging.
It uses the existing, empty flownexa-migration-staging D1 database, not production.
The application blocks mutations, webhooks, billing, Meta callbacks, and queue writes.
Production FlowNexa remains on its original domain. This branch is not merged to main.
The public staging app is excluded from search indexing.
