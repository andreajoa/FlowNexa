CREATE TABLE IF NOT EXISTS commerce_stores (
 id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id), provider TEXT NOT NULL,
 remote_id TEXT NOT NULL, name TEXT NOT NULL, origin TEXT NOT NULL, encrypted_credentials TEXT NOT NULL,
 capabilities TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'connected', hooks_status TEXT NOT NULL DEFAULT 'not_configured',
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, UNIQUE(provider,remote_id)
);
CREATE INDEX IF NOT EXISTS idx_commerce_workspace ON commerce_stores(workspace_id,status);
CREATE TABLE IF NOT EXISTS commerce_events (
 id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES commerce_stores(id), topic TEXT NOT NULL,
 encrypted_payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
 due_at INTEGER NOT NULL, received_at INTEGER NOT NULL, error TEXT, lease_id TEXT, lease_until INTEGER
);
CREATE INDEX IF NOT EXISTS idx_commerce_events_due ON commerce_events(status,due_at);
CREATE TABLE IF NOT EXISTS commerce_identities (
 store_id TEXT NOT NULL REFERENCES commerce_stores(id), account_id TEXT NOT NULL, recipient_hash TEXT NOT NULL,
 encrypted_identity TEXT NOT NULL, email_hash TEXT NOT NULL, verified_until INTEGER NOT NULL,
 marketing_opt_in INTEGER NOT NULL DEFAULT 0, opted_out INTEGER NOT NULL DEFAULT 0, last_incoming_at INTEGER NOT NULL,
 PRIMARY KEY(store_id,account_id,recipient_hash)
);
CREATE TABLE IF NOT EXISTS commerce_challenges (
 id TEXT PRIMARY KEY, store_id TEXT NOT NULL, account_id TEXT NOT NULL, recipient_hash TEXT NOT NULL,
 encrypted_email TEXT NOT NULL, code_hash TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
 expires_at INTEGER NOT NULL, consumed_at INTEGER
);
CREATE TABLE IF NOT EXISTS commerce_rules (
 id TEXT PRIMARY KEY, store_id TEXT NOT NULL REFERENCES commerce_stores(id), workspace_id TEXT NOT NULL,
 account_id TEXT NOT NULL, event_type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
 message TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS commerce_deliveries (
 id TEXT PRIMARY KEY, event_id TEXT NOT NULL, rule_id TEXT NOT NULL REFERENCES commerce_rules(id),
 store_id TEXT NOT NULL, account_id TEXT NOT NULL, recipient_hash TEXT NOT NULL, encrypted_action TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0, due_at INTEGER NOT NULL,
 lease_id TEXT, lease_until INTEGER, attempt_at INTEGER, provider_id TEXT, error TEXT, completed_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_commerce_deliveries_due ON commerce_deliveries(status,due_at);
CREATE TABLE IF NOT EXISTS commerce_oauth_states (
 state_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, workspace_id TEXT NOT NULL, provider TEXT NOT NULL,
 shop TEXT, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS commerce_polling (
 store_id TEXT PRIMARY KEY REFERENCES commerce_stores(id), next_at INTEGER NOT NULL DEFAULT 0,
 cursor TEXT NOT NULL DEFAULT '', lease_until INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS commerce_event_cursors (
 event_id TEXT NOT NULL REFERENCES commerce_events(id) ON DELETE CASCADE,
 rule_id TEXT NOT NULL, cursor TEXT NOT NULL DEFAULT '', done INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(event_id,rule_id)
);
