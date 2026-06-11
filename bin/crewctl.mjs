#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);

function printJson(payload, exitCode = 0) {
  const stream = exitCode === 0 ? process.stdout : process.stderr;
  stream.write(`${JSON.stringify(payload, null, 2)}\n`);
  process.exit(exitCode);
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      fs.copyFileSync(from, to);
    }
  }
}

function parseTarget(rawArgs) {
  const index = rawArgs.indexOf('--target');
  if (index === -1) return null;
  const value = rawArgs[index + 1];
  if (!value) {
    printJson({ ok: false, reason: 'Missing value for --target.' }, 1);
  }
  return path.resolve(value);
}

function installCodexSkill(rawArgs) {
  const source = path.join(packageRoot, 'skills', 'crewctl');
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const targetRoot = parseTarget(rawArgs) || path.join(codexHome, 'skills');
  const target = path.join(targetRoot, 'crewctl');

  if (!fs.existsSync(source)) {
    printJson({ ok: false, reason: `Missing skill source: ${source}` }, 1);
  }

  if (fs.existsSync(target)) {
    fs.rmSync(target, { recursive: true, force: true });
  }

  copyDir(source, target);
  printJson({
    ok: true,
    source,
    target,
    note: 'Restart Codex or refresh skills if the host does not pick up newly installed skills automatically.'
  });
}

function printHelp() {
  process.stdout.write(`crewctl

Usage:
  crewctl install-skill codex [--target <skills-dir>]
  crewctl <runner-command> [...args]

Examples:
  crewctl install-skill codex
  crewctl status
  crewctl runtime-adapter
  crewctl role-prompt

`);
}

if (args.length === 0 || args[0] === '--help' || args[0] === 'help') {
  printHelp();
  process.exit(0);
}

if (args[0] === 'install-skill') {
  const platform = args[1] ?? 'codex';
  if (platform !== 'codex') {
    printJson({ ok: false, reason: `Unsupported skill platform: ${platform}` }, 1);
  }
  installCodexSkill(args.slice(2));
}

const runner = path.join(packageRoot, 'src', 'runner.mjs');
const result = spawnSync(process.execPath, [runner, ...args], {
  cwd: process.cwd(),
  stdio: 'inherit',
  env: process.env
});

process.exit(result.status ?? 1);
