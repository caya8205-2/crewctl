import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const crewctlBin = path.join(packageRoot, 'bin', 'crewctl.mjs');

const targetSchema = {
  target: z.string().optional().describe('Target repository directory. Defaults to the MCP server current working directory.')
};

function asTarget(target) {
  return target ? path.resolve(target) : process.cwd();
}

function parseJson(text) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function toolResult(payload, isError = false) {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError
  };
}

function runCrewctl(args, { target, allowFailure = false } = {}) {
  const cwd = asTarget(target);
  const result = spawnSync(process.execPath, [crewctlBin, ...args], {
    cwd,
    encoding: 'utf8',
    stdio: 'pipe',
    env: process.env
  });
  const stdoutJson = parseJson(result.stdout);
  const stderrJson = parseJson(result.stderr);
  const payload = stdoutJson ?? stderrJson ?? {
    ok: result.status === 0,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim()
  };

  if (result.status !== 0 && !allowFailure) {
    return toolResult({
      ok: false,
      command: ['crewctl', ...args],
      cwd,
      exitCode: result.status,
      result: payload
    }, true);
  }

  return toolResult({
    ok: result.status === 0,
    command: ['crewctl', ...args],
    cwd,
    result: payload
  }, result.status !== 0);
}

function registerTools(server) {
  server.registerTool('crewctl_doctor', {
    title: 'Crewctl Doctor',
    description: 'Inspect whether a target repository is crewctl-enabled and report state, config, missing files, and recommendations.',
    inputSchema: targetSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, ({ target }) => runCrewctl(['doctor', ...(target ? ['--target', target] : [])], { target }));

  server.registerTool('crewctl_init', {
    title: 'Crewctl Init',
    description: 'Scaffold crewctl files into a target repository. Skips existing files unless force is true.',
    inputSchema: {
      ...targetSchema,
      objective: z.string().optional().describe('Initial objective to write into workstate and plan placeholder.'),
      force: z.boolean().optional().describe('Overwrite existing crewctl scaffold files when true.')
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false }
  }, ({ target, objective, force }) => {
    const args = ['init'];
    if (target) args.push('--target', target);
    if (objective) args.push('--objective', objective);
    if (force) args.push('--force');
    return runCrewctl(args);
  });

  server.registerTool('crewctl_status', {
    title: 'Crewctl Status',
    description: 'Read `.agent/workstate.json` from a target repository.',
    inputSchema: targetSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, ({ target }) => runCrewctl(['status'], { target }));

  server.registerTool('crewctl_runtime_adapter', {
    title: 'Crewctl Runtime Adapter',
    description: 'Return runtime adapter metadata: next role, required artifact, helper commands, and stop conditions.',
    inputSchema: {
      ...targetSchema,
      adapter: z.string().optional().describe('Adapter name to request, such as openclaw or generic-cli.')
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, ({ target, adapter }) => runCrewctl(['runtime-adapter', ...(adapter ? [adapter] : [])], { target }));

  server.registerTool('crewctl_role_prompt', {
    title: 'Crewctl Role Prompt',
    description: 'Generate the current or requested role prompt and required artifact contract.',
    inputSchema: {
      ...targetSchema,
      role: z.enum(['planner', 'implementer', 'auditor', 'qc']).optional()
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, ({ target, role }) => runCrewctl(['role-prompt', ...(role ? [role] : [])], { target }));

  server.registerTool('crewctl_complete_role', {
    title: 'Crewctl Complete Role',
    description: 'Guarded state transition for a completed worker role. Use pass only after the required artifact is valid.',
    inputSchema: {
      ...targetSchema,
      role: z.enum(['planner', 'implementer', 'auditor', 'qc']),
      verdict: z.enum(['pass', 'fail']).default('pass')
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
  }, ({ target, role, verdict }) => runCrewctl(['complete-role', role, verdict], { target }));

  server.registerTool('crewctl_continue', {
    title: 'Crewctl Continue',
    description: 'Run the deterministic continuation for the current crewctl state.',
    inputSchema: targetSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false }
  }, ({ target }) => runCrewctl(['continue'], { target }));

  server.registerTool('crewctl_checks', {
    title: 'Crewctl Checks',
    description: 'Run configured crewctl checks for a target repository.',
    inputSchema: targetSchema,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true }
  }, ({ target }) => runCrewctl(['checks'], { target, allowFailure: true }));

  server.registerTool('crewctl_source_of_truth', {
    title: 'Crewctl Source Of Truth',
    description: 'Return source-of-truth docs and current task metadata for a target repository.',
    inputSchema: targetSchema,
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true }
  }, ({ target }) => runCrewctl(['source-of-truth'], { target }));
}

export async function startMcpServer() {
  const server = new McpServer({ name: 'crewctl', version: '0.1.0' });
  registerTools(server);
  await server.connect(new StdioServerTransport());
}
