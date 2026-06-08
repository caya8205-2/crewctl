# Plan

## Objective
Smoke forced qc failure

## Scope
- Implement objective-specific progress for kind: `failure-path`.
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
1. Add explicit AUDIT_FAILED and QC_FAILED routing
2. Ensure retries increment iteration safely
3. Block when maxIterations is reached
4. Create test scenarios for forced audit/QC failures
5. Inspect current state and artifacts
6. Implement the smallest useful change
7. Record evidence in implementation report
8. Audit output against acceptance criteria
9. Run QC and route pass/fail

## Acceptance Criteria
- `npm run check` validates required files
- `npm run agent:status` prints current state
- Workflow history records role transitions
- AUDIT_FAILED routes back to implementer
- QC_FAILED routes back to implementer or BLOCKED
- Max iteration guard can block repeated failures

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
