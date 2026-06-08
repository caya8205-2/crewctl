# ROADMAP

## Vision
Build `crewctl` as a reusable coding-agent orchestration engine with deterministic workflow state, structured artifacts, quality gates, and optional OpenClaw integration.

---

## Phase 0 - Bootstrap
Status: done

### Goals
- Create repo scaffold
- Define machine-readable state
- Define human-readable artifact files
- Add deterministic runner commands

### Deliverables
- `.agent/workstate.json`
- `.agent/*.md` artifacts
- `.agent/check-results.json`
- `src/runner.mjs`
- role contract templates
- role prompts
- source-of-truth docs

---

## Phase 1 - Deterministic Local Pipeline
Status: done

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
- `npm run agent:run`
- `npm run agent:continue`
- forced QC recovery smoke coverage

### Exit Criteria
- Full local workflow can move from `INIT` to `DONE`
- Failure path can route to `AUDIT_FAILED`, `QC_FAILED`, or `BLOCKED`

---

## Phase 2 - Real Checks & Evidence
Status: in progress

### Goals
- Replace dummy validation with actual commands
- Make QC depend on real evidence

### Deliverables
- build/typecheck/lint/test command config
- command result capture in artifacts
- structured `.agent/check-results.json`
- failure classification for routing
- acceptance-criteria verification checklist
- guarded manual role completion

### Exit Criteria
- Agent cannot pass QC without actual hard-check evidence

---

## Phase 3 - Real Agent Workers
Status: in progress

### Goals
- Swap deterministic role executors with real AI workers
- Keep the same state/artifact contract

### Deliverables
- planner worker contract
- implementer worker contract
- auditor worker contract
- QC evaluator worker contract
- prompt pack per role
- `npm run agent:role-prompt`
- `npm run agent:complete-role -- <role> pass|fail`

### Exit Criteria
- Same pipeline can run with AI workers without changing artifact schema

---

## Phase 4 - OpenClaw Adapter
Status: in progress

### Goals
- Use OpenClaw as orchestrator/runtime instead of only local CLI
- Spawn role workers as subagents

### Deliverables
- role -> subagent mapping
- `npm run agent:openclaw-adapter`
- `npm run agent:source-of-truth`
- state-aware subagent handoff docs
- OpenClaw orchestration wrapper
- progress updates via OpenClaw session

### Exit Criteria
- `crewctl` can be operated from OpenClaw end-to-end

---

## Phase 5 - Productization
Status: not started

### Goals
- Make the project usable as an independent repo/tool
- Prepare for public/demo use

### Deliverables
- better CLI UX
- config file support
- docs + examples
- sample workflows
- publishing checklist
- release/versioning strategy

### Exit Criteria
- New user can clone repo, run scaffold, and understand the workflow quickly

---

## Recovered PoC Priorities

These priorities were reconstructed from the implementation state and external/internal source-of-truth audit:

1. Keep the control plane deterministic; do not put LLM/provider logic in core yet.
2. Make artifacts mandatory and guarded, not decorative.
3. Make QC depend on structured evidence.
4. Use OpenClaw as the first real worker runtime through role prompts and adapter metadata.
5. Keep `docs/SOURCE_OF_TRUTH.md` and this roadmap updated before long work ends.

## Nice-to-have Later
- branch isolation helpers
- dashboard visualization
- multiple workflow types
- test-writer role
- polisher role
- repo context summarizer
- diff-aware retries
- persistent run storage beyond `.agent/`

