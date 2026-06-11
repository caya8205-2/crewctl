# Crewctl Source of Truth

_Last updated: 2026-06-11 by Codex_

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
- Codex skill draft for operating crewctl

It does **not** own provider/model execution yet. OpenClaw or another runtime supplies workers and tools through the runtime adapter contract.

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
- `npm run agent:runtime-adapter`
- `npm run agent:openclaw-adapter`
- `npm run agent:source-of-truth`
- `npm run agent:checks`
- `npm run check`
- `npm run test:smoke`
- `npm run test:mcp`

### Codex skill

The repo includes a project-local Codex skill package at `skills/crewctl/`. It teaches Codex to operate crewctl through `agent:runtime-adapter`, `agent:role-prompt`, and guarded `agent:complete-role` transitions. The skill includes `scripts/probe.py` for deterministic state/adapter inspection. The CLI exposes `crewctl install-skill codex` so the skill can be installed without relying on a target project's `package.json`.

### npm package

`crewctl` is prepared as an npm CLI package. The package exposes `bin/crewctl.mjs` as the `crewctl` command, includes a controlled `files` whitelist, and uses `crewctl install-skill codex` for Codex skill installation.

### Target project bootstrap

The CLI exposes `crewctl init` to scaffold `.agent/`, `crewctl.config.json`, `templates/`, and `prompts/` into a target repository. `crewctl doctor` checks whether a target repository is crewctl-enabled and reports missing files, state, config, Codex skill install status, and recommended next commands.

### GitHub automation

The repo includes GitHub Actions for CI and manual npm publishing. CI runs required-file validation, smoke coverage, and `npm pack --dry-run`. The publish workflow requires repository secret `NPM_TOKEN` and publishes with npm provenance.

### MCP server

`crewctl-mcp` exposes the command API as MCP tools. Runtime orchestrators should prefer MCP tools when available and fall back to CLI commands when MCP is unavailable.

### Safety/quality mechanisms

- `.agent/run.lock` prevents concurrent mutations.
- `maxIterations` can block repeated retry loops.
- `agent:complete-role -- <role> pass` validates role artifacts before transitioning.
- `.agent/check-results.json` stores structured evidence from required-file and configured command checks.
- QC reads structured evidence instead of trusting only prose.

## Current Gaps

1. Configured checks are present but mostly empty in `crewctl.config.json`.
2. OpenClaw orchestration is documented but not implemented as a real wrapper.
3. Codex skill integration exists as a project-local package, but it is not installed globally until `npm run skill:install-codex` is run.
4. Plugin-specific UI/tool surfaces are not implemented yet; the MCP server is the current structured tool surface.

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

### Decision 1: Crewctl owns state; runtimes own execution

OpenClaw, Codex, MCP clients, or another runtime can provide workers and tools, but crewctl remains the source of truth for status and transitions.

### Decision 2: Artifacts are required, not decorative

Each role must update its required artifact. Completion is guarded by artifact validation.

### Decision 3: Evidence must be structured

Human-readable reports are useful, but QC should depend on `.agent/check-results.json` and configured checks where possible.

### Decision 4: The PoC should prioritize orchestration integrity over model integration

Provider clients are intentionally out of scope for the current PoC. Runtime adapters supply model/tool execution.

### Decision 5: OpenClaw is the first adapter, not the only adapter

`agent:runtime-adapter` is the runtime-neutral contract. `agent:openclaw-adapter` remains as a compatibility alias for OpenClaw-native flows.

## Rapid PoC Scope

The immediate PoC should prove:

1. A task can move through a deterministic role pipeline.
2. Real runtime workers can be handed a role prompt and required artifact.
3. `complete-role pass` cannot blindly advance without artifact evidence.
4. QC can fail/retry/block using structured evidence.
5. Adapter output is rich enough for OpenClaw or another runtime orchestrator to drive the loop.
6. Roadmap and source-of-truth docs stay updated as implementation changes.

## Next Implementation Priorities

1. Try `crewctl init` and `crewctl doctor` on a real external repo, then tighten the workflow from usage.
2. Configure GitHub repository secret `NPM_TOKEN` before using the publish workflow.
3. Publish `crewctl` to npm after reviewing `npm pack --dry-run` contents.
4. Install and try the Codex skill on a real external repo, then tighten the workflow from usage.
5. Try `crewctl-mcp` from a real orchestrator and tighten tool descriptions/input schemas from usage.
6. Implement the OpenClaw orchestration wrapper around the same runtime adapter contract.

## Update Rule

Whenever a significant feature or decision changes, update this file and `ROADMAP.md` before ending the implementation session.
