CREATE TABLE conversation_sessions (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 flow_id TEXT NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
 flow_version INTEGER NOT NULL,
 recipient_hash TEXT NOT NULL,
 origin_event_id TEXT NOT NULL UNIQUE REFERENCES automation_events(id) ON DELETE CASCADE,
 encrypted_state TEXT NOT NULL,
 node_id TEXT NOT NULL,
 step_index INTEGER NOT NULL DEFAULT 0,
 status TEXT NOT NULL DEFAULT 'running',
 due_at INTEGER NOT NULL,
 lease_id TEXT,
 lease_until INTEGER,
 retry_count INTEGER NOT NULL DEFAULT 0,
 error TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX idx_conversation_active_contact ON conversation_sessions(account_id,recipient_hash) WHERE status IN ('running','waiting_reply','delayed');
CREATE INDEX idx_conversation_due ON conversation_sessions(status,due_at);
CREATE TABLE conversation_inbound (
 event_id TEXT PRIMARY KEY REFERENCES automation_events(id) ON DELETE CASCADE,
 conversation_id TEXT NOT NULL REFERENCES conversation_sessions(id) ON DELETE CASCADE,
 received_at INTEGER NOT NULL
);
