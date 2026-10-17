#!/usr/bin/env node

/**
 * FlowNexa MCP Server Executable
 * Usage:
 *   node bin/flownexa-mcp.js --api-key fnx_agent_... [--base-url https://app.flownexa.online]
 * Or via env:
 *   FLOWNEXA_API_KEY=fnx_agent_... node bin/flownexa-mcp.js
 */

import readline from 'node:readline';
import { FlowNexaMcpClient, handleMcpRequest } from '../src/mcp-server.js';

let apiKey = process.env.FLOWNEXA_API_KEY || '';
let baseUrl = process.env.FLOWNEXA_API_URL || 'https://app.flownexa.online';

const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
 if (args[i] === '--api-key' && args[i + 1]) {
  apiKey = args[++i];
 } else if (args[i] === '--base-url' && args[i + 1]) {
  baseUrl = args[++i];
 }
}

if (!apiKey) {
 process.stderr.write('Error: FlowNexa API key is required. Pass --api-key <fnx_agent_...> or set FLOWNEXA_API_KEY.\n');
 process.exit(1);
}

const client = new FlowNexaMcpClient({ baseUrl, apiKey });

const rl = readline.createInterface({
 input: process.stdin,
 output: process.stdout,
 terminal: false
});

rl.on('line', async (line) => {
 const trimmed = line.trim();
 if (!trimmed) return;
 try {
  const rpc = JSON.parse(trimmed);
  const response = await handleMcpRequest(client, rpc);
  if (response !== null) {
   process.stdout.write(JSON.stringify(response) + '\n');
  }
 } catch (err) {
  process.stdout.write(JSON.stringify({
   jsonrpc: '2.0',
   id: null,
   error: { code: -32700, message: 'Parse error: ' + err.message }
  }) + '\n');
 }
});
