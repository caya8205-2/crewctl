import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const source = path.join(root, 'skills', 'crewctl');
const codexHome = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const targetRoot = process.argv[2] ? path.resolve(process.argv[2]) : path.join(codexHome, 'skills');
const target = path.join(targetRoot, 'crewctl');

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

if (!fs.existsSync(source)) {
  console.error(JSON.stringify({ ok: false, reason: `Missing skill source: ${source}` }, null, 2));
  process.exit(1);
}

if (fs.existsSync(target)) {
  fs.rmSync(target, { recursive: true, force: true });
}

copyDir(source, target);

console.log(JSON.stringify({
  ok: true,
  source,
  target,
  note: 'Restart Codex or refresh skills if the host does not pick up newly installed skills automatically.'
}, null, 2));
