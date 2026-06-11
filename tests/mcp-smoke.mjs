import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const tmpRoot = path.join(root, '.tmp-mcp-smoke');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

fs.rmSync(tmpRoot, { recursive: true, force: true });

const client = new Client({ name: 'crewctl-mcp-smoke', version: '0.1.0' });
const transport = new StdioClientTransport({
  command: process.execPath,
  args: [path.join(root, 'bin/crewctl-mcp.mjs')],
  cwd: root,
  stderr: 'pipe'
});

try {
  await client.connect(transport);

  const tools = await client.listTools();
  const toolNames = tools.tools.map((tool) => tool.name);
  assert(toolNames.includes('crewctl_doctor'), 'MCP should expose crewctl_doctor');
  assert(toolNames.includes('crewctl_runtime_adapter'), 'MCP should expose crewctl_runtime_adapter');
  assert(toolNames.includes('crewctl_complete_role'), 'MCP should expose crewctl_complete_role');

  const init = await client.callTool({
    name: 'crewctl_init',
    arguments: { target: tmpRoot, objective: 'MCP smoke repo' }
  });
  assert(init.structuredContent?.result?.ok === true, 'crewctl_init should succeed');

  const doctor = await client.callTool({
    name: 'crewctl_doctor',
    arguments: { target: tmpRoot }
  });
  assert(doctor.structuredContent?.result?.crewctlEnabled === true, 'crewctl_doctor should report enabled repo');

  const adapter = await client.callTool({
    name: 'crewctl_runtime_adapter',
    arguments: { target: tmpRoot }
  });
  assert(adapter.structuredContent?.result?.resolvedRole === 'planner', 'runtime adapter should resolve planner after init');

  console.log('mcp smoke: ok');
} finally {
  await client.close();
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}
