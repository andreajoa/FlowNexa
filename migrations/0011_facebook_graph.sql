-- Facebook conversation graphs (additive). Mirrors FACEBOOK_GRAPH_SCHEMA in src/facebook-schema.js.
ALTER TABLE facebook_flows ADD COLUMN graph TEXT;
CREATE TABLE IF NOT EXISTS facebook_sessions(account_id TEXT NOT NULL REFERENCES facebook_accounts(id) ON DELETE CASCADE,recipient_hash TEXT NOT NULL,flow_id TEXT NOT NULL REFERENCES facebook_flows(id) ON DELETE CASCADE,flow_version INTEGER NOT NULL,node_id TEXT NOT NULL,expires_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(account_id,recipient_hash));
