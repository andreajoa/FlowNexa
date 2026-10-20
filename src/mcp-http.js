// Remote MCP endpoint (Streamable HTTP, JSON responses): customers connect Claude Code or Codex with
// only their workspace key, without installing anything. Tool calls run against this same app.
import {FlowNexaMcpClient, handleMcpRequest} from './mcp-server.js';
import {authenticateAgent} from './agent-api.js';
import {respond as J} from './identity.js';

export async function mcpHttp(request, env, appFetch) {
 if (request.method !== 'POST') return new Response(null, {status: 405, headers: {allow: 'POST'}});
 if (!env.DB) return J({error: 'database_unavailable'}, 503);
 if (!await authenticateAgent(request, env)) return J({jsonrpc: '2.0', id: null, error: {code: -32001, message: 'Invalid or revoked FlowNexa key. Generate one in Conectar IA (Claude / Codex).'}}, 401);
 let body;
 try { body = await request.json(); } catch { return J({jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}, 400); }
 const origin = new URL(request.url).origin, apiKey = request.headers.get('authorization').slice(7).trim();
 const client = new FlowNexaMcpClient({baseUrl: origin, apiKey, fetchImpl: (url, options) => appFetch(new Request(url, options), env)});
 const batch = Array.isArray(body), calls = (batch ? body : [body]).slice(0, 20);
 const results = (await Promise.all(calls.map(rpc => handleMcpRequest(client, rpc)))).filter(r => r !== null);
 if (!results.length) return new Response(null, {status: 202});
 return J(batch ? results : results[0]);
}
