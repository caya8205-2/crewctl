---
name: crewctl
description: Operate crewctl, a local coding-agent workflow control plane. Use when a repository contains crewctl state or commands such as `.agent/workstate.json`, `crewctl.config.json`, `agent:runtime-adapter`, `agent:role-prompt`, `agent:complete-role`, or the user asks Codex to run a crewctl workflow, continue an agent task, inspect planner/implementer/auditor/QC state, integrate crewctl with Codex/OpenClaw/MCP, or use crewctl to coordinate work in another project.
---

# Crewctl

Use crewctl as the source of truth for workflow state. Codex may perform the current role's work, but crewctl owns transitions, artifact validation, retries, locks, and evidence checks.

## Quick Start

1. Confirm the repo is crewctl-enabled. Prefer the bundled probe when available:
   ```bash
   python <path-to-skill>/scripts/probe.py
   ```

   Or run the native crewctl commands:
   ```bash
   npm run agent:status
   npm run agent:runtime-adapter
   ```

2. Read the adapter JSON and note:
   - `status`
   - `resolvedRole`
   - `requiredArtifact`
   - `rolePromptCommand`
   - `validationCommand`
   - `failCommand`
   - `stopConditions`

3. Generate the role prompt:
   ```bash
   npm run agent:role-prompt
   ```

4. Do only the current role's work. Update the required artifact and any clearly allowed files needed for that role.

5. Complete the role through crewctl:
   ```bash
   npm run agent:complete-role -- <role> pass
   ```

   If the role cannot be completed honestly:
   ```bash
   npm run agent:complete-role -- <role> fail
   ```

6. Continue until `DONE`, `BLOCKED`, or the user asks you to stop.

## Operating Rules

- Treat `.agent/workstate.json` as machine-readable state, not a suggestion.
- Do not invent transitions. Use `agent:continue`, `agent:run`, or `agent:complete-role`.
- Do not run mutating crewctl commands in parallel.
- Read `allowedGlobs` and `forbiddenGlobs` before editing.
- Never fake check evidence. If a check was not run, say `not-run`.
- Do not mark a role `pass` until its required artifact is real and current.
- Keep scope to the active role unless the user explicitly changes the task.
- Preserve user changes outside the current role's required work.

## Role Guide

### Planner

Required artifact: `.agent/plan.md`

Produce a plan with objective, scope, non-scope, task breakdown, risks, and acceptance criteria. Do not edit implementation files unless the user explicitly asks for combined planning and implementation.

### Implementer

Required artifact: `.agent/implementation-report.md`

Make the smallest useful implementation change for the current plan. Record changed files, decisions, checks run, check results, known issues, and next recommended state. If structured check evidence is expected, update `.agent/check-results.json` through crewctl's check path or document why it is not available.

### Auditor

Required artifact: `.agent/audit.md`

Review the plan and implementation. Lead with findings if there are issues. Verify evidence instead of trusting report prose. Mark pass only when acceptance criteria and check evidence support it.

### QC

Required artifact: `.agent/qc.json`

Assess final quality against the configured threshold. Use structured evidence from `.agent/check-results.json` when available. Route failures back to the appropriate role.

## Common Commands

```bash
npm run agent:status
npm run agent:runtime-adapter
npm run agent:role-prompt
npm run agent:continue
npm run agent:run
npm run agent:complete-role -- <role> pass
npm run agent:complete-role -- <role> fail
npm run agent:checks
npm run check
```

Bundled helper:

```bash
python <path-to-skill>/scripts/probe.py
```

OpenClaw compatibility:

```bash
npm run agent:openclaw-adapter
```

## Validation

Before handing work back, run the smallest relevant validation:

```bash
npm run check
```

Run smoke coverage when changing crewctl itself:

```bash
npm run test:smoke
```

If PowerShell blocks `npm.ps1`, use `npm.cmd run ...` instead. Do not tell the user their machine is blocked; this can be specific to the agent shell.

## When Integrating Another Runtime

Use `agent:runtime-adapter` as the stable contract. Keep OpenClaw, Codex plugins, and MCP servers as wrappers around the same CLI/state/artifact contract. Do not duplicate transition logic in the wrapper.
