import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function run(args, env = {}) {
  return execFileSync('node', ['src/runner.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, ...env }
  });
}

function runCli(args, cwd = root) {
  return execFileSync('node', [path.join(root, 'bin/crewctl.mjs'), ...args], {
    cwd,
    encoding: 'utf8'
  });
}

function state() {
  return JSON.parse(fs.readFileSync(path.join(root, '.agent/workstate.json'), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

console.log('smoke: happy path');
run(['new-task', 'Smoke happy path']);
run(['run']);
assert(state().status === 'DONE', 'happy path should end at DONE');

console.log('smoke: forced QC recovery path');
run(['new-task', 'Smoke forced qc failure']);
try {
  run(['run', '6'], { CREWCTL_FORCE_QC_FAIL: '1' });
} catch {
  // expected: max steps may be reached before final state
}
const mid = state();
assert(['QC_FAILED', 'READY_FOR_AUDIT', 'READY_FOR_QC'].includes(mid.status), `unexpected mid failure state: ${mid.status}`);
run(['run']);
assert(state().status === 'DONE', 'qc recovery should end at DONE after force flag is removed');

console.log('smoke: manual/OpenClaw handoff guard');
run(['new-task', 'Smoke manual completion guard']);
let manualGuardFailed = false;
try {
  run(['complete-role', 'planner', 'pass']);
} catch (error) {
  const output = `${error.stdout ?? ''}${error.stderr ?? ''}`;
  manualGuardFailed = output.includes('Role artifact validation failed.');
}
assert(manualGuardFailed, 'planner pass should fail when plan artifact is still placeholder');
run(['run-planner']);
run(['complete-role', 'planner', 'pass']);
assert(state().status === 'READY_FOR_IMPLEMENT', 'planner pass should succeed after valid plan artifact exists');

console.log('smoke: runtime adapter output');
const runtimeAdapter = JSON.parse(run(['runtime-adapter']));
assert(runtimeAdapter.project === 'crewctl', 'runtime adapter project should be crewctl');
assert(runtimeAdapter.adapter === 'openclaw', 'runtime adapter should default to preferred adapter');
assert(runtimeAdapter.adapterContract.controlPlane.includes('crewctl CLI'), 'runtime adapter should expose control plane contract');

console.log('smoke: OpenClaw adapter compatibility output');
const adapter = JSON.parse(run(['openclaw-adapter']));
assert(adapter.project === 'crewctl', 'adapter project should be crewctl');
assert(adapter.adapter === 'openclaw', 'OpenClaw adapter alias should select openclaw');
assert(adapter.roleCommandMap.planner, 'adapter should include planner command');
assert(adapter.stopConditions.includes('DONE'), 'adapter should expose stop conditions');
assert(adapter.sourceOfTruth.primaryDoc === 'docs/SOURCE_OF_TRUTH.md', 'adapter should expose source of truth');

console.log('smoke: source of truth output');
const sourceOfTruth = JSON.parse(run(['source-of-truth']));
assert(sourceOfTruth.primaryDoc === 'docs/SOURCE_OF_TRUTH.md', 'source of truth command should point at primary doc');
assert(sourceOfTruth.references.includes('ROADMAP.md'), 'source of truth command should include roadmap reference');

console.log('smoke: CLI init and doctor');
const tmpRoot = path.join(root, '.tmp-smoke');
fs.rmSync(tmpRoot, { recursive: true, force: true });
fs.mkdirSync(tmpRoot, { recursive: true });
try {
  const init = JSON.parse(runCli(['init', '--target', tmpRoot, '--objective', 'Smoke external repo']));
  assert(init.ok === true, 'cli init should succeed');
  assert(fs.existsSync(path.join(tmpRoot, '.agent/workstate.json')), 'cli init should create workstate');
  assert(fs.existsSync(path.join(tmpRoot, 'templates/planner.md')), 'cli init should copy templates');
  const doctor = JSON.parse(runCli(['doctor', '--target', tmpRoot]));
  assert(doctor.ok === true, 'doctor should report scaffold as enabled');
  assert(doctor.state.status === 'INIT', 'doctor should report INIT status');
} finally {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
}

console.log('smoke: ok');
