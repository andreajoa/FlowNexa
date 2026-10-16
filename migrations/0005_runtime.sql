CREATE TABLE IF NOT EXISTS automation_events (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 encrypted_event TEXT NOT NULL,
 received_at INTEGER NOT NULL,
 event_at INTEGER NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 due_at INTEGER NOT NULL,
 lease_until INTEGER,
 lease_id TEXT,
 attempts INTEGER NOT NULL DEFAULT 0,
 error TEXT
);
CREATE INDEX IF NOT EXISTS idx_automation_events_due ON automation_events(status,due_at);
CREATE TABLE IF NOT EXISTS automation_jobs (
 id TEXT PRIMARY KEY,
 event_id TEXT NOT NULL REFERENCES automation_events(id) ON DELETE CASCADE,
 account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
 flow_version INTEGER NOT NULL,
 action_index INTEGER NOT NULL,
 action_type TEXT NOT NULL,
 effect_key TEXT NOT NULL UNIQUE,
 encrypted_action TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 provider_id TEXT,
 attempt_at INTEGER,
 completed_at INTEGER,
 error TEXT,
 UNIQUE(event_id,action_index)
);
CREATE TABLE IF NOT EXISTS automation_contacts (
 account_id TEXT NOT NULL,
 flow_id TEXT NOT NULL,
 recipient_hash TEXT NOT NULL,
 event_id TEXT NOT NULL,
 PRIMARY KEY(account_id,flow_id,recipient_hash)
);
CREATE TABLE IF NOT EXISTS runtime_audit (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL,
 actor_id TEXT,
 action TEXT NOT NULL,
 resource_id TEXT,
 created_at INTEGER NOT NULL
);
