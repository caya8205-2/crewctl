# OpenClaw Adapter

Crewctl's core is intentionally portable. OpenClaw can act as an adapter/runtime around the same state and artifact contract.

## Basic mode

OpenClaw can operate crewctl through CLI commands:

```bash
npm run agent:status
npm run agent:next
npm run agent:continue
npm run agent:run
```

## Role mapping

| crewctl role | command | future OpenClaw worker |
|---|---|---|
| planner | `npm run agent:run-planner` | planner subagent |
| implementer | `npm run agent:run-implementer` | implementer subagent |
| auditor | `npm run agent:run-auditor` | auditor subagent |
| qc | `npm run agent:run-qc` | QC subagent |

## Artifact contract

Every worker should read:
- `.agent/workstate.json`
- role template under `templates/`
- relevant previous artifacts

Every worker should update its matching artifact:
- planner -> `.agent/plan.md`
- implementer -> `.agent/implementation-report.md`
- auditor -> `.agent/audit.md`
- qc -> `.agent/qc.json`

## Adapter helper

```bash
npm run agent:openclaw-adapter
npm run agent:source-of-truth
```

`agent:openclaw-adapter` emits a JSON object with current state, next role, required artifact, helper commands, stop conditions, source-of-truth references, role command map, artifact list, and suggested prompt.

`agent:source-of-truth` emits the durable planning/reference anchor so an external orchestrator can recover after context loss.

## Future OpenClaw-native flow

1. User starts a crewctl task from chat.
2. OpenClaw runs `npm run agent:new-task -- "<objective>"`.
3. OpenClaw reads adapter JSON.
4. OpenClaw spawns the right subagent for the current role.
5. Subagent updates artifact.
6. OpenClaw runs validation / transition.
7. OpenClaw can re-read `npm run agent:source-of-truth` if a long session loses conversational context.
8. Repeat until `DONE` or `BLOCKED`.

## Safety notes

- Crewctl uses `.agent/run.lock` for mutation guard.
- OpenClaw should not run multiple crewctl mutations in parallel.
- Subagents should not edit forbidden files from `workstate.json`.
