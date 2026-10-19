/**
 * FlowNexa Official Model Context Protocol (MCP) Server
 * Compatible with Claude Code, OpenAI Codex, Cursor, and any MCP client.
 * Provides safe, zero-trust tools for AI agents to inspect, validate, and build
 * conversation graphs directly in the FlowNexa client dashboard.
 */

import { validateGraph } from './conversation-graph.js';
import { FLOWNEXA_AGENT_INSTRUCTIONS, FLOWNEXA_AGENT_GUIDE } from './mcp-guide.js';

export const MCP_TOOLS = [
 {
  name: 'flownexa_get_guide',
  description: 'Read first: how FlowNexa works, the exact conversation-graph contract and limits, Meta delivery rules and the safe workflow for creating flows.',
  inputSchema: { type: 'object', properties: {} }
 },
 {
  name: 'flownexa_list_flows',
  description: 'List all Instagram automation flows in the client workspace, showing IDs, names, trigger types, and node counts.',
  inputSchema: {
   type: 'object',
   properties: {}
  }
 },
 {
  name: 'flownexa_get_flow',
  description: 'Retrieve detailed information about a specific flow, including its full conversation graph (nodes, edges, conditions, and copy).',
  inputSchema: {
   type: 'object',
   properties: {
    flow_id: { type: 'string', description: 'The UUID of the flow to inspect.' }
   },
   required: ['flow_id']
  }
 },
 {
  name: 'flownexa_create_flow',
  description: 'Create a new Instagram automation as a draft. trigger_type: comment_keyword, comment_any, dm_keyword or story_reply. configuration: {keywords:[...], graph:{version:1,start,nodes:[...]}, once_per_contact, entry_points?}. Publish separately with flownexa_publish_flow.',
  inputSchema: {
   type: 'object',
   properties: {
    name: { type: 'string' },
    trigger_type: { type: 'string', enum: ['comment_keyword', 'comment_any', 'dm_keyword', 'story_reply'] },
    scope: { type: 'string', enum: ['all', 'selected'] },
    configuration: { type: 'object' },
    account: { type: 'string', description: 'Instagram username when the workspace has more than one.' }
   },
   required: ['name', 'trigger_type', 'configuration']
  }
 },
 {
  name: 'flownexa_validate_graph',
  description: 'Validate a conversation graph before applying it. Checks node limit (max 30), DAG acyclic rules, reachability from start node, and button length constraints.',
  inputSchema: {
   type: 'object',
   properties: {
    graph: {
     type: 'object',
     description: 'The conversation graph object containing version (1), start node id, and array of nodes.',
     properties: {
      version: { type: 'number', enum: [1] },
      start: { type: 'string' },
      nodes: { type: 'array' }
     },
     required: ['version', 'start', 'nodes']
    }
   },
   required: ['graph']
  }
 },
 {
  name: 'flownexa_update_graph',
  description: 'Update the conversation graph nodes and edges for a flow. Automatically validates graph integrity and pauses flow until published.',
  inputSchema: {
   type: 'object',
   properties: {
    flow_id: { type: 'string', description: 'The UUID of the flow to update.' },
    name: { type: 'string', description: 'Optional updated display name for the flow.' },
    graph: {
     type: 'object',
     description: 'The complete validated conversation graph object.',
     properties: {
      version: { type: 'number', enum: [1] },
      start: { type: 'string' },
      nodes: { type: 'array' }
     },
     required: ['version', 'start', 'nodes']
    }
   },
   required: ['flow_id', 'graph']
  }
 },
 {
  name: 'flownexa_publish_flow',
  description: 'Publish or pause an automation flow in the client dashboard.',
  inputSchema: {
   type: 'object',
   properties: {
    flow_id: { type: 'string', description: 'The UUID of the flow.' },
    enabled: { type: 'boolean', description: 'True to publish/activate, false to pause.' }
   },
   required: ['flow_id', 'enabled']
  }
 },
 {
  name: 'flownexa_get_overview',
  description: 'Report for this profile: connected Instagram/Facebook accounts and their status, published vs draft flows, plan access, messages used this month, and 7/30-day counts of events received, messages by status/error and conversations by status.',
  inputSchema: { type: 'object', properties: {} }
 },
 {
  name: 'flownexa_get_activity',
  description: 'Most recent automation sends for this profile with flow name, action, status, error and Meta/provider message ID. Use to find failures or confirm a flow is firing.',
  inputSchema: {
   type: 'object',
   properties: {
    limit: { type: 'number', description: 'How many records (1-200, default 50).' },
    status: { type: 'string', description: 'Optional filter, e.g. accepted, failed, unknown, cancelled.' }
   }
  }
 },
 {
  name: 'flownexa_facebook_list_flows',
  description: 'List the connected Facebook Page(s) and Facebook flows (name, trigger, enabled, node count) of this profile.',
  inputSchema: { type: 'object', properties: {} }
 },
 {
  name: 'flownexa_facebook_import_instagram_flow',
  description: 'Copy an Instagram conversation graph of this workspace to the Facebook Page as a draft. trigger_type: dm_any (Messenger), dm_keyword, comment_any or comment_keyword.',
  inputSchema: {
   type: 'object',
   properties: {
    instagram_flow_id: { type: 'string' },
    trigger_type: { type: 'string', enum: ['dm_any', 'dm_keyword', 'comment_any', 'comment_keyword'] },
    keywords: { type: 'array', items: { type: 'string' } },
    name: { type: 'string' }
   },
   required: ['instagram_flow_id']
  }
 },
 {
  name: 'flownexa_facebook_publish_flow',
  description: 'Publish (enabled=true) or pause (enabled=false) a Facebook flow.',
  inputSchema: { type: 'object', properties: { flow_id: { type: 'string' }, enabled: { type: 'boolean' } }, required: ['flow_id', 'enabled'] }
 },
 {
  name: 'flownexa_instagram_profile',
  description: 'Instagram profile of this workspace (bio, website, followers, media count). Optional account: username when the workspace has more than one.',
  inputSchema: { type: 'object', properties: { account: { type: 'string' } } }
 },
 {
  name: 'flownexa_instagram_media',
  description: 'Recent Instagram posts and reels of this workspace: caption, type, permalink, date, likes and comments count.',
  inputSchema: { type: 'object', properties: { limit: { type: 'number' }, account: { type: 'string' } } }
 },
 {
  name: 'flownexa_instagram_comments',
  description: 'Comments of one Instagram post (text, username, date) to understand what people ask.',
  inputSchema: { type: 'object', properties: { media_id: { type: 'string' }, account: { type: 'string' } }, required: ['media_id'] }
 },
 {
  name: 'flownexa_get_node_templates',
  description: 'Get syntax templates and schema limits for conversation graph nodes (message, buttons, wait_reply, condition, switch, delay, end).',
  inputSchema: {
   type: 'object',
   properties: {}
  }
 }
];

export class FlowNexaMcpClient {
 constructor({ baseUrl = 'https://flownex.online', apiKey, fetchImpl }) {
  this.baseUrl = baseUrl.replace(/\/+$/, '');
  this.apiKey = apiKey;
  this.fetchImpl = fetchImpl || ((url, options) => fetch(url, options));
 }

 async request(path, options = {}) {
  const headers = {
   'Authorization': `Bearer ${this.apiKey}`,
   'Content-Type': 'application/json',
   ...options.headers
  };
  const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
   ...options,
   headers
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
   throw new Error(data.error || data.details || `HTTP_${res.status}`);
  }
  return data;
 }

 async createFlow(args) {
  return this.request('/api/v1/agent/flows', { method: 'POST', body: JSON.stringify(args) });
 }

 async listFlows() {
  return this.request('/api/v1/agent/flows');
 }

 async getFlow(flowId) {
  return this.request(`/api/v1/agent/flows/${encodeURIComponent(flowId)}`);
 }

 async updateGraph(flowId, graph, name) {
  return this.request(`/api/v1/agent/flows/${encodeURIComponent(flowId)}/graph`, {
   method: 'PUT',
   body: JSON.stringify({ graph, name })
  });
 }

 async publishFlow(flowId, enabled) {
  return this.request(`/api/v1/agent/flows/${encodeURIComponent(flowId)}/publish`, {
   method: 'POST',
   body: JSON.stringify({ enabled })
  });
 }

 async getOverview() {
  return this.request('/api/v1/agent/overview');
 }

 async getActivity(limit, status) {
  const query = new URLSearchParams();
  if (limit) query.set('limit', String(limit));
  if (status) query.set('status', status);
  return this.request('/api/v1/agent/activity' + (query.size ? '?' + query : ''));
 }

 async facebookFlows() {
  return this.request('/api/v1/agent/facebook/flows');
 }

 async facebookImport(args) {
  return this.request('/api/v1/agent/facebook/import', { method: 'POST', body: JSON.stringify(args) });
 }

 async facebookPublish(flowId, enabled) {
  return this.request(`/api/v1/agent/facebook/flows/${encodeURIComponent(flowId)}/publish`, { method: 'POST', body: JSON.stringify({ enabled }) });
 }

 async instagram(kind, params = {}) {
  const query = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '').map(([k, v]) => [k, String(v)]));
  return this.request('/api/v1/agent/instagram/' + kind + (query.size ? '?' + query : ''));
 }

 async getTemplates() {
  return this.request('/api/v1/agent/templates');
 }
}

export function handleMcpRequest(client, rpc) {
 if (!rpc || typeof rpc !== 'object') {
  return { jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Invalid Request' } };
 }
 const { id, method, params } = rpc;

 if (method === 'initialize') {
  return {
   jsonrpc: '2.0',
   id,
   result: {
    protocolVersion: '2024-11-05',
    capabilities: { tools: {} },
    serverInfo: { name: 'flownexa-mcp', version: '1.1.0' },
    instructions: FLOWNEXA_AGENT_INSTRUCTIONS
   }
  };
 }

 if (method === 'notifications/initialized') {
  return null;
 }

 if (method === 'tools/list') {
  return {
   jsonrpc: '2.0',
   id,
   result: { tools: MCP_TOOLS }
  };
 }

 if (method === 'tools/call') {
  const { name, arguments: args = {} } = params || {};
  return executeToolCall(client, id, name, args);
 }

 return {
  jsonrpc: '2.0',
  id,
  error: { code: -32601, message: `Method not found: ${method}` }
 };
}

async function executeToolCall(client, id, name, args) {
 try {
  let content;
  if (name === 'flownexa_get_guide') {
   content = FLOWNEXA_AGENT_GUIDE;
  } else if (name === 'flownexa_create_flow') {
   content = JSON.stringify(await client.createFlow(args), null, 2);
  } else if (name === 'flownexa_list_flows') {
   const res = await client.listFlows();
   content = JSON.stringify(res, null, 2);
  } else if (name === 'flownexa_get_flow') {
   const res = await client.getFlow(args.flow_id);
   content = JSON.stringify(res, null, 2);
  } else if (name === 'flownexa_validate_graph') {
   const result = validateGraph(args.graph);
   content = JSON.stringify({
    valid: result.ok,
    error: result.error || null,
    node_count: args.graph?.nodes?.length || 0
   }, null, 2);
  } else if (name === 'flownexa_update_graph') {
   const res = await client.updateGraph(args.flow_id, args.graph, args.name);
   content = JSON.stringify(res, null, 2);
  } else if (name === 'flownexa_publish_flow') {
   const res = await client.publishFlow(args.flow_id, args.enabled);
   content = JSON.stringify(res, null, 2);
  } else if (name === 'flownexa_get_overview') {
   content = JSON.stringify(await client.getOverview(), null, 2);
  } else if (name === 'flownexa_get_activity') {
   content = JSON.stringify(await client.getActivity(args.limit, args.status), null, 2);
  } else if (name === 'flownexa_facebook_list_flows') {
   content = JSON.stringify(await client.facebookFlows(), null, 2);
  } else if (name === 'flownexa_facebook_import_instagram_flow') {
   content = JSON.stringify(await client.facebookImport(args), null, 2);
  } else if (name === 'flownexa_facebook_publish_flow') {
   content = JSON.stringify(await client.facebookPublish(args.flow_id, args.enabled), null, 2);
  } else if (name === 'flownexa_instagram_profile') {
   content = JSON.stringify(await client.instagram('profile', { account: args.account }), null, 2);
  } else if (name === 'flownexa_instagram_media') {
   content = JSON.stringify(await client.instagram('media', { limit: args.limit, account: args.account }), null, 2);
  } else if (name === 'flownexa_instagram_comments') {
   content = JSON.stringify(await client.instagram('comments', { media_id: args.media_id, account: args.account }), null, 2);
  } else if (name === 'flownexa_get_node_templates') {
   const res = await client.getTemplates();
   content = JSON.stringify(res, null, 2);
  } else {
   return {
    jsonrpc: '2.0',
    id,
    error: { code: -32601, message: `Tool not found: ${name}` }
   };
  }

  return {
   jsonrpc: '2.0',
   id,
   result: {
    content: [{ type: 'text', text: content }]
   }
  };
 } catch (err) {
  return {
   jsonrpc: '2.0',
   id,
   result: {
    isError: true,
    content: [{ type: 'text', text: `Error: ${err.message}` }]
   }
  };
 }
}
