# Implementation Plan: YAML Consolidation

## Overview

Consolidate 4 hand-rolled YAML parsers (~390 LOC) into a single `src/yaml.ts` module
using `js-yaml`. Replaces custom parsing in `state.ts` (YAML frontmatter + JSON
fallback), `plan-executor.ts` (parsePlanYaml/stringifyPlanYaml), `orchestrator.ts`
(YAML config loader), and any supporting YAML code.

See ADR-0003 for the rationale on adding `js-yaml` as a project dependency.

## Architecture Decisions

- Add `js-yaml` + `@types/js-yaml` as project dependencies
- One `src/yaml.ts` module with: `parseYaml()`, `stringifyYaml()`, `parseFrontmatter()`
- Frontmatter parser uses js-yaml for the YAML block + preserves raw Markdown body
- All existing callers import from `src/yaml.ts` instead of inline parsing

## Task List

### Phase 1: Foundation

- [ ] **Task 1.1**: Install dependency
  - `bun add js-yaml` and `bun add -d @types/js-yaml`
  - Verify: `bun test` still passes (no behavioral change yet)
  - Files: `package.json`, `bun.lock`
  - Scope: XS (1 file)

- [ ] **Task 1.2**: Create `src/yaml.ts` with 3 exports
  - `parseYaml<T>(input: string): T` — wrap `js-yaml.load()` with try/catch
  - `stringifyYaml(input: unknown): string` — wrap `js-yaml.dump()` with options
  - `parseFrontmatter<T>(content: string): { data: T; body: string }` — split `---\n...\n---\nbody`, parse frontmatter block with js-yaml, return rest as body
  - Acceptance: unit tests pass
  - Files: `src/yaml.ts` (new), `__tests__/yaml.test.ts` (new)
  - Scope: Small (2 files)

### Checkpoint: yaml.ts
- [ ] `bun test __tests__/yaml.test.ts` passes
- [ ] All 3 functions work with sample state.md content

### Phase 2: Migrate callers

- [ ] **Task 2.1**: Migrate `state.ts`
  - Replace inline `parseYamlFrontmatter` / json fallback with `parseFrontmatter()` from yaml.ts
  - Replace inline YAML stringify with `stringifyYaml()`
  - Acceptance: `bun test __tests__/state.test.ts` passes
  - Files: `src/state.ts`, `src/yaml.ts` (if API needs adjustment)
  - Scope: Small (1-2 files)

- [ ] **Task 2.2**: Migrate `plan-executor.ts`
  - Replace `parsePlanYaml()` body with `parseYaml()`
  - Replace `stringifyPlanYaml()` body with `stringifyYaml()`
  - Acceptance: `bun test __tests__/plan-executor.test.ts` + `__tests__/loop-plan.test.ts` passes
  - Files: `src/plan-executor.ts`
  - Scope: Small (1-2 files)

- [ ] **Task 2.3**: Migrate `orchestrator.ts`
  - Replace inline YAML config loading with `parseYaml()`
  - Acceptance: `bun test __tests__/orchestrator.test.ts` passes
  - Files: `src/orchestrator.ts`
  - Scope: Small (1-2 files)

- [ ] **Task 2.4**: Sweep remaining YAML usage
  - Grep for `parseYaml`, `stringifyYaml`, `---` YAML block parsing in src/ and __tests__/
  - Replace any remaining inline YAML with yaml.ts exports
  - Acceptance: `bun test` passes
  - Files: any remaining files with inline YAML
  - Scope: Small (1-3 files)

### Checkpoint: Migrated
- [ ] `bun test` passes (all 392 existing tests)
- [ ] No remaining inline YAML parsers in src/ (grep check)

### Phase 3: Cleanup

- [ ] **Task 3.1**: Remove dead code
  - Delete any now-unused helper functions from state.ts, plan-executor.ts, orchestrator.ts
  - Update CONTEXT.md: add yaml.ts to module table, note `js-yaml` dep
  - Verify: `bun test` still passes
  - Files: `src/state.ts`, `src/plan-executor.ts`, `CONTEXT.md`
  - Scope: Small (2-3 files)

### Checkpoint: Complete
- [ ] `bun test` passes
- [ ] CONTEXT.md updated with yaml.ts module
- [ ] `js-yaml` listed in package.json dependencies
- [ ] Ready for review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| js-yaml parsing differs from custom parser edge cases | Med | Write test cases using actual STATE.md and .plan.yaml files before/after migration |
| Frontmatter body extraction differs | Med | parseFrontmatter preserves original body text; test with real state files |
| Custom parser had looser tolerances | Low | js-yaml is stricter; if existing files parse but fail, add a dump/reload compatibility test |

## Verification

- [ ] `bun test` — all existing tests pass before and after
- [ ] Grep `src/` for any remaining `---` frontmatter parsing not going through yaml.ts
- [ ] Manual: `bun run src/daemon.ts` reads state/config correctly
