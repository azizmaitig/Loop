# ISSUE-004 — Multi-loop orchestration

## What to build

The daemon can manage multiple child loops (same process, shared global state). Children are configurable via `loops.yaml` or API, and can be started/stopped independently.

- Create `src/orchestrator.ts`:
  - `LoopOrchestrator` class:
    - `addChild(def: ChildLoopDef): string` — registers child, returns ID
    - `removeChild(id): boolean` — deregisters and stops
    - `startChild(id): Promise<boolean>` — activates child's plan/triggers
    - `stopChild(id): Promise<boolean>` — deactivates child's triggers
    - `getChildState(id): ChildLoopState | null`
    - `listChildren(): ChildLoopSummary[]`
    - `loadFromConfig(path: string): Promise<void>` — reads `loops.yaml`
- `loops.yaml` schema:
  ```yaml
  loops:
    - name: daily-triage
      planPath: ./plans/triage.plan.yaml
      triggers:
        - type: cron
          schedule: "0 9 * * *"
      enabled: true
    - name: file-watcher
      watchDir: ./incoming
      enabled: false
  ```
- API endpoints (add to daemon routes):
  - `GET /loops` → list all children
  - `GET /loops/:id` → single child state
  - `POST /loops` → create child (body: ChildLoopDef)
  - `DELETE /loops/:id` → remove child
  - `POST /loops/:id/start` → start child
  - `POST /loops/:id/stop` → stop child
- Shared state: all children read/write the same `state.json` (existing persistence)
- When daemon starts with `--loops-config ./loops.yaml`, it loads and auto-starts enabled children
- Handle edge cases: loops.yaml not found (warn, continue), child already running (error), nonexistent child ID (404)

## Acceptance Criteria

- [ ] `POST /loops` with valid body → 201, child appears in GET /loops
- [ ] `GET /loops` returns array of children with id/name/status
- [ ] `POST /loops/:id/start` → status changes to 'running'
- [ ] `POST /loops/:id/stop` → status changes to 'stopped'
- [ ] `DELETE /loops/:id` → child removed from list
- [ ] `--loops-config loops.yaml` loads and auto-starts enabled children
- [ ] Nonexistent loops.yaml → daemon starts with warning (not crash)
- [ ] Invalid child ID → 404
- [ ] Start on already-running child → appropriate error
- [ ] All existing tests pass

## Blocked by

- ISSUE-001 (daemon skeleton must exist to wire orchestrator into)
