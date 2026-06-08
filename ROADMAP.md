# ROADMAP

## Vision
Build `crewctl` as a reusable coding-agent orchestration engine with deterministic workflow state, structured artifacts, quality gates, and optional OpenClaw integration.

---

## Phase 0 - Bootstrap
Status: in progress

### Goals
- Create repo scaffold
- Define machine-readable state
- Define human-readable artifact files
- Add deterministic runner commands

### Deliverables
- `.agent/workstate.json`
- `.agent/*.md` artifacts
- `src/runner.mjs`
- role contract templates

---

## Phase 1 - Deterministic Local Pipeline

### Goals
- Complete planner / implementer / auditor / QC dummy executors
- Make transitions deterministic and inspectable
- Add bounded retry + blocked state handling

### Deliverables
- `npm run agent:run-planner`
- `npm run agent:run-implementer`
- `npm run agent:run-auditor`
- `npm run agent:run-qc`
- retry policy in `workstate.json`
- history logging for every transition

### Exit Criteria
- Full local workflow can move from `INIT` to `DONE`
- Failure path can route to `AUDIT_FAILED`, `QC_FAILED`, or `BLOCKED`

---

## Phase 2 - Real Checks & Evidence

### Goals
- Replace dummy validation with actual commands
- Make QC depend on real evidence

### Deliverables
- build/typecheck/lint/test command config
- command result capture in artifacts
- failure classification for routing
- acceptance-criteria verification checklist

### Exit Criteria
- Agent cannot pass QC without actual hard-check evidence

---

## Phase 3 - Real Agent Workers

### Goals
- Swap deterministic role executors with real AI workers
- Keep the same state/artifact contract

### Deliverables
- planner worker
- implementer worker
- auditor worker
- QC evaluator worker
- prompt pack per role

### Exit Criteria
- Same pipeline can run with AI workers without changing artifact schema

---

## Phase 4 - OpenClaw Adapter

### Goals
- Use OpenClaw as orchestrator/runtime instead of only local CLI
- Spawn role workers as subagents

### Deliverables
- role -> subagent mapping
- OpenClaw orchestration wrapper
- state-aware subagent handoff
- progress updates via OpenClaw session

### Exit Criteria
- `crewctl` can be operated from OpenClaw end-to-end

---

## Phase 5 - Productization

### Goals
- Make the project usable as an independent repo/tool
- Prepare for public/demo use

### Deliverables
- better CLI UX
- config file support
- docs + examples
- sample workflows
- release/versioning strategy

### Exit Criteria
- New user can clone repo, run scaffold, and understand the workflow quickly

---

## Nice-to-have Later
- branch isolation helpers
- dashboard visualization
- multiple workflow types
- test-writer role
- polisher role
- repo context summarizer
- diff-aware retries
- persistent run storage beyond `.agent/`

