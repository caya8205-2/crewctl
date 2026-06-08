# Demo: Failure Path

## Goal
Verify retry and blocked behavior.

## Forced Audit Failure

```powershell
$env:CREWCTL_FORCE_AUDIT_FAIL='1'
npm run agent:new-task -- "Test forced audit failure"
npm run agent:run
Remove-Item Env:CREWCTL_FORCE_AUDIT_FAIL
```

### Expected Outcome
- audit fails repeatedly
- implementer retries
- workflow eventually reaches `BLOCKED`

## Forced QC Failure

```powershell
$env:CREWCTL_FORCE_QC_FAIL='1'
npm run agent:new-task -- "Test forced qc failure"
npm run agent:run 6
Remove-Item Env:CREWCTL_FORCE_QC_FAIL
npm run agent:run
```

### Expected Outcome
- first run stops before done or loops through `QC_FAILED`
- second run without forced fail can complete to `DONE`
