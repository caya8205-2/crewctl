# Demo: Happy Path

## Goal
Run a full crewctl task from planning to done.

## Commands

```bash
npm run agent:new-task -- "Build OpenClaw adapter and failure path"
npm run agent:run
npm run agent:status
```

## Expected Outcome
- State moves from `PLANNING` to `DONE`
- `.agent/plan.md` is generated
- `.agent/implementation-report.md` is generated
- `.agent/audit.md` is generated
- `.agent/qc.json` contains a passing score

## Notes
Use this as the first smoke test after changes to the runner.
