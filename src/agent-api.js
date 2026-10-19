import {accountUsable} from './zernio-client.js';
import {respond as J, sha, nowSeconds, getSessionUser, requireMembership, payload, sameOrigin} from './identity.js';
import {validateGraph} from './conversation-graph.js';
import {validateFlow} from './flow-runtime.js';
import {billingAccess, ownerExempt, workspacePlan, messageUsage} from './billing.js';
import {importInstagramGraph, setFacebookFlowEnabled} from './facebook-api.js';
import {facebookEnabled} from './facebook-schema.js';
import {messagingReady} from './meta-client.js';

const editors = ['owner', 'admin'];

let tableInitialized = false;
async function ensureAgentTokensTable(db) {
 if (tableInitialized || !db) return;
 try {
  await db.prepare(
   'CREATE TABLE IF NOT EXISTS workspace_api_tokens (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, name TEXT NOT NULL, token_hash TEXT NOT NULL UNIQUE, token_prefix TEXT NOT NULL, scopes TEXT NOT NULL DEFAULT "flows:read,flows:write,flows:publish", created_at INTEGER NOT NULL, last_used_at INTEGER, revoked_at INTEGER)'
  ).run();
  tableInitialized = true;
 } catch {}
}

export async function authenticateAgent(request, env) {
 const auth = request.headers.get('authorization') || '';
 if (!auth.startsWith('Bearer fnx_') && !auth.startsWith('Bearer fnx_agent_')) return null;
 const rawToken = auth.slice(7).trim();
 if (rawToken.length < 24 || rawToken.length > 128) return null;
 await ensureAgentTokensTable(env.DB);
 const tokenHash = await sha(rawToken);
 const row = await env.DB.prepare(
  'SELECT id, workspace_id, name, scopes, created_at, last_used_at, revoked_at FROM workspace_api_tokens WHERE token_hash = ? AND revoked_at IS NULL'
 ).bind(tokenHash).first();
 if (!row) return null;
 const now = nowSeconds();
 env.DB.prepare('UPDATE workspace_api_tokens SET last_used_at = ? WHERE id = ?').bind(now, row.id).run().catch(() => {});
 return {
  id: row.id,
  workspaceId: row.workspace_id,
  name: row.name,
  scopes: (row.scopes || '').split(',').map(s => s.trim()),
  createdAt: row.created_at
 };
}

export async function agentTokensApi(request, env) {
 if (!env.DB) return J({error: 'database_unavailable'}, 503);
 await ensureAgentTokensTable(env.DB);
 if (request.method !== 'GET' && !sameOrigin(request)) return J({error: 'invalid_origin'}, 403);
 const user = await getSessionUser(request, env);
 if (!user) return J({error: 'unauthorized'}, 401);
 const url = new URL(request.url), path = url.pathname;

 if (path === '/api/agent-tokens' && request.method === 'GET') {
  const workspace = url.searchParams.get('workspace');
  if (!await requireMembership(env.DB, user.id, workspace, editors)) return J({error: 'forbidden'}, 403);
  const rows = await env.DB.prepare(
   'SELECT id, workspace_id, name, token_prefix, scopes, created_at, last_used_at, revoked_at FROM workspace_api_tokens WHERE workspace_id = ? ORDER BY created_at DESC'
  ).bind(workspace).all();
  return J({tokens: rows.results});
 }

 if (path === '/api/agent-tokens' && request.method === 'POST') {
  const b = await payload(request, 8000);
  if (!await requireMembership(env.DB, user.id, b.workspace_id, editors)) return J({error: 'forbidden'}, 403);
  const name = typeof b.name === 'string' ? b.name.trim().slice(0, 100) : 'Claude Code';
  if (!name) return J({error: 'invalid_name'}, 400);

  const entropy = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const rawToken = 'fnx_agent_' + entropy;
  const tokenHash = await sha(rawToken);
  const tokenPrefix = rawToken.slice(0, 16) + '...';
  const id = crypto.randomUUID();
  const now = nowSeconds();
  const scopes = 'flows:read,flows:write,flows:publish';

  await env.DB.prepare(
   'INSERT INTO workspace_api_tokens (id, workspace_id, name, token_hash, token_prefix, scopes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).bind(id, b.workspace_id, name, tokenHash, tokenPrefix, scopes, now).run();

  await env.DB.prepare(
   'INSERT INTO runtime_audit (id, workspace_id, actor_id, action, resource_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), b.workspace_id, 'user:' + user.id, 'create_agent_token', id, now).run().catch(() => {});

  return J({
   ok: true,
   token: rawToken,
   token_prefix: tokenPrefix,
   id,
   name,
   scopes,
   created_at: now
  }, 201);
 }

 const revokeMatch = path.match(/^\/api\/agent-tokens\/([^/]+)\/revoke$/);
 if (revokeMatch && request.method === 'POST') {
  const tokenId = revokeMatch[1];
  const b = await payload(request, 4000);
  if (!await requireMembership(env.DB, user.id, b.workspace_id, editors)) return J({error: 'forbidden'}, 403);
  const now = nowSeconds();
  const res = await env.DB.prepare(
   'UPDATE workspace_api_tokens SET revoked_at = ? WHERE id = ? AND workspace_id = ? AND revoked_at IS NULL'
  ).bind(now, tokenId, b.workspace_id).run();
  if (!res.meta?.changes) return J({error: 'token_not_found_or_revoked'}, 404);

  await env.DB.prepare(
   'INSERT INTO runtime_audit (id, workspace_id, actor_id, action, resource_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), b.workspace_id, 'user:' + user.id, 'revoke_agent_token', tokenId, now).run().catch(() => {});

  return J({ok: true, revoked_at: now});
 }

 return J({error: 'not_found'}, 404);
}

export async function agentRuntimeApi(request, env) {
 if (!env.DB) return J({error: 'database_unavailable'}, 503);
 const agent = await authenticateAgent(request, env);
 if (!agent) return J({error: 'unauthorized_agent_token'}, 401);

 const url = new URL(request.url), path = url.pathname;

 if (path === '/api/v1/agent/validate' && request.method === 'POST') {
  const b = await payload(request, 64000);
  const graph = b.graph ?? b;
  const validation = validateGraph(graph);
  return J({valid: validation.ok, error: validation.error || null, node_count: graph?.nodes?.length || 0});
 }

 if (path === '/api/v1/agent/templates' && request.method === 'GET') {
  return J({
   limits: {
    max_nodes: 30,
    min_nodes: 2,
    max_button_text_length: 80,
    max_message_text_length: 1000,
    max_buttons: 3,
    max_quick_replies: 13,
    max_wait_seconds: 259200
   },
   node_types: ['message', 'buttons', 'image', 'video', 'wait_reply', 'condition', 'switch', 'delay', 'end'],
   examples: {
    message: {id: 'msg_welcome', type: 'message', text: 'Olá! Como posso ajudar?', next: 'wait_reply'},
    buttons: {id: 'msg_options', type: 'buttons', text: 'Escolha uma opção:', buttons: [{type: 'web_url', title: 'Acessar Site', url: 'https://example.com'}], next: 'end'},
    wait_reply: {id: 'wait_reply', type: 'wait_reply', timeout_seconds: 86400, on_reply: 'cond_check', on_timeout: 'timeout_msg'},
    condition: {id: 'cond_check', type: 'condition', operator: 'contains', value: 'SIM', yes: 'plan_msg', no: 'other_msg'},
    end: {id: 'end', type: 'end'}
   }
  });
 }

 // Facebook Page flows for the token workspace: list, import an Instagram graph as a draft, publish/pause.
 if (path.startsWith('/api/v1/agent/facebook/')) {
  if (!facebookEnabled(env, agent.workspaceId)) return J({error: 'facebook_not_available'}, 404);
  try {
   if (path === '/api/v1/agent/facebook/flows' && request.method === 'GET') {
    if (!agent.scopes.includes('flows:read') && !agent.scopes.includes('flows:all')) return J({error: 'insufficient_scope'}, 403);
    const pages = (await env.DB.prepare('SELECT id, name, status, provider FROM facebook_accounts WHERE workspace_id = ?').bind(agent.workspaceId).all()).results;
    const flows = (await env.DB.prepare('SELECT id, account_id, name, trigger_type, response_kind, enabled, version, graph FROM facebook_flows WHERE workspace_id = ? ORDER BY created_at DESC').bind(agent.workspaceId).all()).results.map(f => ({...f, enabled: Boolean(f.enabled), graph: undefined, node_count: f.graph ? JSON.parse(f.graph).nodes.length : 0}));
    return J({pages, flows});
   }
   if (path === '/api/v1/agent/facebook/import' && request.method === 'POST') {
    if (!agent.scopes.includes('flows:write') && !agent.scopes.includes('flows:all')) return J({error: 'insufficient_scope'}, 403);
    if (!await billingAccess(env, agent.workspaceId)) return J({error: 'billing_subscription_required'}, 402);
    return J({flow: await importInstagramGraph(env, agent.workspaceId, await payload(request, 8000))});
   }
   const publish = path.match(/^\/api\/v1\/agent\/facebook\/flows\/([^/]+)\/publish$/);
   if (publish && request.method === 'POST') {
    if (!agent.scopes.includes('flows:publish') && !agent.scopes.includes('flows:all')) return J({error: 'insufficient_scope'}, 403);
    const b = await payload(request, 2000);
    if (b.enabled && !await billingAccess(env, agent.workspaceId)) return J({error: 'billing_subscription_required'}, 402);
    return J({flow: await setFacebookFlowEnabled(env, agent.workspaceId, publish[1], b.enabled === true)});
   }
  } catch (e) { return J({error: e.status ? e.message : 'facebook_request_failed'}, e.status || 502); }
  return J({error: 'not_found'}, 404);
 }

 // Read-only reporting for owners' agents: accounts, plan access, volume and outcomes.
 if (path === '/api/v1/agent/overview' && request.method === 'GET') {
  if (!agent.scopes.includes('flows:read') && !agent.scopes.includes('flows:all')) return J({error: 'insufficient_scope'}, 403);
  const ws = agent.workspaceId, now = Date.now(), day = 86400000;
  const since = days => [now - days * day, Math.floor((now - days * day) / 1000)];
  const safe = async (query, ...binds) => { try { return (await env.DB.prepare(query).bind(...binds).all()).results; } catch { return []; } };
  const workspace = await env.DB.prepare('SELECT id, name, created_at FROM workspaces WHERE id = ?').bind(ws).first();
  const instagram = await safe('SELECT id, username, status, token_expires_at, created_at FROM instagram_accounts WHERE workspace_id = ? ORDER BY created_at', ws);
  const facebook = await safe('SELECT id, name, status, created_at FROM facebook_accounts WHERE workspace_id = ? ORDER BY created_at', ws);
  const flows = await safe('SELECT enabled, count(*) AS total FROM flows WHERE workspace_id = ? GROUP BY enabled', ws);
  const window = async days => {
   const [ms, sec] = since(days);
   const jobs = await safe('SELECT status, error, count(*) AS total FROM automation_jobs WHERE workspace_id = ? AND COALESCE(completed_at, attempt_at, 0) >= CASE WHEN COALESCE(completed_at, attempt_at, 0) > 100000000000 THEN ? ELSE ? END GROUP BY status, error ORDER BY total DESC', ws, ms, sec);
   const events = await safe('SELECT status, count(*) AS total FROM automation_events WHERE workspace_id = ? AND received_at >= CASE WHEN received_at > 100000000000 THEN ? ELSE ? END GROUP BY status', ws, ms, sec);
   const conversations = await safe('SELECT status, count(*) AS total FROM conversation_sessions WHERE workspace_id = ? AND created_at >= CASE WHEN created_at > 100000000000 THEN ? ELSE ? END GROUP BY status', ws, ms, sec);
   return {events_received: events, messages: jobs, conversations};
  };
  const plan = await workspacePlan(env, ws);
  let usage = null; try { usage = await messageUsage(env, ws); } catch {}
  return J({
   workspace,
   accounts: {instagram, facebook},
   flows: {published: flows.find(f => f.enabled)?.total || 0, drafts: flows.find(f => !f.enabled)?.total || 0},
   access: {active: await billingAccess(env, ws), owner: await ownerExempt(env, ws), plan: plan ? {id: plan.id, accounts: plan.accounts, messages: plan.messages} : null, messaging_ready: messagingReady(env)},
   usage_this_month: usage,
   last_7_days: await window(7),
   last_30_days: await window(30)
  });
 }

 if (path === '/api/v1/agent/activity' && request.method === 'GET') {
  if (!agent.scopes.includes('flows:read') && !agent.scopes.includes('flows:all')) return J({error: 'insufficient_scope'}, 403);
  const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 50, 1), 200), status = url.searchParams.get('status');
  const filter = status && /^[a-z_]{1,30}$/.test(status) ? ' AND j.status = ?' : '';
  const binds = [agent.workspaceId, ...(filter ? [status] : []), limit];
  const rows = await env.DB.prepare('SELECT j.id, j.flow_id, f.name AS flow_name, j.flow_version, j.action_type, j.status, j.error, j.provider_id, j.attempt_at, j.completed_at, a.username AS account FROM automation_jobs j JOIN flows f ON f.id = j.flow_id LEFT JOIN instagram_accounts a ON a.id = j.account_id WHERE j.workspace_id = ?' + filter + ' ORDER BY j.rowid DESC LIMIT ?').bind(...binds).all();
  return J({activity: rows.results});
 }

 if (path === '/api/v1/agent/flows' && request.method === 'GET') {
  if (!agent.scopes.includes('flows:read') && !agent.scopes.includes('flows:all')) return J({error: 'insufficient_scope'}, 403);
  const rows = await env.DB.prepare(
   'SELECT id, workspace_id, account_id, name, trigger_type, scope, enabled, version, configuration, created_at FROM flows WHERE workspace_id = ? ORDER BY created_at DESC'
  ).bind(agent.workspaceId).all();
  const flows = rows.results.map(f => {
   let nodeCount = 0;
   try {
    const parsed = JSON.parse(f.configuration);
    nodeCount = parsed?.graph?.nodes?.length || 0;
   } catch {}
   return {
    id: f.id,
    workspace_id: f.workspace_id,
    account_id: f.account_id,
    name: f.name,
    trigger_type: f.trigger_type,
    scope: f.scope,
    enabled: Boolean(f.enabled),
    version: f.version,
    node_count: nodeCount,
    created_at: f.created_at
   };
  });
  return J({flows});
 }

 const flowDetailMatch = path.match(/^\/api\/v1\/agent\/flows\/([^/]+)$/);
 if (flowDetailMatch && request.method === 'GET') {
  if (!agent.scopes.includes('flows:read') && !agent.scopes.includes('flows:all')) return J({error: 'insufficient_scope'}, 403);
  const flow = await env.DB.prepare(
   'SELECT * FROM flows WHERE id = ? AND workspace_id = ?'
  ).bind(flowDetailMatch[1], agent.workspaceId).first();
  if (!flow) return J({error: 'flow_not_found'}, 404);
  let config = {};
  try { config = JSON.parse(flow.configuration); } catch {}
  return J({
   flow: {
    id: flow.id,
    workspace_id: flow.workspace_id,
    account_id: flow.account_id,
    name: flow.name,
    trigger_type: flow.trigger_type,
    scope: flow.scope,
    enabled: Boolean(flow.enabled),
    version: flow.version,
    graph: config.graph || null,
    configuration: config,
    created_at: flow.created_at
   }
  });
 }

 const graphUpdateMatch = path.match(/^\/api\/v1\/agent\/flows\/([^/]+)\/graph$/);
 if (graphUpdateMatch && (request.method === 'PUT' || request.method === 'PATCH')) {
  if (!agent.scopes.includes('flows:write') && !agent.scopes.includes('flows:all')) return J({error: 'insufficient_scope'}, 403);
  const flow = await env.DB.prepare(
   'SELECT * FROM flows WHERE id = ? AND workspace_id = ?'
  ).bind(graphUpdateMatch[1], agent.workspaceId).first();
  if (!flow) return J({error: 'flow_not_found'}, 404);

  const b = await payload(request, 64000);
  const newGraph = b.graph || b;
  const validation = validateGraph(newGraph);
  if (!validation.ok) return J({error: 'invalid_graph', details: validation.error}, 400);

  let currentConfig = {};
  try { currentConfig = JSON.parse(flow.configuration); } catch {}
  currentConfig.graph = newGraph;

  const validFlow = validateFlow(flow.trigger_type, flow.scope, currentConfig);
  if (!validFlow.ok) return J({error: 'invalid_flow_configuration', details: validFlow.error}, 400);

  const name = typeof b.name === 'string' && b.name.trim() ? b.name.trim().slice(0, 100) : flow.name;

  await env.DB.prepare(
   'UPDATE flows SET name = ?, configuration = ?, enabled = 0, version = version + 1 WHERE id = ? AND workspace_id = ?'
  ).bind(name, JSON.stringify(currentConfig), flow.id, agent.workspaceId).run();

  const now = nowSeconds();
  await env.DB.prepare(
   'INSERT INTO runtime_audit (id, workspace_id, actor_id, action, resource_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), agent.workspaceId, 'agent:' + agent.id, 'update_graph', flow.id, now).run().catch(() => {});

  const updated = await env.DB.prepare('SELECT * FROM flows WHERE id = ?').bind(flow.id).first();
  return J({
   ok: true,
   flow: {
    id: updated.id,
    name: updated.name,
    version: updated.version,
    enabled: Boolean(updated.enabled),
    node_count: newGraph.nodes.length
   }
  });
 }

 const publishMatch = path.match(/^\/api\/v1\/agent\/flows\/([^/]+)\/publish$/);
 if (publishMatch && request.method === 'POST') {
  if (!agent.scopes.includes('flows:publish') && !agent.scopes.includes('flows:all')) return J({error: 'insufficient_scope'}, 403);
  const flow = await env.DB.prepare(
   'SELECT * FROM flows WHERE id = ? AND workspace_id = ?'
  ).bind(publishMatch[1], agent.workspaceId).first();
  if (!flow) return J({error: 'flow_not_found'}, 404);

  let b = {};
  try { b = await payload(request, 4000); } catch {}
  const targetEnabled = b.enabled === undefined ? 1 : (b.enabled ? 1 : 0);

  if (targetEnabled === 1) {
   if (!await billingAccess(env, flow.workspace_id)) return J({error: 'billing_subscription_required'}, 402);
   if (!messagingReady(env)) return J({error: 'messaging_not_configured'}, 503);
   const account = await env.DB.prepare(
    'SELECT * FROM instagram_accounts WHERE id = ?'
   ).bind(flow.account_id).first();
   if (!accountUsable(account)) {
    return J({error: 'account_reconnect_required'}, 409);
   }
   if (!messagingReady(env, account)) return J({error: 'messaging_not_configured'}, 503);
   let config = {};
   try { config = JSON.parse(flow.configuration); } catch {}
   const valid = validateFlow(flow.trigger_type, flow.scope, config);
   if (!valid.ok) return J({error: valid.error}, 400);
   if (config.graph) {
    const validGraph = validateGraph(config.graph);
    if (!validGraph.ok) return J({error: 'invalid_graph', details: validGraph.error}, 400);
   }
  }

  await env.DB.prepare(
   'UPDATE flows SET enabled = ?, version = version + 1 WHERE id = ? AND workspace_id = ?'
  ).bind(targetEnabled, flow.id, agent.workspaceId).run();

  const now = nowSeconds();
  await env.DB.prepare(
   'INSERT INTO runtime_audit (id, workspace_id, actor_id, action, resource_id, created_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).bind(crypto.randomUUID(), agent.workspaceId, 'agent:' + agent.id, targetEnabled ? 'publish_flow' : 'pause_flow', flow.id, now).run().catch(() => {});

  const updated = await env.DB.prepare('SELECT * FROM flows WHERE id = ?').bind(flow.id).first();
  return J({
   ok: true,
   flow: {
    id: updated.id,
    enabled: Boolean(updated.enabled),
    version: updated.version
   }
  });
 }

 return J({error: 'not_found'}, 404);
}
