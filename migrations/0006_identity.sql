ALTER TABLE users ADD COLUMN email_verified_at INTEGER;
CREATE TABLE auth_tokens (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,purpose TEXT NOT NULL CHECK(purpose IN ('verify_email','reset_password')),expires_at INTEGER NOT NULL,consumed_at INTEGER,created_at INTEGER NOT NULL);
CREATE INDEX idx_auth_tokens_user ON auth_tokens(user_id,purpose);
CREATE INDEX idx_auth_tokens_expiry ON auth_tokens(expires_at);
CREATE TABLE auth_rate_limits (key_hash TEXT PRIMARY KEY,window_start INTEGER NOT NULL,attempts INTEGER NOT NULL);
