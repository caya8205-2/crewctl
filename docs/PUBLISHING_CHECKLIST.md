# Publishing / PoC Checklist

_Last updated: 2026-06-09 04:59 WIB by Petrik_

Use this checklist before pushing `crewctl` updates for review/demo.

## Source of truth

- [ ] `docs/SOURCE_OF_TRUTH.md` reflects the latest architecture and decisions
- [ ] `ROADMAP.md` reflects actual implementation status
- [ ] `README.md` reflects the current command set and workflow

## Workflow integrity

- [ ] `npm run check` passes
- [ ] `npm run test:smoke` passes
- [ ] `npm run test:mcp` passes
- [ ] `npm run agent:runtime-adapter` returns valid JSON
- [ ] `npm run agent:openclaw-adapter` returns valid JSON
- [ ] `npm run agent:source-of-truth` returns valid JSON
- [ ] role prompt generation includes `docs/SOURCE_OF_TRUTH.md`
- [ ] `agent:complete-role -- <role> pass` rejects placeholder artifacts
- [ ] `skills/crewctl/SKILL.md` validates as a Codex skill
- [ ] `npm run skill:probe` returns current crewctl state/adapter summary
- [ ] `crewctl install-skill codex` works from an installed or linked package
- [ ] `crewctl init --target <tmp>` creates a complete scaffold
- [ ] `crewctl doctor --target <tmp>` reports the scaffold as enabled

## Evidence quality

- [ ] `.agent/check-results.json` is generated during implementation flow
- [ ] configured checks are captured honestly
- [ ] QC depends on evidence, not just report prose

## OpenClaw readiness

- [ ] `OPENCLAW_WORKFLOW.md` matches current adapter/command behavior
- [ ] `OPENCLAW_ADAPTER.md` matches current adapter payload
- [ ] `REAL_WORKERS.md` documents the guarded completion contract

## Demo framing

- [ ] Vision is clear: deterministic control plane, external worker plane
- [ ] PoC scope is explicit
- [ ] Known gaps are documented instead of hidden

## npm package

- [ ] `package.json` is not private
- [ ] `package.json` has `bin.crewctl`
- [ ] `package.json` has license, repository, keywords, and `files`
- [ ] `LICENSE` exists
- [ ] `npm pack --dry-run` contains only intended package files
- [ ] `npm publish` is run only after reviewing tarball contents

## GitHub

- [ ] CI workflow runs `npm run check`, `npm run test:smoke`, `npm run test:mcp`, and `npm pack --dry-run`
- [ ] npm publish workflow exists and is manual
- [ ] repository secret `NPM_TOKEN` is configured before publishing from GitHub Actions
- [ ] PR template reflects the required validation commands
