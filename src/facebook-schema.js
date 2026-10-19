import {billingAccess} from './billing.js';
export const FACEBOOK_SCHEMA=[
 "-- Additive Facebook pilot storage. No Instagram table or identity is changed.\nCREATE TABLE IF NOT EXISTS facebook_profiles(workspace_id TEXT PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,profile_id TEXT NOT NULL UNIQUE)",
 "CREATE TABLE IF NOT EXISTS facebook_oauth_states(state_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,workspace_id TEXT NOT NULL,profile_id TEXT NOT NULL,reconnect_id TEXT,expires_at INTEGER NOT NULL)",
 "CREATE TABLE IF NOT EXISTS facebook_accounts(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,remote_id TEXT NOT NULL UNIQUE,profile_id TEXT NOT NULL,native_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'connected',created_at INTEGER NOT NULL)",
 "CREATE INDEX IF NOT EXISTS idx_facebook_accounts_workspace ON facebook_accounts(workspace_id)",
 "CREATE TABLE IF NOT EXISTS facebook_flows(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,account_id TEXT NOT NULL REFERENCES facebook_accounts(id) ON DELETE CASCADE,name TEXT NOT NULL,trigger_type TEXT NOT NULL,keywords TEXT NOT NULL DEFAULT '[]',response_kind TEXT NOT NULL,response_text TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1,published_at INTEGER,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)",
 "CREATE INDEX IF NOT EXISTS idx_facebook_flows_account ON facebook_flows(account_id,enabled)",
 "CREATE TABLE IF NOT EXISTS facebook_events(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL,account_id TEXT NOT NULL REFERENCES facebook_accounts(id) ON DELETE CASCADE,encrypted_event TEXT NOT NULL,event_at INTEGER NOT NULL,received_at INTEGER NOT NULL)",
 "CREATE TABLE IF NOT EXISTS facebook_jobs(id TEXT PRIMARY KEY,event_id TEXT NOT NULL UNIQUE REFERENCES facebook_events(id) ON DELETE CASCADE,workspace_id TEXT NOT NULL,account_id TEXT NOT NULL REFERENCES facebook_accounts(id) ON DELETE CASCADE,flow_id TEXT NOT NULL REFERENCES facebook_flows(id) ON DELETE CASCADE,flow_version INTEGER NOT NULL,encrypted_action TEXT NOT NULL,recipient_hash TEXT,conversation_hash TEXT,status TEXT NOT NULL DEFAULT 'pending',due_at INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,lease_id TEXT,lease_until INTEGER,attempt_at INTEGER,completed_at INTEGER,provider_id TEXT,error TEXT)",
 "CREATE INDEX IF NOT EXISTS idx_facebook_jobs_due ON facebook_jobs(status,due_at)",
 "CREATE TABLE IF NOT EXISTS facebook_contacts(account_id TEXT NOT NULL REFERENCES facebook_accounts(id) ON DELETE CASCADE,recipient_hash TEXT NOT NULL,opted_out INTEGER NOT NULL DEFAULT 0,last_incoming_at INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(account_id,recipient_hash))",
 "CREATE TABLE IF NOT EXISTS facebook_effects(effect_key TEXT PRIMARY KEY,job_id TEXT NOT NULL UNIQUE,status TEXT NOT NULL DEFAULT 'reserved')",
 "CREATE INDEX IF NOT EXISTS idx_facebook_jobs_recipient ON facebook_jobs(account_id,recipient_hash,status)",
 "CREATE INDEX IF NOT EXISTS idx_facebook_jobs_conversation ON facebook_jobs(account_id,conversation_hash,status)",
 "CREATE UNIQUE INDEX IF NOT EXISTS idx_facebook_one_page_workspace ON facebook_accounts(workspace_id)",
 "CREATE TABLE IF NOT EXISTS facebook_threads(account_id TEXT NOT NULL REFERENCES facebook_accounts(id) ON DELETE CASCADE,conversation_hash TEXT NOT NULL,standby INTEGER NOT NULL DEFAULT 0,last_control_at INTEGER NOT NULL,PRIMARY KEY(account_id,conversation_hash))"
];
// Conversation graphs: a flow may carry a node graph, and a contact waiting on a reply keeps
// one session per Page. Additive, so pilots created before graphs keep working unchanged.
export const FACEBOOK_GRAPH_SCHEMA=[
 "ALTER TABLE facebook_flows ADD COLUMN graph TEXT",
 "CREATE TABLE IF NOT EXISTS facebook_sessions(account_id TEXT NOT NULL REFERENCES facebook_accounts(id) ON DELETE CASCADE,recipient_hash TEXT NOT NULL,flow_id TEXT NOT NULL REFERENCES facebook_flows(id) ON DELETE CASCADE,flow_version INTEGER NOT NULL,node_id TEXT NOT NULL,expires_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(account_id,recipient_hash))"
];
// Direct Meta connections: provider per Page (existing rows stay 'zernio'), its encrypted Page
// token, and the short-lived list of Pages a login returned, waiting for the owner to pick one.
export const FACEBOOK_META_SCHEMA=[
 "ALTER TABLE facebook_accounts ADD COLUMN provider TEXT NOT NULL DEFAULT 'zernio'",
 "ALTER TABLE facebook_accounts ADD COLUMN encrypted_token TEXT",
 "CREATE TABLE IF NOT EXISTS facebook_meta_pending(user_id TEXT NOT NULL,workspace_id TEXT NOT NULL,encrypted_pages TEXT NOT NULL,expires_at INTEGER NOT NULL,PRIMARY KEY(user_id,workspace_id))"
];
// FACEBOOK_PILOT_WORKSPACES lists workspaces, or '*' to open the channel to every workspace.
export function facebookEnabled(env,workspace){const list=(env.FACEBOOK_PILOT_WORKSPACES||'').split(',').map(s=>s.trim()).filter(Boolean);return env.FACEBOOK_CHANNEL_ENABLED==='true'&&typeof workspace==='string'&&!!workspace&&(list.includes('*')||list.includes(workspace));}
export function facebookSendsEnabled(env,workspace){return facebookEnabled(env,workspace)&&env.FACEBOOK_SENDS_ENABLED==='true';}
export function facebookMonthlyLimit(env){const n=Number(env.FACEBOOK_MONTHLY_MESSAGE_LIMIT||1000);return Number.isSafeInteger(n)&&n>0&&n<=10000?n:1000;}
const ready=new WeakSet();
export async function ensureFacebookSchema(env){if(!env.DB)throw Error('database_unavailable');if(ready.has(env.DB))return;try{await env.DB.prepare('SELECT 1 FROM facebook_effects LIMIT 1').first();await env.DB.prepare('SELECT 1 FROM facebook_threads LIMIT 1').first();}catch{for(const sql of FACEBOOK_SCHEMA)await env.DB.prepare(sql).run();}try{await env.DB.prepare('SELECT graph FROM facebook_flows LIMIT 1').first();await env.DB.prepare('SELECT 1 FROM facebook_sessions LIMIT 1').first();}catch{for(const sql of FACEBOOK_GRAPH_SCHEMA){try{await env.DB.prepare(sql).run();}catch(e){if(!/duplicate column/i.test(String(e?.message)))throw e;}}}try{await env.DB.prepare('SELECT provider,encrypted_token FROM facebook_accounts LIMIT 1').first();await env.DB.prepare('SELECT 1 FROM facebook_meta_pending LIMIT 1').first();}catch{for(const sql of FACEBOOK_META_SCHEMA){try{await env.DB.prepare(sql).run();}catch(e){if(!/duplicate column/i.test(String(e?.message)))throw e;}}}ready.add(env.DB);}

export async function facebookAccess(env,workspace){return facebookEnabled(env,workspace)&&await billingAccess(env,workspace);}
