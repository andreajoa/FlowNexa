CREATE TABLE workspace_billing (
 workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
 stripe_customer_id TEXT UNIQUE,
 stripe_subscription_id TEXT UNIQUE,
 subscription_status TEXT,
 stripe_price_id TEXT,
 current_period_end INTEGER,
 cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
 last_event_created INTEGER NOT NULL DEFAULT 0,
 checkout_request_id TEXT,
 checkout_session_id TEXT,
 checkout_price_id TEXT,
 lease_id TEXT,
 lease_until INTEGER,
 updated_at INTEGER NOT NULL
);
CREATE TABLE stripe_webhook_events (
 id TEXT PRIMARY KEY,
 payload_hash TEXT NOT NULL,
 type TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','processed')),
 lease_id TEXT,
 lease_until INTEGER,
 processed_at INTEGER
);
