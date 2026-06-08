# Crewctl

State-machine based coding-agent orchestration scaffold.

## What this is

`crewctl` is a lightweight workflow engine for coding agents.

Current focus:
- deterministic workflow first
- machine-readable state
- human-readable handoff artifacts
- role-based pipeline: planner -> implementer -> auditor -> qc
- portable core with OpenClaw as the intended first runtime adapter

Important: crewctl does **not** include built-in provider clients yet. There is no OpenAI/Anthropic/OpenRouter endpoint integration in the core code. Provider/model execution is currently expected to come from OpenClaw or another external runtime.

---

![Diagram](crewctl-diagram.png)

## Current status

Current phase: local deterministic scaffold.

Already implemented:
- repo scaffold
- `.agent/` artifact structure
- state machine file
- runner CLI
- lock guard for state mutations
- planner dummy executor
- implementer dummy executor
- role contract templates
- history logging

Not implemented yet:
- real hard checks beyond basic file validation
- real AI workers
- full OpenClaw-native orchestration wrapper

## Repo structure

```txt
.agent/
  workstate.json
  context.md
  plan.md
  implementation-report.md
  audit.md
  qc.json
  history.md
src/
  runner.mjs
templates/
  planner.md
  implementer.md
  auditor.md
  qc.md
prompts/
  planner.md
  implementer.md
  auditor.md
  qc.md
examples/
  demo-happy-path.md
  demo-failure-path.md
tests/
  smoke.mjs
crewctl.config.json
README.md
ROADMAP.md
PROMPT_DIAGRAM.md
OPENCLAW_ADAPTER.md
OPENCLAW_WORKFLOW.md
REAL_WORKERS.md
package.json
```

## Commands

```bash
npm run agent:init
npm run agent:status
npm run agent:next
npm run agent:plan
npm run agent:implement
npm run agent:audit
npm run agent:qc
npm run agent:run-planner
npm run agent:run-implementer
npm run agent:run-auditor
npm run agent:run-qc
npm run agent:new-task -- "Build something"
npm run agent:continue
npm run agent:run
npm run agent:role-prompt
npm run agent:complete-role -- planner pass
npm run agent:openclaw-adapter
npm run agent:checks
npm run check
npm run test:smoke
```

## Core concept

- `workstate.json` = machine-readable workflow state
- Markdown / JSON artifacts = human-readable and machine-readable handoff outputs
- `runner.mjs` = deterministic transition helper and local executor entrypoint
- `.agent/run.lock` = mutation guard to reduce race conditions
- role contracts live in `templates/`
- actual AI workers can be plugged in later without changing the core artifact contract
- real worker handoff is documented in `REAL_WORKERS.md`
- workflow/runtime/check defaults live in `crewctl.config.json`

## Workflow shape

```txt
INIT
 -> PLANNING
 -> READY_FOR_IMPLEMENT
 -> IMPLEMENTING
 -> READY_FOR_AUDIT
 -> AUDITING
 -> READY_FOR_QC
 -> QC
 -> DONE
```

Failure paths later:
- `AUDIT_FAILED`
- `QC_FAILED`
- `BLOCKED`

## OpenClaw-first integration

Crewctl's intended first real-worker path is OpenClaw:

```txt
OpenClaw orchestrator
  -> npm run agent:role-prompt
  -> spawn role subagent
  -> worker updates artifact
  -> npm run agent:complete-role -- <role> pass/fail
  -> repeat until DONE/BLOCKED
```

See:
- `OPENCLAW_WORKFLOW.md`
- `OPENCLAW_ADAPTER.md`
- `prompts/openclaw-orchestrator.md`

## Long-term direction

This project can go in two compatible directions:

1. **Independent repo/tool**
   - portable orchestration engine
   - usable outside OpenClaw

2. **OpenClaw-integrated runtime**
   - OpenClaw acts as orchestrator/adapter
   - role workers can run as subagents
   - same artifact/state contract stays intact

## Next steps

See `ROADMAP.md` for phased development.
