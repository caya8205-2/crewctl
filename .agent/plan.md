# Plan

## Objective
Smoke manual completion guard

## Scope
- Implement objective-specific progress for kind: `general`.
- Preserve crewctl state/artifact contract.
- Keep changes incremental and auditable.

## Non-scope
- Production deployment.
- External service calls.
- Unbounded autonomous execution.

## Assumptions
- This project runs locally as a CLI scaffold.
- Future OpenClaw workers can reuse the same artifact contract.

## Task Breakdown
1. Inspect current state and artifacts
2. Implement the smallest useful change
3. Record evidence in implementation report
4. Audit output against acceptance criteria
5. Run QC and route pass/fail

## Acceptance Criteria
- `npm run check` validates required files
- `npm run agent:status` prints current state
- Workflow history records role transitions
- Run can progress from PLANNING to DONE

## Allowed Files
- src/**
- .agent/**
- templates/**
- README.md
- package.json

## Forbidden Files
- .env*
- secrets/**
- infra/prod/**

## Risks
- State transitions may drift from report contents if not validated.
- Agent workers may claim checks passed without evidence.
- Long loops can waste time/token if retry limits fail.

## Next Recommended State
READY_FOR_IMPLEMENT
