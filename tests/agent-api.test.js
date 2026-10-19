import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { identityDatabase } from './identity-helper.js';
import { handleMcpRequest, FlowNexaMcpClient, MCP_TOOLS } from '../src/mcp-server.js';
import app from '../src/index.js';
import { sessionFor } from '../src/identity.js';

function setup(t) {
 const db = identityDatabase();
 for (const file of ['0005_runtime.sql', '0007_billing.sql', '0008_conversations.sql', '0009_agent_tokens.sql']) {
  db.sqlite.exec(readFileSync(new URL('../migrations/' + file, import.meta.url), 'utf8'));
 }
 t.after(() => db.close());

 db.sqlite.exec(`
  INSERT INTO users(id, email, password_hash, email_verified_at) VALUES ('u1', 'owner@example.test', 'hash', 1);
  INSERT INTO users(id, email, password_hash, email_verified_at) VALUES ('u2', 'stranger@example.test', 'hash', 1);
  INSERT INTO workspaces(id, name, owner_id) VALUES ('w1', 'Workspace One', 'u1');
  INSERT INTO workspaces(id, name, owner_id) VALUES ('w2', 'Workspace Two', 'u2');
  INSERT INTO memberships(workspace_id, user_id, role) VALUES ('w1', 'u1', 'owner');
  INSERT INTO memberships(workspace_id, user_id, role) VALUES ('w2', 'u2', 'owner');
  INSERT INTO instagram_accounts(id, workspace_id, username, ig_user_id, status, token_expires_at) VALUES ('a1', 'w1', 'brand', '100', 'connected', 2000000000);
  INSERT INTO workspace_billing(workspace_id, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_end, updated_at) VALUES ('w1', 'cus_1', 'sub_1', 'active', 2000000000, 1000000);
 `);

 const sampleGraph = {
  version: 1,
  start: 'msg_welcome',
  nodes: [
   { id: 'msg_welcome', type: 'message', text: 'Olá! Como posso ajudar?', next: 'wait_1' },
   { id: 'wait_1', type: 'wait_reply', timeout_seconds: 3600, on_reply: 'cond_1', on_timeout: 'msg_end' },
   { id: 'cond_1', type: 'condition', operator: 'contains', value: 'SIM', yes: 'msg_end', no: 'msg_end' },
   { id: 'msg_end', type: 'message', text: 'Até logo!', next: 'end' },
   { id: 'end', type: 'end' }
  ]
 };

 db.sqlite.exec(`
  INSERT INTO flows(id, workspace_id, account_id, name, trigger_type, scope, configuration, enabled, version)
  VALUES ('f1', 'w1', 'a1', 'Fluxo Principal', 'comment_any', 'all', '${JSON.stringify({ graph: sampleGraph })}', 0, 1);
 `);

 const env = {
  DB: db,
  TOKEN_ENCRYPTION_KEY: 'a'.repeat(64),
  MESSAGING_ENABLED: 'true',
  META_APP_ID: 'app',
  META_APP_SECRET: 'secret',
  META_WEBHOOK_SECRET: 'webhooksecret'
 };

 return { db, env, sampleGraph };
}

test('Agent Token lifecycle: create, list, authenticate, and revoke', async (t) => {
 const { db, env } = setup(t);
 const sessionToken = await sessionFor('u1', env);

 // 1. Create agent token via user session
 const createReq = new Request('https://app.test/api/agent-tokens', {
  method: 'POST',
  headers: {
   'content-type': 'application/json',
   'origin': 'https://app.test',
   'cookie': `fn_session=${sessionToken}`
  },
  body: JSON.stringify({ workspace_id: 'w1', name: 'Claude Code Agent' })
 });
 const createRes = await app.fetch(createReq, env);
 assert.equal(createRes.status, 201);
 const created = await createRes.json();
 assert.ok(created.token.startsWith('fnx_agent_'));
 assert.equal(created.name, 'Claude Code Agent');
 const agentToken = created.token;

 // 2. Cross-workspace access rejected
 const rogueReq = new Request('https://app.test/api/agent-tokens', {
  method: 'POST',
  headers: {
   'content-type': 'application/json',
   'origin': 'https://app.test',
   'cookie': `fn_session=${sessionToken}`
  },
  body: JSON.stringify({ workspace_id: 'w2', name: 'Hacker Agent' })
 });
 const rogueRes = await app.fetch(rogueReq, env);
 assert.equal(rogueRes.status, 403);

 // 3. List tokens returns prefix, not raw token or hash
 const listReq = new Request('https://app.test/api/agent-tokens?workspace=w1', {
  headers: {
   'origin': 'https://app.test',
   'cookie': `fn_session=${sessionToken}`
  }
 });
 const listRes = await app.fetch(listReq, env);
 assert.equal(listRes.status, 200);
 const list = await listRes.json();
 assert.equal(list.tokens.length, 1);
 assert.equal(list.tokens[0].name, 'Claude Code Agent');
 assert.ok(!list.tokens[0].token_hash);
 assert.ok(list.tokens[0].token_prefix.startsWith('fnx_agent_'));

 // 4. Agent Token accesses scoped /api/v1/agent/flows
 const agentReq = new Request('https://app.test/api/v1/agent/flows', {
  headers: {
   'authorization': `Bearer ${agentToken}`
  }
 });
 const agentRes = await app.fetch(agentReq, env);
 assert.equal(agentRes.status, 200);
 const agentFlows = await agentRes.json();
 assert.equal(agentFlows.flows.length, 1);
 assert.equal(agentFlows.flows[0].id, 'f1');
 assert.equal(agentFlows.flows[0].node_count, 5);

 // 5. Agent Token is STRICTLY BLOCKED from billing and user endpoints
 const billingReq = new Request('https://app.test/api/billing/subscription?workspace=w1', {
  headers: { 'authorization': `Bearer ${agentToken}` }
 });
 const billingRes = await app.fetch(billingReq, env);
 assert.equal(billingRes.status, 401);

 // 6. Revoke token
 const revokeReq = new Request(`https://app.test/api/agent-tokens/${created.id}/revoke`, {
  method: 'POST',
  headers: {
   'content-type': 'application/json',
   'origin': 'https://app.test',
   'cookie': `fn_session=${sessionToken}`
  },
  body: JSON.stringify({ workspace_id: 'w1' })
 });
 const revokeRes = await app.fetch(revokeReq, env);
 assert.equal(revokeRes.status, 200);

 // 7. Revoked token is rejected
 const blockedReq = new Request('https://app.test/api/v1/agent/flows', {
  headers: { 'authorization': `Bearer ${agentToken}` }
 });
 const blockedRes = await app.fetch(blockedReq, env);
 assert.equal(blockedRes.status, 401);
});

test('Agent Graph Operations: get, validate, update, and publish with DAG safety', async (t) => {
 const { db, env, sampleGraph } = setup(t);
 const sessionToken = await sessionFor('u1', env);

 // Create active agent token
 const createReq = new Request('https://app.test/api/agent-tokens', {
  method: 'POST',
  headers: {
   'content-type': 'application/json',
   'origin': 'https://app.test',
   'cookie': `fn_session=${sessionToken}`
  },
  body: JSON.stringify({ workspace_id: 'w1', name: 'Codex' })
 });
 const agentToken = (await (await app.fetch(createReq, env)).json()).token;

 // 1. Dry-run validate valid graph
 const valReq = new Request('https://app.test/api/v1/agent/validate', {
  method: 'POST',
  headers: {
   'content-type': 'application/json',
   'authorization': `Bearer ${agentToken}`
  },
  body: JSON.stringify({ graph: sampleGraph })
 });
 const valRes = await app.fetch(valReq, env);
 assert.equal(valRes.status, 200);
 const valData = await valRes.json();
 assert.equal(valData.valid, true);

 // 2. Dry-run validate cyclic graph rejected
 const cyclicGraph = {
  version: 1,
  start: 'msg_1',
  nodes: [
   { id: 'msg_1', type: 'message', text: 'A', next: 'msg_2' },
   { id: 'msg_2', type: 'message', text: 'B', next: 'msg_1' }
  ]
 };
 const cyclicReq = new Request('https://app.test/api/v1/agent/validate', {
  method: 'POST',
  headers: {
   'content-type': 'application/json',
   'authorization': `Bearer ${agentToken}`
  },
  body: JSON.stringify({ graph: cyclicGraph })
 });
 const cyclicRes = await app.fetch(cyclicReq, env);
 const cyclicData = await cyclicRes.json();
 assert.equal(cyclicData.valid, false);
 assert.equal(cyclicData.error, 'graph_cycle');

 // 3. Get flow details
 const getReq = new Request('https://app.test/api/v1/agent/flows/f1', {
  headers: { 'authorization': `Bearer ${agentToken}` }
 });
 const getRes = await app.fetch(getReq, env);
 assert.equal(getRes.status, 200);
 const flowDetails = (await getRes.json()).flow;
 assert.equal(flowDetails.id, 'f1');
 assert.equal(flowDetails.graph.nodes.length, 5);

 // 4. Update graph safely
 const updatedGraph = {
  version: 1,
  start: 'msg_welcome',
  nodes: [
   { id: 'msg_welcome', type: 'message', text: 'Nova mensagem de boas-vindas!', next: 'btn_1' },
   { id: 'btn_1', type: 'buttons', text: 'Qual o seu interesse?', buttons: [{ type: 'postback', title: 'Planos', payload: 'VER_PLANOS' }], next: 'end' },
   { id: 'end', type: 'end' }
  ]
 };
 const updateReq = new Request('https://app.test/api/v1/agent/flows/f1/graph', {
  method: 'PUT',
  headers: {
   'content-type': 'application/json',
   'authorization': `Bearer ${agentToken}`
  },
  body: JSON.stringify({ graph: updatedGraph, name: 'Fluxo Atualizado por IA' })
 });
 const updateRes = await app.fetch(updateReq, env);
 assert.equal(updateRes.status, 200);
 const updateData = await updateRes.json();
 assert.equal(updateData.ok, true);
 assert.equal(updateData.flow.name, 'Fluxo Atualizado por IA');
 assert.equal(updateData.flow.version, 2);
 assert.equal(updateData.flow.enabled, false); // Disabled until publish

 // 5. Publish flow
 const pubReq = new Request('https://app.test/api/v1/agent/flows/f1/publish', {
  method: 'POST',
  headers: {
   'content-type': 'application/json',
   'authorization': `Bearer ${agentToken}`
  },
  body: JSON.stringify({ enabled: true })
 });
 const pubRes = await app.fetch(pubReq, env);
 assert.equal(pubRes.status, 200);
 const pubData = await pubRes.json();
 assert.equal(pubData.flow.enabled, true);

 // 6. Verify audit trail was logged
 const audit = await db.prepare("SELECT * FROM runtime_audit WHERE action = 'update_graph'").all();
 assert.ok(audit.results.length >= 1);
 assert.ok(audit.results[0].actor_id.startsWith('agent:'));
});

test('MCP Protocol Handler: tools/list and tools/call integration', async (t) => {
 const { env, sampleGraph } = setup(t);

 // 1. Check tools list
 const listReq = { jsonrpc: '2.0', id: 1, method: 'tools/list' };
 const listRes = handleMcpRequest(null, listReq);
 assert.equal(listRes.result.tools.length, MCP_TOOLS.length);
 const toolNames = listRes.result.tools.map(t => t.name);
 assert.ok(toolNames.includes('flownexa_list_flows'));
 assert.ok(toolNames.includes('flownexa_validate_graph'));
 assert.ok(toolNames.includes('flownexa_update_graph'));
 assert.ok(toolNames.includes('flownexa_publish_flow'));

 // 2. Direct validate call via MCP
 const valCall = {
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
   name: 'flownexa_validate_graph',
   arguments: { graph: sampleGraph }
  }
 };
 const valRes = await handleMcpRequest(null, valCall);
 assert.equal(valRes.id, 2);
 const parsedResult = JSON.parse(valRes.result.content[0].text);
 assert.equal(parsedResult.valid, true);
 assert.equal(parsedResult.node_count, 5);
});

test('FlowNexaMcpClient roundtrip: list, get, and update graph via MCP tools', async (t) => {
 const { env, sampleGraph } = setup(t);
 const sessionToken = await sessionFor('u1', env);

 const createReq = new Request('https://app.test/api/agent-tokens', {
  method: 'POST',
  headers: {
   'content-type': 'application/json',
   'origin': 'https://app.test',
   'cookie': `fn_session=${sessionToken}`
  },
  body: JSON.stringify({ workspace_id: 'w1', name: 'Claude Code E2E' })
 });
 const agentToken = (await (await app.fetch(createReq, env)).json()).token;

 const originalFetch = globalThis.fetch;
 globalThis.fetch = async (url, options = {}) => {
  const req = new Request(url, options);
  return app.fetch(req, env);
 };
 t.after(() => { globalThis.fetch = originalFetch; });

 const client = new FlowNexaMcpClient({ baseUrl: 'https://app.test', apiKey: agentToken });

 // Test list via MCP
 const listCall = {
  jsonrpc: '2.0',
  id: 10,
  method: 'tools/call',
  params: { name: 'flownexa_list_flows', arguments: {} }
 };
 const listMcpRes = await handleMcpRequest(client, listCall);
 assert.equal(listMcpRes.id, 10);
 const flowsData = JSON.parse(listMcpRes.result.content[0].text);
 assert.equal(flowsData.flows.length, 1);
 assert.equal(flowsData.flows[0].id, 'f1');

 // Test get flow via MCP
 const getCall = {
  jsonrpc: '2.0',
  id: 11,
  method: 'tools/call',
  params: { name: 'flownexa_get_flow', arguments: { flow_id: 'f1' } }
 };
 const getMcpRes = await handleMcpRequest(client, getCall);
 const flowData = JSON.parse(getMcpRes.result.content[0].text);
 assert.equal(flowData.flow.id, 'f1');
 assert.equal(flowData.flow.graph.nodes.length, 5);

 // Test templates via MCP
 const tmplCall = {
  jsonrpc: '2.0',
  id: 12,
  method: 'tools/call',
  params: { name: 'flownexa_get_node_templates', arguments: {} }
 };
 const tmplMcpRes = await handleMcpRequest(client, tmplCall);
 const tmplData = JSON.parse(tmplMcpRes.result.content[0].text);
 assert.equal(tmplData.limits.max_nodes, 30);
});

test('agent overview and activity report only the token workspace, read-only', async (t) => {
 const { db, env } = setup(t);
 const sessionToken = await sessionFor('u1', env);
 const created = await (await app.fetch(new Request('https://app.test/api/agent-tokens', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://app.test', cookie: `fn_session=${sessionToken}` }, body: JSON.stringify({ workspace_id: 'w1', name: 'Report' }) }), env)).json();
 db.sqlite.exec(`INSERT INTO instagram_accounts(id, workspace_id, username, ig_user_id, status) VALUES ('a2', 'w2', 'other', '200', 'connected');
  INSERT INTO flows(id, workspace_id, account_id, name, trigger_type, scope, configuration, enabled) VALUES ('f2', 'w2', 'a2', 'Other', 'comment_any', 'all', '{}', 1);
  INSERT INTO automation_events(id, account_id, workspace_id, encrypted_event, received_at, event_at, status, due_at) VALUES ('e1', 'a1', 'w1', 'x', ${Date.now()}, ${Date.now()}, 'completed', 0), ('e2', 'a2', 'w2', 'x', ${Date.now()}, ${Date.now()}, 'completed', 0);
  INSERT INTO automation_jobs(id, event_id, account_id, workspace_id, flow_id, flow_version, action_index, action_type, effect_key, encrypted_action, status, provider_id, attempt_at, completed_at) VALUES ('j1', 'e1', 'a1', 'w1', 'f1', 1, 0, 'private_reply', 'k1', 'x', 'accepted', 'mid.1', ${Date.now()}, ${Date.now()}), ('j2', 'e2', 'a2', 'w2', 'f2', 1, 0, 'private_reply', 'k2', 'x', 'failed', null, ${Date.now()}, ${Date.now()});`);
 const client = new FlowNexaMcpClient({ baseUrl: 'https://app.test', apiKey: created.token });
 const realFetch = globalThis.fetch; globalThis.fetch = (url, options) => app.fetch(new Request(url, options), env); t.after(() => { globalThis.fetch = realFetch; });
 const overview = await client.getOverview();
 assert.equal(overview.workspace.id, 'w1');
 assert.deepEqual(overview.accounts.instagram.map(a => a.username), ['brand']);
 assert.equal(overview.flows.drafts, 1);
 assert.equal(overview.access.active, true);
 assert.deepEqual(overview.last_7_days.messages, [{ status: 'accepted', error: null, total: 1 }]);
 const { activity } = await client.getActivity(10);
 assert.deepEqual(activity.map(a => [a.id, a.flow_name, a.account, a.provider_id]), [['j1', 'Fluxo Principal', 'brand', 'mid.1']]);
 assert.equal((await client.getActivity(10, 'failed')).activity.length, 0);
 assert.ok(MCP_TOOLS.some(tool => tool.name === 'flownexa_get_overview'));
 assert.equal((await app.fetch(new Request('https://app.test/api/v1/agent/overview'), env)).status, 401);
});
