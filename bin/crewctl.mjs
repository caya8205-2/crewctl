#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const DEFAULT_OBJECTIVE = 'New crewctl task';
const AGENT_ARTIFACTS = [
  '.agent/workstate.json',
  '.agent/context.md',
  '.agent/plan.md',
  '.agent/implementation-report.md',
  '.agent/audit.md',
  '.agent/qc.json',
  '.agent/check-results.json',
  '.agent/history.md'
];
const SCAFFOLD_DIRS = ['templates', 'prompts'];

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

function parseOption(rawArgs, name) {
  const index = rawArgs.indexOf(name);
  if (index === -1) return null;
  const value = rawArgs[index + 1];
  if (!value) {
    printJson({ ok: false, reason: `Missing value for ${name}.` }, 1);
  }
  return value;
}

function hasFlag(rawArgs, name) {
  return rawArgs.includes(name);
}

function rel(root, file) {
  return path.relative(root, file).replaceAll(path.sep, '/');
}

function writeTextIfAllowed(file, content, force, written, skipped) {
  if (fs.existsSync(file) && !force) {
    skipped.push(rel(process.cwd(), file));
    return;
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, 'utf8');
  written.push(rel(process.cwd(), file));
}

function copyFileIfAllowed(src, dest, force, written, skipped) {
  if (fs.existsSync(dest) && !force) {
    skipped.push(rel(process.cwd(), dest));
    return;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  written.push(rel(process.cwd(), dest));
}

function copyDirIfAllowed(src, dest, force, written, skipped) {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirIfAllowed(from, to, force, written, skipped);
    } else {
      copyFileIfAllowed(from, to, force, written, skipped);
    }
  }
}

function defaultState(target, objective) {
  const project = path.basename(target);
  return {
    project,
    objective,
    status: 'INIT',
    currentIteration: 0,
    maxIterations: 5,
    currentRole: 'orchestrator',
    lastCompletedRole: null,
    nextRole: 'planner',
    activeTask: {
      id: 'task-000',
      title: objective,
      priority: 'normal'
    },
    qualityGate: {
      minScore: 85,
      lastScore: null,
      failedReasons: []
    },
    allowedGlobs: [
      'src/**',
      '.agent/**',
      'templates/**',
      'prompts/**',
      'README.md',
      'package.json'
    ],
    forbiddenGlobs: [
      '.env*',
      'secrets/**',
      'infra/prod/**'
    ],
    blockers: [],
    updatedAt: new Date().toISOString(),
    taskCounter: 0
  };
}

function defaultConfig() {
  return {
    workflow: { maxIterations: 5 },
    quality: { minScore: 85 },
    checks: { build: '', lint: '', test: '', typecheck: '', validate: '' },
    runtime: {
      preferredAdapter: 'generic-cli',
      supportedAdapters: ['generic-cli', 'openclaw']
    },
    sourceOfTruth: {
      primaryDoc: '.agent/context.md',
      references: ['.agent/plan.md', '.agent/implementation-report.md', '.agent/audit.md', '.agent/qc.json']
    }
  };
}

function initProject(rawArgs) {
  const target = parseTarget(rawArgs) || process.cwd();
  const objective = parseOption(rawArgs, '--objective') || DEFAULT_OBJECTIVE;
  const force = hasFlag(rawArgs, '--force');
  const written = [];
  const skipped = [];

  fs.mkdirSync(target, { recursive: true });

  writeTextIfAllowed(
    path.join(target, '.agent', 'workstate.json'),
    `${JSON.stringify(defaultState(target, objective), null, 2)}\n`,
    force,
    written,
    skipped
  );
  writeTextIfAllowed(path.join(target, '.agent', 'context.md'), `# Context\n\nProject initialized by crewctl.\n`, force, written, skipped);
  writeTextIfAllowed(path.join(target, '.agent', 'plan.md'), `# Plan\n\nPending planner output for: ${objective}\n`, force, written, skipped);
  writeTextIfAllowed(path.join(target, '.agent', 'implementation-report.md'), '# Implementation Report\n\nPending.\n', force, written, skipped);
  writeTextIfAllowed(path.join(target, '.agent', 'audit.md'), '# Audit Report\n\nPending.\n', force, written, skipped);
  writeTextIfAllowed(
    path.join(target, '.agent', 'qc.json'),
    `${JSON.stringify({ score: null, passed: false, threshold: 85, categories: { correctness: 0, tests: 0, architecture: 0, maintainability: 0, security: 0 }, failureReasons: [], routeBackTo: null }, null, 2)}\n`,
    force,
    written,
    skipped
  );
  writeTextIfAllowed(
    path.join(target, '.agent', 'check-results.json'),
    `${JSON.stringify({ generatedAt: null, requiredFiles: { ok: false, missing: [], checkedFiles: AGENT_ARTIFACTS.length }, configuredChecks: [], summary: { requiredFilesOk: false, configuredChecksOk: false, failingConfiguredChecks: [] } }, null, 2)}\n`,
    force,
    written,
    skipped
  );
  writeTextIfAllowed(path.join(target, '.agent', 'history.md'), `# History\n\n- ${new Date().toISOString()}: crewctl scaffold initialized (${objective})\n`, force, written, skipped);

  writeTextIfAllowed(path.join(target, 'crewctl.config.json'), `${JSON.stringify(defaultConfig(), null, 2)}\n`, force, written, skipped);
  for (const dir of SCAFFOLD_DIRS) {
    copyDirIfAllowed(path.join(packageRoot, dir), path.join(target, dir), force, written, skipped);
  }

  printJson({
    ok: true,
    target,
    force,
    objective,
    written,
    skipped,
    nextCommands: [
      'crewctl doctor',
      `crewctl new-task "${objective}"`,
      'crewctl runtime-adapter'
    ]
  });
}

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    return { error: error.message };
  }
}

function doctor(rawArgs) {
  const target = parseTarget(rawArgs) || process.cwd();
  const required = [
    ...AGENT_ARTIFACTS,
    'crewctl.config.json',
    'templates/planner.md',
    'templates/implementer.md',
    'templates/auditor.md',
    'templates/qc.md',
    'prompts/planner.md',
    'prompts/implementer.md',
    'prompts/auditor.md',
    'prompts/qc.md',
    'prompts/openclaw-orchestrator.md'
  ];
  const missing = required.filter((item) => !fs.existsSync(path.join(target, item)));
  const stateFile = path.join(target, '.agent', 'workstate.json');
  const configFile = path.join(target, 'crewctl.config.json');
  const state = fs.existsSync(stateFile) ? readJsonSafe(stateFile) : null;
  const config = fs.existsSync(configFile) ? readJsonSafe(configFile) : null;
  const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
  const skillPath = path.join(codexHome, 'skills', 'crewctl', 'SKILL.md');
  const enabled = missing.length === 0 && state && !state.error && config && !config.error;

  printJson({
    ok: enabled,
    target,
    crewctlEnabled: enabled,
    missing,
    state: state
      ? {
          status: state.status ?? null,
          objective: state.objective ?? null,
          nextRole: state.nextRole ?? null,
          activeTask: state.activeTask ?? null,
          error: state.error
        }
      : null,
    config: config
      ? {
          preferredAdapter: config.runtime?.preferredAdapter ?? null,
          checks: Object.keys(config.checks ?? {}),
          error: config.error
        }
      : null,
    codexSkill: {
      installed: fs.existsSync(skillPath),
      path: skillPath
    },
    recommendations: enabled
      ? ['Run `crewctl runtime-adapter` to inspect the next role.', 'Run `crewctl role-prompt` before doing role work.']
      : ['Run `crewctl init` from the target repo, or `crewctl init --target <path>`.']
  });
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
  crewctl init [--target <repo-dir>] [--objective <text>] [--force]
  crewctl doctor [--target <repo-dir>]
  crewctl install-skill codex [--target <skills-dir>]
  crewctl <runner-command> [...args]

Examples:
  crewctl init
  crewctl doctor
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

if (args[0] === 'init') {
  initProject(args.slice(1));
}

if (args[0] === 'doctor') {
  doctor(args.slice(1));
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
