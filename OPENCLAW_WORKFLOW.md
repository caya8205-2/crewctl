# OpenClaw Workflow

Crewctl is designed as a portable workflow/state engine. OpenClaw is the intended first runtime adapter for real AI workers.

Crewctl does **not** include built-in provider clients yet. There is no OpenAI/Anthropic/OpenRouter endpoint integration in the core code. OpenClaw should provide model/tool execution, while crewctl owns workflow state and artifacts.

## Responsibilities

### Crewctl
- state machine
- workflow routing
- retry/block rules
- artifact contracts
- role prompts
- completion transitions
- lock guard
- source-of-truth references

### OpenClaw
- run the main orchestrator
- spawn role workers/subagents
- provide model/provider access
- provide tool/file access
- report progress back to the user

## Basic OpenClaw Flow

1. Start or inspect a task:
   ```bash
   npm run agent:new-task -- "<objective>"
   npm run agent:status
   ```

2. Get current adapter state and durable source-of-truth reference:
   ```bash
   npm run agent:runtime-adapter
   npm run agent:openclaw-adapter
   npm run agent:source-of-truth
   ```

3. Generate current role prompt:
   ```bash
   npm run agent:role-prompt
   ```

4. Spawn a role worker/subagent in OpenClaw using the generated prompt.

5. Worker reads required files and updates required artifacts.

6. Mark the role complete:
   ```bash
   npm run agent:complete-role -- <role> pass
   ```

   Crewctl will validate the role artifact before accepting a `pass` completion.

   Or fail it:
   ```bash
   npm run agent:complete-role -- <role> fail
   ```

7. Repeat until:
   - `DONE`
   - `BLOCKED`

## Role Handoff

| State | Role | Required artifact | Completion command |
|---|---|---|---|
| `PLANNING` | planner | `.agent/plan.md` | `npm run agent:complete-role -- planner pass` |
| `READY_FOR_IMPLEMENT` | implementer | `.agent/implementation-report.md` + code changes | `npm run agent:complete-role -- implementer pass` |
| `READY_FOR_AUDIT` | auditor | `.agent/audit.md` | `npm run agent:complete-role -- auditor pass` |
| `READY_FOR_QC` | qc | `.agent/qc.json` | `npm run agent:complete-role -- qc pass` |
| `AUDIT_FAILED` | implementer | `.agent/implementation-report.md` | `npm run agent:complete-role -- implementer pass` |
| `QC_FAILED` | implementer | `.agent/implementation-report.md` | `npm run agent:complete-role -- implementer pass` |

## Worker Rules

Every worker must:
- read `.agent/workstate.json`
- read its role prompt under `prompts/`
- read its role contract under `templates/`
- update only its required artifact and allowed files
- never edit forbidden files
- never fake check results
- include evidence for claims

## Suggested Orchestrator Loop

Pseudo-flow for OpenClaw main agent:

```txt
while state not DONE/BLOCKED:
  run: npm run agent:runtime-adapter
  run: npm run agent:source-of-truth
  run: npm run agent:role-prompt
  spawn role subagent with generated prompt
  wait for subagent completion
  inspect changed artifact
  if artifact valid:
    run: npm run agent:complete-role -- <role> pass
  else:
    run: npm run agent:complete-role -- <role> fail

`agent:complete-role -- <role> pass` should be treated as a guarded transition, not a blind state advance.
```

## Why no provider endpoint yet?

Crewctl should not pretend to support providers before the code exists. Provider/model execution currently belongs to OpenClaw. If crewctl later becomes standalone, provider clients can be added as a separate adapter layer.

Potential future standalone provider layer:

```txt
providers/
  openrouter.mjs
  openai.mjs
  anthropic.mjs
```

But that is intentionally out of scope for the current OpenClaw-first design.
