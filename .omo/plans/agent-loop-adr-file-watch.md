# ADR for file-watch trigger

## TL;DR (For humans)
Create an ADR documenting the _loops.yaml file-watch trigger decision.

## TODOs

1. [ ] **Create docs/adr/0001-file-watch-trigger-config.md**

  **File**: `D:\projects\obsidian\second brain\10-Projects\11-Active\agent-loop\docs\adr\0001-file-watch-trigger-config.md`

  **Acceptance**: File exists, follows ADR format (Context, Decision, Consequences, Alternatives), documents why `watchDir` shorthand was chosen over explicit `triggers:` block.

  **Content**:
  ```markdown
  # ADR-0001: File-watch trigger via _loops.yaml

  **Date**: 2026-07-06
  **Status**: Accepted

  ## Context

  Agent-loop v6 introduced FileWatchTrigger and LoopOrchestrator. No persistent config for file-watch — only CLI `--watch-dir` flag, lost on restart. _loops.yaml supported child loops with cron triggers but `watchDir` shorthand was undocumented and untested.

  ## Decision

  Use _loops.yaml `watchDir` shorthand:
  ```yaml
  loops:
    - name: file-watch-demo
      watchDir: incoming/
      planPath: plans/file-watch-demo.yaml
      enabled: true
  ```

  1. Custom YAML parser handles indent-4 `watchDir` reliably; explicit `triggers:` block at indent-6 is indentation-sensitive.
  2. Less boilerplate: 1 line vs 5.
  3. `addChild()` already auto-creates fileWatch trigger from `watchDir`.

  ## Consequences

  - Triggers persist across restarts via checked-in config.
  - No code changes needed.
  - Custom YAML parser may need js-yaml migration if config grows.
  - Auto-start on boot means ≥2 history entries after drop.

  ## Alternatives

  1. Keep `--watch-dir` CLI only — rejected, not persistent.
  2. Environment variable — rejected, no multi-dir support.
  3. Separate `triggers.yaml` — over-engineered.
  ```

  **QA**: `Test-Path "docs/adr/0001-file-watch-trigger-config.md"` returns True.

  **Commit message**: `docs: ADR-0001 file-watch trigger config`

F1. [ ] **Verify file exists**

  **QA**: `Test-Path "D:\projects\obsidian\second brain\10-Projects\11-Active\agent-loop\docs\adr\0001-file-watch-trigger-config.md"` returns True. File contains "ADR-0001" in first line.

## Dependency Matrix

| Todo | Depends On |
|------|-----------|
| T1   | —         |
| F1   | T1        |
