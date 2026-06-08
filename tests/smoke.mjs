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

console.log('smoke: adapter output');
const adapter = JSON.parse(run(['openclaw-adapter']));
assert(adapter.project === 'crewctl', 'adapter project should be crewctl');
assert(adapter.roleCommandMap.planner, 'adapter should include planner command');

console.log('smoke: ok');
