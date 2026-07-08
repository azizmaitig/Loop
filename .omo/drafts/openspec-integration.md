# Draft: agent-loop OpenSpec Integration

## Requirements (confirmed)
- Add `openspec/` to agent-loop for spec-driven development
- **Two separate OpenSpec changes**:
  1. `agent-loop-arch-spec` — existing architecture documentation as OpenSpec specs
  2. `agent-loop-cross-platform` — full proposal→design→tasks→specs→implement for cross-platform shell support
- Follow vault OpenSpec conventions

## Technical Decisions
- **Change 1** (`arch-spec`): Lightweight architecture overview spec referencing CONTEXT.md (not per-module deep-dives). Confirmed useful as formal OpenSpec entry point.
- **Change 2** (`cross-platform`): Detect OS at runtime, support sh/bash/zsh alongside cmd.exe, update tests. Full TDD.
- OpenSpec dir at `agent-loop/openspec/`

## Test Strategy
- Change 1 (arch-spec): NO code changes — documentation only. Agent QA: verify each spec file exists, references match codebase.
- Change 2 (cross-platform): TDD — bun test infrastructure exists (147 tests). RED→GREEN→REFACTOR per task.

## Vault Pattern Concern
- Vault `openspec/changes/*` pattern is forward-only — assumes implementation follows specs
- Change 1 (arch-spec) breaks this pattern — documenting already-shipped code
- Options:
  - A) Keep arch-spec as lightweight overview specs (references CONTEXT.md, doesn't duplicate)
  - B) Skip arch-spec entirely, focus on Change 2 (cross-platform) as the first real OpenSpec change
  - C) Have arch-spec specs serve double duty: document current API contracts AND serve as testable specs

## Open Questions (ALL resolved by user)
- ~~Documentation or specification?~~ Resolved: **Both — As Separate Changes**
- ~~Which future feature?~~ Resolved: **Cross-Platform Shell**
- ~~What format for module specs?~~ Resolved: Follow vault Gherkin-style for behavioral specs, API contracts for existing modules

## Scope Boundaries
- INCLUDE: openspec/ directory with config.yaml
- INCLUDE: At least one OpenSpec change
- INCLUDE: Cross-platform shell implementation (detect OS, support non-Windows shells, tests)
- EXCLUDE: Publishing to GitHub or npm
- EXCLUDE: Modifying existing CONTEXT.md
- EXCLUDE: Any other feature work beyond cross-platform shell
