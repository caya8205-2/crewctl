import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const root = process.cwd();
const agentDir = path.join(root, '.agent');
const statePath = path.join(agentDir, 'workstate.json');
const lockPath = path.join(agentDir, 'run.lock');
const configPath = path.join(root, 'crewctl.config.json');
const STALE_LOCK_MS = 5 * 60 * 1000;

const REQUIRED_FILES = [
  '.agent/workstate.json', '.agent/context.md', '.agent/plan.md',
  '.agent/implementation-report.md', '.agent/audit.md', '.agent/qc.json',
  '.agent/history.md', 'templates/planner.md', 'templates/implementer.md',
  'templates/auditor.md', 'templates/qc.md', 'README.md', 'package.json', 'crewctl.config.json'
];

const DEFAULT_CONFIG = {
  workflow: { maxIterations: 5 },
  quality: { minScore: 85 },
  checks: { build: '', lint: '', test: '', typecheck: '' },
  runtime: { preferredAdapter: 'openclaw' }
};

const NEXT_MAP = {
  INIT: { nextRole: 'planner', nextState: 'PLANNING' },
  PLANNING: { nextRole: 'planner', nextState: 'READY_FOR_IMPLEMENT' },
  READY_FOR_IMPLEMENT: { nextRole: 'implementer', nextState: 'IMPLEMENTING' },
  IMPLEMENTING: { nextRole: 'auditor', nextState: 'READY_FOR_AUDIT' },
  READY_FOR_AUDIT: { nextRole: 'auditor', nextState: 'AUDITING' },
  READY_FOR_QC: { nextRole: 'qc', nextState: 'QC' },
  QC: { nextRole: 'orchestrator', nextState: 'DONE' },
  QC_FAILED: { nextRole: 'implementer', nextState: 'READY_FOR_IMPLEMENT' },
  AUDIT_FAILED: { nextRole: 'implementer', nextState: 'READY_FOR_IMPLEMENT' },
  BLOCKED: { nextRole: null, nextState: 'BLOCKED' },
  DONE: { nextRole: null, nextState: 'DONE' }
};

function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function writeJson(file, value) { fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
function deepMerge(base, extra) {
  if (Array.isArray(base) || Array.isArray(extra)) return extra ?? base;
  if (typeof base !== 'object' || typeof extra !== 'object' || !base || !extra) return extra ?? base;
  const out = { ...base };
  for (const key of Object.keys(extra)) out[key] = deepMerge(base[key], extra[key]);
  return out;
}
function loadConfig() { return fs.existsSync(configPath) ? deepMerge(DEFAULT_CONFIG, readJson(configPath)) : DEFAULT_CONFIG; }
function loadState() { return readJson(statePath); }
function saveState(state) { state.updatedAt = new Date().toISOString(); writeJson(statePath, state); }
function ensureState() { if (!fs.existsSync(statePath)) throw new Error(`Missing state file: ${statePath}`); }
function getNext(state) { return NEXT_MAP[state.status] ?? { nextRole: null, nextState: state.status }; }
function appendHistory(line) { fs.appendFileSync(path.join(agentDir, 'history.md'), `${line}\n`, 'utf8'); }
function log(payload, options = {}) { if (!options.quiet) console.log(JSON.stringify(payload, null, 2)); return payload; }
function formatList(items) { return items.map((item) => `- ${item}`).join('\n'); }
function readText(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }
function writeAgentFile(name, content) { fs.writeFileSync(path.join(agentDir, name), content, 'utf8'); }

function readLock() { if (!fs.existsSync(lockPath)) return null; try { return readJson(lockPath); } catch { return { pid: null, createdAt: null, command: 'unknown' }; } }
function isLockStale(lock) { const t = Date.parse(lock?.createdAt ?? ''); return Number.isNaN(t) || Date.now() - t > STALE_LOCK_MS; }
function acquireLock(command) {
  const existing = readLock();
  if (existing && !isLockStale(existing)) {
    console.error(JSON.stringify({ ok: false, reason: 'Another crewctl mutation is already running.', lock: existing }, null, 2));
    process.exit(1);
  }
  const lock = { pid: process.pid, command, createdAt: new Date().toISOString() };
  writeJson(lockPath, lock);
  return lock;
}
function releaseLock(lock) { if (fs.existsSync(lockPath) && readLock()?.pid === lock.pid) fs.rmSync(lockPath, { force: true }); }
function withLock(command, fn) { const lock = acquireLock(command); try { return fn(); } finally { releaseLock(lock); } }

function validateRequiredFiles() {
  const missing = REQUIRED_FILES.filter((p) => !fs.existsSync(path.join(root, p)));
  return { ok: missing.length === 0, missing, checkedFiles: REQUIRED_FILES.length };
}

function runConfiguredChecks() {
  const config = loadConfig();
  const entries = Object.entries(config.checks ?? {});
  const results = [];
  for (const [name, command] of entries) {
    if (!command) {
      results.push({ name, command, status: 'not-configured', ok: true, output: '' });
      continue;
    }
    try {
      const output = execSync(command, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
      results.push({ name, command, status: 'pass', ok: true, output: output.trim() });
    } catch (error) {
      results.push({
        name,
        command,
        status: 'fail',
        ok: false,
        output: `${error.stdout ?? ''}${error.stderr ?? ''}`.trim()
      });
    }
  }
  return results;
}

function summarizeChecks(results) {
  if (!results.length) return '- No configured checks.';
  return results.map((r) => `- ${r.name}: ${r.status}${r.command ? ` (${r.command})` : ''}`).join('\n');
}

function normalizeObjective(objective) {
  const lower = objective.toLowerCase();
  if (lower.includes('fail') || lower.includes('failure')) return 'failure-path';
  if (lower.includes('openclaw') || lower.includes('adapter')) return 'openclaw-adapter';
  if (lower.includes('planner')) return 'planner';
  if (lower.includes('lock')) return 'lock-guard';
  return 'general';
}

function taskBreakdown(kind) {
  const common = ['Inspect current state and artifacts', 'Implement the smallest useful change', 'Record evidence in implementation report', 'Audit output against acceptance criteria', 'Run QC and route pass/fail'];
  const specific = {
    'failure-path': ['Add explicit AUDIT_FAILED and QC_FAILED routing', 'Ensure retries increment iteration safely', 'Block when maxIterations is reached', 'Create test scenarios for forced audit/QC failures'],
    'openclaw-adapter': ['Document OpenClaw adapter contract', 'Create adapter scaffold docs', 'Map crewctl states to OpenClaw subagent roles', 'Define handoff artifact expectations'],
    planner: ['Make planner output adapt to task objective', 'Generate objective-specific acceptance criteria', 'Keep allowed/forbidden files in plan'],
    'lock-guard': ['Guard all mutation commands with lock file', 'Reject active lock', 'Ignore stale lock', 'Verify lock clears after run'],
    general: common
  };
  return [...(specific[kind] ?? common), ...common].filter((x, i, arr) => arr.indexOf(x) === i);
}

function acceptanceCriteria(kind) {
  const base = ['`npm run check` validates required files', '`npm run agent:status` prints current state', 'Workflow history records role transitions'];
  const byKind = {
    'failure-path': ['AUDIT_FAILED routes back to implementer', 'QC_FAILED routes back to implementer or BLOCKED', 'Max iteration guard can block repeated failures'],
    'openclaw-adapter': ['OpenClaw adapter doc exists', 'Role mapping is documented', 'Artifact contract is documented'],
    planner: ['Plan reflects current objective', 'Plan includes scope, non-scope, tasks, risks, and acceptance criteria'],
    'lock-guard': ['Mutation command creates and clears lock', 'Active lock rejects second mutation']
  };
  return [...base, ...(byKind[kind] ?? ['Run can progress from PLANNING to DONE'])];
}

function applyConfigToState(state) {
  const config = loadConfig();
  state.maxIterations = config.workflow.maxIterations ?? state.maxIterations ?? 5;
  state.qualityGate ??= {};
  state.qualityGate.minScore = config.quality.minScore ?? state.qualityGate.minScore ?? 85;
}

function cmdInit() { ensureState(); const s = loadState(); console.log(JSON.stringify({ ok: true, status: s.status, next: getNext(s) }, null, 2)); }
function cmdStatus() { ensureState(); console.log(JSON.stringify(loadState(), null, 2)); }
function cmdNext() { ensureState(); const s = loadState(); console.log(JSON.stringify({ currentStatus: s.status, ...getNext(s) }, null, 2)); }
function cmdValidate() { const r = validateRequiredFiles(); if (!r.ok) { console.error(JSON.stringify({ ok: false, missing: r.missing }, null, 2)); process.exitCode = 1; return; } const s = loadState(); console.log(JSON.stringify({ ok: true, status: s.status, next: getNext(s), checkedFiles: r.checkedFiles }, null, 2)); }
function cmdChecks() { console.log(JSON.stringify({ ok: true, checks: runConfiguredChecks() }, null, 2)); }

function cmdTransition() {
  return withLock('transition', () => {
    ensureState();
    const explicit = process.argv[3]; const explicitRole = process.argv[4] ?? null;
    const state = loadState(); applyConfigToState(state);
    const prevStatus = state.status; const prevRole = state.currentRole;
    const next = explicit ? { nextState: explicit, nextRole: explicitRole ?? state.nextRole } : getNext(state);
    state.lastCompletedRole = state.currentRole; state.currentRole = next.nextRole ?? state.currentRole; state.nextRole = next.nextRole; state.status = next.nextState;
    if (state.status === 'READY_FOR_IMPLEMENT' || state.status === 'IMPLEMENTING') state.currentIteration += 1;
    saveState(state); appendHistory(`- ${new Date().toISOString()}: ${prevRole}/${prevStatus} -> ${state.currentRole}/${state.status}`);
    console.log(JSON.stringify({ ok: true, previousStatus: prevStatus, status: state.status, currentRole: state.currentRole, nextRole: state.nextRole }, null, 2));
  });
}

function cmdRunPlanner(options = {}) {
  return withLock('run-planner', () => {
    ensureState(); const state = loadState(); applyConfigToState(state);
    if (state.status !== 'PLANNING') return fail(`Planner can only run from PLANNING, current status is ${state.status}`);
    const kind = normalizeObjective(state.objective);
    const tasks = taskBreakdown(kind).map((t, i) => `${i + 1}. ${t}`).join('\n');
    const criteria = acceptanceCriteria(kind).map((c) => `- ${c}`).join('\n');
    const plan = `# Plan\n\n## Objective\n${state.objective}\n\n## Scope\n- Implement objective-specific progress for kind: \`${kind}\`.\n- Preserve crewctl state/artifact contract.\n- Keep changes incremental and auditable.\n\n## Non-scope\n- Production deployment.\n- External service calls.\n- Unbounded autonomous execution.\n\n## Assumptions\n- This project runs locally as a CLI scaffold.\n- Future OpenClaw workers can reuse the same artifact contract.\n\n## Task Breakdown\n${tasks}\n\n## Acceptance Criteria\n${criteria}\n\n## Allowed Files\n${formatList(state.allowedGlobs)}\n\n## Forbidden Files\n${formatList(state.forbiddenGlobs)}\n\n## Risks\n- State transitions may drift from report contents if not validated.\n- Agent workers may claim checks passed without evidence.\n- Long loops can waste time/token if retry limits fail.\n\n## Next Recommended State\nREADY_FOR_IMPLEMENT\n`;
    writeAgentFile('plan.md', plan);
    const previous = state.status; state.lastCompletedRole = 'planner'; state.currentRole = 'orchestrator'; state.nextRole = 'implementer'; state.status = 'READY_FOR_IMPLEMENT';
    saveState(state); appendHistory(`- ${new Date().toISOString()}: planner/${previous} -> orchestrator/READY_FOR_IMPLEMENT (adaptive plan generated: ${kind})`);
    return log({ ok: true, status: state.status, nextRole: state.nextRole, kind, artifact: '.agent/plan.md' }, options);
  });
}

function cmdRunImplementer(options = {}) {
  return withLock('run-implementer', () => {
    ensureState(); const state = loadState(); applyConfigToState(state);
    if (!['READY_FOR_IMPLEMENT', 'AUDIT_FAILED', 'QC_FAILED'].includes(state.status)) return fail(`Implementer cannot run from ${state.status}`);
    if (state.currentIteration >= state.maxIterations) return block(state, 'Max iterations reached before implementation retry', options);
    const previous = state.status; state.currentRole = 'implementer'; state.status = 'IMPLEMENTING'; state.currentIteration += 1; saveState(state);
    appendHistory(`- ${new Date().toISOString()}: orchestrator/${previous} -> implementer/IMPLEMENTING`);
    const checkResult = validateRequiredFiles();
    const commandChecks = runConfiguredChecks();
    const commandChecksOk = commandChecks.every((c) => c.ok);
    const previousFailures = state.qualityGate.failedReasons?.length ? state.qualityGate.failedReasons.map((x) => `- ${x}`).join('\n') : '- None.';
    const report = `# Implementation Report\n\n## Summary\nDeterministic implementer processed objective: ${state.objective}\n\n## Changed Files\n- .agent/implementation-report.md\n- .agent/workstate.json\n- .agent/history.md\n\n## Decisions\n- Preserve current scaffold contract.\n- Treat validation output and configured checks as implementation evidence.\n- Retry context from previous failures is captured below.\n\n## Previous Failure Context\n${previousFailures}\n\n## Checks Run\n- command: npm run check\n  result: ${checkResult.ok ? 'pass' : 'fail'}\n  notes: ${checkResult.ok ? `Validated ${checkResult.checkedFiles} required files.` : `Missing files: ${checkResult.missing.join(', ')}`}\n\n## Configured Command Checks\n${summarizeChecks(commandChecks)}\n\n## Known Issues\n${checkResult.ok && commandChecksOk ? '- None from scaffold/configured validation.' : '- One or more required/configured checks failed; audit should inspect this pass carefully.'}\n\n## Next Recommended State\nREADY_FOR_AUDIT\n`;
    writeAgentFile('implementation-report.md', report);
    state.lastCompletedRole = 'implementer'; state.currentRole = 'orchestrator'; state.nextRole = 'auditor'; state.status = 'READY_FOR_AUDIT';
    saveState(state); appendHistory(`- ${new Date().toISOString()}: implementer/IMPLEMENTING -> orchestrator/READY_FOR_AUDIT (implementation report generated)`);
    return log({ ok: true, status: state.status, nextRole: state.nextRole, artifact: '.agent/implementation-report.md', checks: commandChecks }, options);
  });
}

function cmdRunAuditor(options = {}) {
  return withLock('run-auditor', () => {
    ensureState(); const state = loadState(); applyConfigToState(state);
    if (state.status !== 'READY_FOR_AUDIT') return fail(`Auditor can only run from READY_FOR_AUDIT, current status is ${state.status}`);
    const previous = state.status; state.currentRole = 'auditor'; state.status = 'AUDITING'; saveState(state);
    appendHistory(`- ${new Date().toISOString()}: orchestrator/${previous} -> auditor/AUDITING`);
    const plan = readText('.agent/plan.md'); const implementation = readText('.agent/implementation-report.md'); const checkResult = validateRequiredFiles();
    const forceFail = process.env.CREWCTL_FORCE_AUDIT_FAIL === '1' || plan.includes('CREWCTL_FORCE_AUDIT_FAIL');
    const checks = [
      { name: 'Plan has Acceptance Criteria', pass: plan.includes('## Acceptance Criteria') },
      { name: 'Plan recommends READY_FOR_IMPLEMENT', pass: plan.includes('READY_FOR_IMPLEMENT') },
      { name: 'Implementation report exists', pass: implementation.includes('# Implementation Report') },
      { name: 'Implementation checks passed', pass: implementation.includes('result: pass') },
      { name: 'Configured command checks section exists', pass: implementation.includes('## Configured Command Checks') },
      { name: 'Required scaffold files exist', pass: checkResult.ok },
      { name: 'No forced audit failure', pass: !forceFail }
    ];
    const failed = checks.filter((c) => !c.pass); const verdict = failed.length === 0 ? 'PASS' : 'FAIL';
    const nextState = verdict === 'PASS' ? 'READY_FOR_QC' : 'AUDIT_FAILED'; const nextRole = verdict === 'PASS' ? 'qc' : 'implementer';
    const criteriaLines = checks.map((c) => `- [${c.pass ? 'x' : ' '}] ${c.name}`).join('\n');
    const issues = failed.length ? failed.map((c, i) => `${i + 1}. Severity: medium\n   File: .agent/*\n   Problem: ${c.name} failed.\n   Suggested Fix: Rerun or update previous role output.`).join('\n\n') : '- None.';
    writeAgentFile('audit.md', `# Audit Report\n\n## Verdict\n${verdict}\n\n## Summary\nDeterministic auditor checked plan, implementation report, and scaffold/configured validation evidence.\n\n## Issues\n${issues}\n\n## Acceptance Criteria Check\n${criteriaLines}\n\n## Next Recommended State\n${nextState}\n`);
    state.lastCompletedRole = 'auditor'; state.currentRole = 'orchestrator'; state.nextRole = nextRole; state.status = nextState;
    saveState(state); appendHistory(`- ${new Date().toISOString()}: auditor/AUDITING -> orchestrator/${nextState} (audit ${verdict.toLowerCase()})`);
    return log({ ok: true, verdict, status: state.status, nextRole: state.nextRole, artifact: '.agent/audit.md' }, options);
  });
}

function cmdRunQc(options = {}) {
  return withLock('run-qc', () => {
    ensureState(); const state = loadState(); applyConfigToState(state);
    if (state.status !== 'READY_FOR_QC') return fail(`QC can only run from READY_FOR_QC, current status is ${state.status}`);
    const previous = state.status; state.currentRole = 'qc'; state.status = 'QC'; saveState(state);
    appendHistory(`- ${new Date().toISOString()}: orchestrator/${previous} -> qc/QC`);
    const audit = readText('.agent/audit.md'); const implementation = readText('.agent/implementation-report.md'); const checkResult = validateRequiredFiles();
    const forceFail = process.env.CREWCTL_FORCE_QC_FAIL === '1';
    const commandCheckFailure = implementation.includes(': fail (');
    const hardChecks = [
      { name: 'Required files exist', pass: checkResult.ok, penalty: 30, routeBackTo: 'implementer' },
      { name: 'Audit verdict is PASS', pass: audit.includes('## Verdict\nPASS'), penalty: 35, routeBackTo: 'implementer' },
      { name: 'Implementation report has passing check evidence', pass: implementation.includes('result: pass'), penalty: 20, routeBackTo: 'implementer' },
      { name: 'Configured command checks did not fail', pass: !commandCheckFailure, penalty: 25, routeBackTo: 'implementer' },
      { name: 'Audit recommends READY_FOR_QC', pass: audit.includes('READY_FOR_QC'), penalty: 10, routeBackTo: 'auditor' },
      { name: 'Workflow iteration is within maxIterations', pass: state.currentIteration <= state.maxIterations, penalty: 50, routeBackTo: 'human' },
      { name: 'No forced QC failure', pass: !forceFail, penalty: 90, routeBackTo: 'implementer' }
    ];
    const failed = hardChecks.filter((c) => !c.pass); const score = Math.max(0, 100 - failed.reduce((s, c) => s + c.penalty, 0));
    const threshold = state.qualityGate.minScore ?? 85; const passed = failed.length === 0 && score >= threshold;
    const failureReasons = failed.map((c) => c.name); const routeBackTo = passed ? null : (failed[0]?.routeBackTo ?? 'implementer');
    const qc = { score, passed, threshold, categories: { correctness: failed.some((c) => c.name.includes('Audit')) ? 10 : 30, tests: implementation.includes('result: pass') ? 20 : 0, architecture: audit.includes('READY_FOR_QC') ? 20 : 10, maintainability: checkResult.ok ? 15 : 0, security: 15 }, failureReasons, routeBackTo };
    writeAgentFile('qc.json', `${JSON.stringify(qc, null, 2)}\n`);
    state.lastCompletedRole = 'qc'; state.currentRole = passed ? 'done' : 'orchestrator'; state.nextRole = passed ? null : routeBackTo; state.status = passed ? 'DONE' : 'QC_FAILED';
    state.qualityGate.lastScore = score; state.qualityGate.failedReasons = failureReasons;
    if (!passed && state.currentIteration >= state.maxIterations) applyBlock(state, 'Max iterations reached during QC', failureReasons);
    saveState(state); appendHistory(`- ${new Date().toISOString()}: qc/QC -> ${state.currentRole}/${state.status} (score ${score}/${threshold})`);
    return log({ ok: true, passed, score, status: state.status, nextRole: state.nextRole, artifact: '.agent/qc.json' }, options);
  });
}

function applyBlock(state, reason, failureReasons = []) { state.status = 'BLOCKED'; state.currentRole = 'orchestrator'; state.nextRole = null; state.blockers ??= []; state.blockers.push({ reason, failureReasons, at: new Date().toISOString() }); }
function block(state, reason, options = {}) { applyBlock(state, reason, state.qualityGate.failedReasons ?? []); saveState(state); appendHistory(`- ${new Date().toISOString()}: orchestrator -> orchestrator/BLOCKED (${reason})`); return log({ ok: false, status: 'BLOCKED', reason }, options); }
function fail(reason) { console.error(JSON.stringify({ ok: false, reason }, null, 2)); process.exitCode = 1; }

function cmdNewTask() {
  return withLock('new-task', () => {
    ensureState(); const objective = process.argv.slice(3).join(' ').trim();
    if (!objective) return fail('Missing objective. Usage: node src/runner.mjs new-task "Build feature"');
    const state = loadState(); const previousStatus = state.status; const nextIteration = (state.taskCounter ?? 0) + 1; const taskId = `task-${String(nextIteration).padStart(3, '0')}`;
    applyConfigToState(state);
    state.objective = objective; state.status = 'PLANNING'; state.currentIteration = 0; state.currentRole = 'planner'; state.lastCompletedRole = 'orchestrator'; state.nextRole = 'planner';
    state.activeTask = { id: taskId, title: objective, priority: 'normal' }; state.taskCounter = nextIteration; state.qualityGate.lastScore = null; state.qualityGate.failedReasons = []; state.blockers = [];
    writeAgentFile('plan.md', `# Plan\n\nPending planner output for: ${objective}\n`); writeAgentFile('implementation-report.md', '# Implementation Report\n\nPending.\n'); writeAgentFile('audit.md', '# Audit Report\n\nPending.\n');
    writeAgentFile('qc.json', `${JSON.stringify({ score: null, passed: false, threshold: state.qualityGate.minScore ?? 85, categories: { correctness: 0, tests: 0, architecture: 0, maintainability: 0, security: 0 }, failureReasons: [], routeBackTo: null }, null, 2)}\n`);
    saveState(state); appendHistory(`- ${new Date().toISOString()}: orchestrator/${previousStatus} -> planner/PLANNING (new task ${taskId}: ${objective})`);
    console.log(JSON.stringify({ ok: true, taskId, status: state.status, nextRole: state.nextRole, objective, config: loadConfig() }, null, 2));
  });
}

function cmdContinue({ quiet = false } = {}) {
  ensureState(); const state = loadState(); const options = { quiet };
  switch (state.status) {
    case 'PLANNING': return cmdRunPlanner(options);
    case 'READY_FOR_IMPLEMENT': case 'QC_FAILED': case 'AUDIT_FAILED': return cmdRunImplementer(options);
    case 'READY_FOR_AUDIT': return cmdRunAuditor(options);
    case 'READY_FOR_QC': return cmdRunQc(options);
    case 'DONE': case 'BLOCKED': return log({ ok: true, status: state.status, nextRole: state.nextRole, reason: 'No continuation needed.' }, options);
    default: return fail(`No continuation handler for current status: ${state.status}`);
  }
}

function cmdRun() {
  ensureState(); const maxStepsArg = Number.parseInt(process.argv[3] ?? '', 10); const maxSteps = Number.isFinite(maxStepsArg) ? maxStepsArg : 20; const steps = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const before = loadState();
    if (before.status === 'DONE' || before.status === 'BLOCKED') return console.log(JSON.stringify({ ok: true, finalStatus: before.status, steps, reason: 'Stop condition reached before next step.' }, null, 2));
    cmdContinue({ quiet: true }); const after = loadState();
    steps.push({ step: step + 1, from: before.status, to: after.status, role: after.lastCompletedRole, nextRole: after.nextRole });
    if (after.status === 'DONE' || after.status === 'BLOCKED') return console.log(JSON.stringify({ ok: true, finalStatus: after.status, steps }, null, 2));
  }
  const state = loadState(); console.error(JSON.stringify({ ok: false, finalStatus: state.status, steps, reason: `Max steps reached (${maxSteps})` }, null, 2)); process.exitCode = 1;
}

function resolveRoleFromState(state) {
  if (state.status === 'PLANNING') return 'planner';
  if (state.status === 'READY_FOR_IMPLEMENT' || state.status === 'AUDIT_FAILED' || state.status === 'QC_FAILED') return 'implementer';
  if (state.status === 'READY_FOR_AUDIT') return 'auditor';
  if (state.status === 'READY_FOR_QC') return 'qc';
  return state.nextRole;
}

function cmdRolePrompt() {
  ensureState();
  const state = loadState();
  const role = process.argv[3] ?? resolveRoleFromState(state);
  if (!role) return fail('Could not resolve role for prompt generation.');
  const promptPath = path.join(root, 'prompts', `${role}.md`);
  if (!fs.existsSync(promptPath)) return fail(`Missing prompt file for role: ${role}`);
  const rolePrompt = fs.readFileSync(promptPath, 'utf8');
  const payload = {
    role,
    status: state.status,
    objective: state.objective,
    activeTask: state.activeTask,
    nextRole: state.nextRole,
    filesToRead: ['.agent/workstate.json', '.agent/context.md', '.agent/plan.md', '.agent/implementation-report.md', '.agent/audit.md', '.agent/qc.json', `templates/${role}.md`, `prompts/${role}.md`, 'crewctl.config.json'],
    requiredArtifact: role === 'planner' ? '.agent/plan.md' : role === 'implementer' ? '.agent/implementation-report.md' : role === 'auditor' ? '.agent/audit.md' : '.agent/qc.json',
    allowedGlobs: state.allowedGlobs,
    forbiddenGlobs: state.forbiddenGlobs,
    config: loadConfig(),
    prompt: rolePrompt
  };
  console.log(JSON.stringify(payload, null, 2));
}

function cmdCompleteRole() {
  return withLock('complete-role', () => {
    ensureState();
    const state = loadState(); applyConfigToState(state);
    const role = process.argv[3] ?? resolveRoleFromState(state);
    const verdict = (process.argv[4] ?? 'pass').toLowerCase();
    if (!role) return fail('Missing role for completion.');
    const transitions = {
      planner: { pass: { status: 'READY_FOR_IMPLEMENT', nextRole: 'implementer' }, fail: { status: 'BLOCKED', nextRole: null } },
      implementer: { pass: { status: 'READY_FOR_AUDIT', nextRole: 'auditor' }, fail: { status: 'BLOCKED', nextRole: null } },
      auditor: { pass: { status: 'READY_FOR_QC', nextRole: 'qc' }, fail: { status: 'AUDIT_FAILED', nextRole: 'implementer' } },
      qc: { pass: { status: 'DONE', nextRole: null }, fail: { status: 'QC_FAILED', nextRole: 'implementer' } }
    };
    const mapping = transitions[role]; if (!mapping) return fail(`Unknown role: ${role}`);
    const transition = verdict === 'pass' ? mapping.pass : mapping.fail; const previousStatus = state.status;
    if (role === 'implementer' && state.currentIteration >= state.maxIterations && verdict !== 'pass') {
      applyBlock(state, 'Max iterations reached during manual worker completion', state.qualityGate.failedReasons ?? []);
    } else {
      state.lastCompletedRole = role; state.currentRole = verdict === 'pass' && role === 'qc' ? 'done' : 'orchestrator'; state.status = transition.status; state.nextRole = transition.nextRole;
      if (role === 'implementer' && previousStatus !== 'READY_FOR_AUDIT') state.currentIteration += 1;
      if (verdict !== 'pass') state.qualityGate.failedReasons = [`Manual ${role} completion marked as fail`];
      if (state.status === 'BLOCKED') applyBlock(state, `Manual ${role} completion failed`, state.qualityGate.failedReasons ?? []);
    }
    saveState(state); appendHistory(`- ${new Date().toISOString()}: manual ${role}/${previousStatus} -> ${state.currentRole}/${state.status} (${verdict})`);
    console.log(JSON.stringify({ ok: true, role, verdict, status: state.status, nextRole: state.nextRole }, null, 2));
  });
}

function cmdOpenClawAdapter() {
  ensureState(); const state = loadState(); const config = loadConfig();
  const adapter = { project: state.project, status: state.status, next: getNext(state), resolvedRole: resolveRoleFromState(state), runtime: config.runtime, roleCommandMap: { planner: 'npm run agent:run-planner', implementer: 'npm run agent:run-implementer', auditor: 'npm run agent:run-auditor', qc: 'npm run agent:run-qc' }, artifacts: REQUIRED_FILES.filter((p) => p.startsWith('.agent/')), suggestedPrompt: `Run crewctl for objective: ${state.objective}. Read .agent/workstate.json, execute the next role, update required artifacts, then report status.` };
  console.log(JSON.stringify(adapter, null, 2));
}

const command = process.argv[2] ?? 'status';
switch (command) {
  case 'init': cmdInit(); break; case 'status': cmdStatus(); break; case 'next': cmdNext(); break; case 'transition': cmdTransition(); break; case 'validate': cmdValidate(); break;
  case 'checks': cmdChecks(); break;
  case 'run-planner': cmdRunPlanner(); break; case 'run-implementer': cmdRunImplementer(); break; case 'run-auditor': cmdRunAuditor(); break; case 'run-qc': cmdRunQc(); break;
  case 'new-task': cmdNewTask(); break; case 'continue': cmdContinue(); break; case 'run': cmdRun(); break; case 'role-prompt': cmdRolePrompt(); break; case 'complete-role': cmdCompleteRole(); break; case 'openclaw-adapter': cmdOpenClawAdapter(); break;
  default: console.error(`Unknown command: ${command}`); process.exitCode = 1;
}
