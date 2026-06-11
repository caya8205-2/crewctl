# Runtime Adapters

_Last updated: 2026-06-11 by Codex_

Crewctl is a portable workflow control plane. Runtime adapters are the boundary between crewctl's deterministic state machine and an external agent/runtime that can execute work.

## What crewctl owns

- workflow state and transitions
- role resolution
- required artifact contracts
- guarded role completion
- retry and block handling
- lock protection for mutations
- structured evidence and checks

## What a runtime owns

- model/provider execution
- tool access
- role worker or subagent lifecycle
- user-facing progress updates
- platform-specific session management

## Adapter command

Use the runtime-neutral adapter command for new integrations:

```bash
npm run agent:runtime-adapter
```

It emits JSON containing:

- selected adapter name
- current state and next role
- required artifact
- validation and failure commands
- role prompt command
- stop conditions
- source-of-truth references
- role command map
- artifact list
- adapter contract summary

You can request a specific adapter name:

```bash
npm run agent:runtime-adapter -- generic-cli
npm run agent:runtime-adapter -- openclaw
```

## OpenClaw compatibility

OpenClaw remains the first-class adapter. This command is kept as a compatibility alias:

```bash
npm run agent:openclaw-adapter
```

It emits the same adapter contract with `adapter` set to `openclaw`.

## Integration shapes

### OpenClaw

OpenClaw can drive crewctl directly as the native runtime adapter:

1. read `agent:runtime-adapter` or `agent:openclaw-adapter`
2. generate `agent:role-prompt`
3. spawn a role worker/subagent
4. let the worker update required artifacts
5. run `agent:complete-role -- <role> pass|fail`
6. repeat until `DONE` or `BLOCKED`

### Codex skill

A Codex skill can teach Codex how to operate crewctl from the CLI. This is the lightest integration path because it does not require a server or new tool surface.

This repo includes a project-local skill package at `skills/crewctl/`.

Install it for local Codex discovery with:

```bash
npm run skill:install-codex
```

When `crewctl` is installed as a CLI package, use:

```bash
crewctl install-skill codex
```

The skill includes `scripts/probe.py`, a small helper that inspects a crewctl-enabled repo and prints current state/adapter JSON.

The skill should instruct Codex to:

- read `docs/RUNTIME_ADAPTERS.md`
- inspect `.agent/workstate.json`
- call `agent:runtime-adapter`
- use `agent:role-prompt`
- update required artifacts
- complete roles only through `agent:complete-role`

### Codex plugin

A Codex plugin is useful if crewctl needs dedicated tool calls, richer UI affordances, or managed workflow actions such as `crewctl_status`, `crewctl_next_role`, and `crewctl_complete_role`.

The plugin should still call into the same crewctl CLI or a thin local API. It should not duplicate state transition logic.

### MCP server

An MCP server is the best cross-platform adapter once the contract stabilizes. It can expose crewctl operations as tools:

- `get_state`
- `get_runtime_adapter`
- `get_role_prompt`
- `complete_role`
- `run_checks`
- `list_artifacts`

The MCP layer should be a wrapper around crewctl's core contract, not a replacement for it.

## Design rule

Do not put provider/model logic in crewctl core until there is a deliberate provider layer. Runtime adapters may execute models, but crewctl should remain the deterministic control plane.
