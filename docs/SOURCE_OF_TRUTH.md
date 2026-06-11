# Crewctl Source of Truth

_Last updated: 2026-06-09 04:55 WIB by Petrik_

This document is the durable source of truth for the `crewctl` PoC. It exists so planning survives lost chat context, interrupted OpenClaw goals, and long implementation sessions.

## Product Definition

`crewctl` is a portable coding-agent orchestration engine.

It owns:

- deterministic workflow state
- role routing
- artifact contracts
- retry/block handling
- evidence capture
- quality gates
- runtime adapter metadata

It does **not** own provider/model execution yet. OpenClaw or another runtime supplies workers and tools.

## Current PoC Thesis

A useful coding-agent system should keep the control plane deterministic even when workers are AI agents.

Crewctl therefore separates:

1. **Control plane**: local CLI state machine, artifacts, guarded transitions, checks.
2. **Worker plane**: deterministic dummy workers now; OpenClaw subagents or other AI workers later.
3. **Evidence plane**: structured check results and human-readable reports used by audit/QC.

## Implemented Concepts

### Deterministic state machine

Implemented in `src/runner.mjs` with these states:

- `INIT`
- `PLANNING`
- `READY_FOR_IMPLEMENT`
- `IMPLEMENTING`
- `READY_FOR_AUDIT`
- `AUDITING`
- `READY_FOR_QC`
- `QC`
- `DONE`
- `AUDIT_FAILED`
- `QC_FAILED`
- `BLOCKED`

### Role pipeline

- planner -> `.agent/plan.md`
- implementer -> `.agent/implementation-report.md` and `.agent/check-results.json`
- auditor -> `.agent/audit.md`
- qc -> `.agent/qc.json`

### Runner commands

Core commands:

- `npm run agent:new-task -- "<objective>"`
- `npm run agent:continue`
- `npm run agent:run`
- `npm run agent:status`
- `npm run agent:role-prompt`
- `npm run agent:complete-role -- <role> pass|fail`
- `npm run agent:openclaw-adapter`
- `npm run agent:checks`
- `npm run check`
- `npm run test:smoke`

### Safety/quality mechanisms

- `.agent/run.lock` prevents concurrent mutations.
- `maxIterations` can block repeated retry loops.
- `agent:complete-role -- <role> pass` validates role artifacts before transitioning.
- `.agent/check-results.json` stores structured evidence from required-file and configured command checks.
- QC reads structured evidence instead of trusting only prose.

## Current Gaps

1. `ROADMAP.md` lags behind the implementation.
2. Configured checks are present but empty in `crewctl.config.json`.
3. OpenClaw orchestration is documented but not implemented as a real wrapper.
4. Adapter output is useful but still shallow; it should expose required artifact, next commands, validation command, and stop conditions.
5. No durable planning/reference document existed before this file.
6. No publish-readiness checklist yet.

## Reference Projects and Patterns

### OpenClaw TaskFlow

Local skill: `skills/taskflow/SKILL.md`

Relevant ideas:

- durable job identity
- persisted state bag
- child task linkage
- waiting/resume/finish/fail lifecycle
- revision-aware mutations

Crewctl should borrow the durable orchestration mindset, but keep coding-agent specifics in crewctl artifacts.

### agent-pipeline

Repository: `https://github.com/zzamify/agent-pipeline`

Search description found:

> Zero-dependency pipeline framework for multi-phase AI agent workflows. State machine orchestration, human-in-the-loop gates, and auto-retry. No LLM in the control plane.

Why it matters:

- closest vocabulary match to crewctl
- validates the idea that the control plane should not be an LLM
- supports human gates and retry as first-class pipeline concepts

### Plandex

Repository: `https://github.com/plandex-ai/plandex`

Relevant ideas:

- persistent planning for large projects
- durable context across coding sessions
- plan-first coding workflow

Crewctl should borrow the concept of plans as stable artifacts, not ephemeral chat context.

### SWE-agent

Repository: `https://github.com/SWE-agent/SWE-agent`

Relevant ideas:

- issue/task oriented software engineering loop
- evaluation-focused agent workflow
- final result should be tied to evidence, not conversation claims

### OpenHands

Repository: `https://github.com/All-Hands-AI/OpenHands`

Relevant ideas:

- autonomous software engineering runtime
- workspace/task execution framing
- separation between environment and agent logic

### Aider / Qwen Code / Gemini CLI

Repositories:

- `https://github.com/Aider-AI/aider`
- `https://github.com/QwenLM/qwen-code`
- `https://github.com/google-gemini/gemini-cli`

Relevant ideas:

- terminal-native developer UX
- clear command vocabulary
- local repo editing workflow

## Design Decisions

### Decision 1: Crewctl owns state; OpenClaw owns execution

OpenClaw can spawn subagents and provide tools, but crewctl remains the source of truth for status and transitions.

### Decision 2: Artifacts are required, not decorative

Each role must update its required artifact. Completion is guarded by artifact validation.

### Decision 3: Evidence must be structured

Human-readable reports are useful, but QC should depend on `.agent/check-results.json` and configured checks where possible.

### Decision 4: The PoC should prioritize orchestration integrity over model integration

Provider clients are intentionally out of scope for the current PoC. OpenClaw already supplies model/tool execution.

## Rapid PoC Scope

The immediate PoC should prove:

1. A task can move through a deterministic role pipeline.
2. Real/OpenClaw workers can be handed a role prompt and required artifact.
3. `complete-role pass` cannot blindly advance without artifact evidence.
4. QC can fail/retry/block using structured evidence.
5. Adapter output is rich enough for an OpenClaw orchestrator to drive the loop.
6. Roadmap and source-of-truth docs stay updated as implementation changes.

## Next Implementation Priorities

1. Improve `agent:openclaw-adapter` output with richer orchestration metadata.
2. Add `agent:source-of-truth` command to print this document path and current source refs.
3. Add publish/PoC readiness docs and update `ROADMAP.md` statuses.
4. Configure `crewctl.config.json` to run at least `npm run check` and `npm run test:smoke` via the existing check mechanism without recursion hazards.
5. Add tests for richer adapter output and source-of-truth command.

## Update Rule

Whenever a significant feature or decision changes, update this file and `ROADMAP.md` before ending the implementation session.
