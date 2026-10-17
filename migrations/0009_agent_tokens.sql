CREATE TABLE IF NOT EXISTS workspace_api_tokens (
 id TEXT PRIMARY KEY,
 workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
 name TEXT NOT NULL,
 token_hash TEXT NOT NULL UNIQUE,
 token_prefix TEXT NOT NULL,
 scopes TEXT NOT NULL DEFAULT 'flows:read,flows:write,flows:publish',
 created_at INTEGER NOT NULL,
 last_used_at INTEGER,
 revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_workspace_api_tokens_hash ON workspace_api_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_workspace_api_tokens_ws ON workspace_api_tokens(workspace_id, revoked_at);
