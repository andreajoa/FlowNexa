-- Direct Meta Facebook connections (additive). Mirrors FACEBOOK_META_SCHEMA in src/facebook-schema.js.
ALTER TABLE facebook_accounts ADD COLUMN provider TEXT NOT NULL DEFAULT 'zernio';
ALTER TABLE facebook_accounts ADD COLUMN encrypted_token TEXT;
CREATE TABLE IF NOT EXISTS facebook_meta_pending(user_id TEXT NOT NULL,workspace_id TEXT NOT NULL,encrypted_pages TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(user_id,workspace_id));
ALTER TABLE facebook_accounts ADD COLUMN encrypted_app_secret TEXT;
