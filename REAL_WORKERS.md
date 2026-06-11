# Real Worker Mode

Crewctl can run in two modes:

1. **Deterministic mode** - local dummy executors (`agent:run-planner`, `agent:run-implementer`, etc.)
2. **Real worker mode** - external AI/runtime workers update artifacts, then crewctl records role completion

## Generate a role prompt

```bash
npm run agent:role-prompt
```

This resolves the current role from `.agent/workstate.json` and emits JSON containing:
- role
- status
- objective
- files to read
- required output artifact
- allowed/forbidden globs
- the role prompt text
- the durable source-of-truth doc in `docs/SOURCE_OF_TRUTH.md`

You can also request a role explicitly:

```bash
node src/runner.mjs role-prompt planner
node src/runner.mjs role-prompt implementer
node src/runner.mjs role-prompt auditor
node src/runner.mjs role-prompt qc
```

## Complete a real worker role

After a real worker updates the required artifact, mark the role complete:

```bash
npm run agent:complete-role -- planner pass
npm run agent:complete-role -- implementer pass
npm run agent:complete-role -- auditor pass
npm run agent:complete-role -- qc pass
```

Failure examples:

```bash
npm run agent:complete-role -- auditor fail
npm run agent:complete-role -- qc fail
```

## Adapter metadata

Runtime orchestrators should start by reading:

```bash
npm run agent:runtime-adapter
```

OpenClaw can also use the compatibility alias:

```bash
npm run agent:openclaw-adapter
```

## Suggested OpenClaw usage

1. Start task:
   ```bash
   npm run agent:new-task -- "Build feature X"
   ```
2. Generate current role prompt:
   ```bash
   npm run agent:role-prompt
   ```
3. Spawn an OpenClaw subagent with the emitted prompt.
4. Subagent edits the required artifact/files.
5. Mark role complete:
   ```bash
   npm run agent:complete-role -- <role> pass
   ```
6. Repeat until `DONE` or `BLOCKED`.

## Important

Real workers must not fake evidence. If checks were not run, artifacts must say `not-run` instead of `pass`.

`npm run agent:complete-role -- <role> pass` is a guarded transition, not a blind acknowledgement. Workers must produce a valid artifact before the pass transition will be accepted.
