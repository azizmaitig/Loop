# agent-loop-file-watch

## TL;DR (For humans)

Configure the file watch trigger end-to-end: create `_loops.yaml` (child loop + fileWatch on `incoming/`), a demo plan that fires on dropped files, and E2E verify the daemon picks them up.

**No code changes.** Only config files.

## Scope

- `D:\projects\obsidian\second brain\10-Projects\11-Active\agent-loop`
- **Must-NOT-Have:** No source code edits. No new dependencies. No production data.

## Dependencies

T1 → T2 (demo plan referenced by _loops.yaml must exist first)
T1 → T3 (config must exist to test)
T2 → T3 (plan must exist to test)

## Final Verification Wave

- [ ] F1: Daemon starts with `--loops _loops.yaml` on port 3001 without errors
- [ ] F2: Dropping a `.plan.yaml` file into `incoming/` → file moved to `incoming/.processed/` within 10s
- [ ] F3: `GET /api/history` shows ≥2 entries (auto-start + trigger fire)
- [ ] F4: No source files modified (git diff src/)

## TODOs

### T1: Create `_loops.yaml` config

- [ ] Create `incoming/` directory for watched files (create if not present)
- [ ] Create `_loops.yaml` with child loop `file-watch-demo`:
  - `watchDir: incoming/` (shorthand — auto-creates fileWatch trigger)
  - `planPath: plans/file-watch-demo.yaml`
  - `enabled: true`
- [ ] **Acceptance:** `_loops.yaml` present, valid YAML, readable by `parseLoopsYaml()` in orchestrator.ts

**References:**
- `src/orchestrator.ts` `loadFromConfig()` (line 115) — loads `_loops.yaml` at daemon startup
- `src/orchestrator.ts` `addChild()` (line 30) — auto-registers fileWatch trigger when `watchDir` is set
- `src/triggers.ts` `FileWatchTrigger` (line 171) — watches dir, pattern `*.plan.yaml`, debounce 500ms, moves to `.processed/`
- `src/types.ts` `ChildLoopDef` (line 149) — `watchDir: string` shorthand
- `src/daemon.ts` line 366: `await this.orchestrator.loadFromConfig(loopsConfig)` — called during Daemon constructor

**Implementer notes:**
- Use the **`watchDir` shorthand** in `_loops.yaml`, NOT an explicit `triggers:` block. The shorthand creates a `fileWatch` trigger with `*.plan.yaml` pattern automatically. Do NOT write `triggers: - type: fileWatch ...` — use `watchDir: incoming/` as a loop-level field.
- Do NOT include `enabled: false` — omit the field or set `enabled: true`. Default is `true` in orchestrator.ts line 130.
- The `daemon/` directory does NOT need to exist; `FileWatchTrigger.start()` creates it with `mkdirSync({ recursive: true })` (triggers.ts line 194).
- `incoming/.processed/` is auto-created by `FileWatchTrigger.flush()` (triggers.ts line 221).

**QA:**
- Automated: `bun test` passes (no source changes, only new config files)
- Automated: Validate YAML syntax with `node -e "JSON.parse(require('child_process').execSync('bun run loop.ts daemon --port 3001 --loops _loops.yaml --dry-run', {encoding:'utf8'})).loops` or manual: `node -e "const o=require('./src/orchestrator.js'); ..."` — easier: just confirm the daemon prints `Started N trigger(s)` on launch

**Adversarial classes:**
- `dirty worktree` → NOT applicable (no code changes)
- `stale state` → NOT applicable (new file only)
- `malformed input` → APPLICABLE: create `_loops.yaml` with YAML syntax errors and confirm `parseLoopsYaml` emits warning but doesn't crash daemon

**Commit:** `feat: add _loops.yaml with fileWatch trigger on incoming/`

---

### T2: Create demo plan `plans/file-watch-demo.yaml`

- [ ] Create `plans/file-watch-demo.yaml` with 2 tasks:
  1. `echo "received: $(basename {{FILE}})" >> loop-run-log.md` (confirms file arrived)
  2. LLM task with `provider: openai`, prompt `"summarize what this plan does in 10 words"`
- [ ] Do NOT include output fields (`status`, `durationMs`, `completedAt`) — those are written by afterLoop at runtime
- [ ] **Acceptance:** Valid YAML, parseable by `parsePlanYaml()`, has `planName` and `tasks` array

**References:**
- Existing plans for format: `plans/daily-triage.yaml`, `plans/stress-test.yaml`
- LLM task format: `{ id, llm: { provider, prompt }, timeoutMs }`

**LLM env vars (must be set before E2E):**
```
LLM_PROVIDER=openai
LLM_API_KEY=<your-key>
LLM_MODEL=gpt-4o-mini
```
If LLM_PROVIDER is not set, the daemon returns `provider not configured` — the echo task still passes.

**QA:**
- Automated: Validate YAML with `bun run loop.ts start --plan plans/file-watch-demo.yaml --max-iterations 1 --dry-run` (or parse in test runner)
- Manual-QA: `bun run loop.ts start --plan plans/file-watch-demo.yaml --max-iterations 1` — confirm both tasks execute, echo shows in loop-run-log.md, LLM task runs or returns `provider not configured`

**Adversarial classes:**
- `malformed input` → APPLICABLE: introduce YAML error, confirm `parsePlanYaml` returns error
- `flaky tests` → NOT applicable (static file)
- `misleading success output` → NOT applicable (dry-run validation)

**Commit:** `feat: add file-watch-demo plan with echo + LLM tasks`

---

### T3: E2E verification of file watch trigger

- [ ] Kill existing daemon on port 3000 (if running)
- [ ] Start daemon: `bun run loop.ts daemon --port 3001 --loops _loops.yaml`
- [ ] Wait 2s for startup + auto-start (child loop auto-enqueues initial task)
- [ ] Check `GET /api/history` — expect ≥1 entries (auto-start initial task)
- [ ] Drop a test plan into `incoming/`: copy `plans/file-watch-demo.yaml` to `incoming/test-$(date +%s).plan.yaml`
- [ ] Wait 10s (debounce 500ms + file move + task execution)
- [ ] Verify file was moved to `incoming/.processed/test-*.plan.yaml`
- [ ] Check `GET /api/history` — expect ≥2 entries (initial + trigger-fired)
- [ ] **Acceptance:** File moved to `.processed/`, history shows 2+ entries, entry for trigger-fired task contains `file-watch-demo` plan name

**Verification commands:**
```bash
# Check history (from daemon host)
curl -s http://localhost:3001/api/history | head -20

# Check .processed/
ls -la incoming/.processed/

# Check daemon logs for trigger registration
curl -s http://localhost:3001/api/status | grep -i trigger
```

**Expected output:**
```
Started 1 trigger(s)          # In daemon startup
incoming/.processed/test-*.plan.yaml  # File moved after trigger fire
2+ entries in /api/history    # Auto-start + trigger fire
```

**QA:**
- Manual-QA: Run the steps above, capture `curl -s http://localhost:3001/api/history` output as evidence file

**Adversarial classes:**
- `hung commands` → APPLICABLE: daemon might hang on port conflict — use `--port 3001` and verify port is free before start
- `flaky tests` → APPLICABLE: 10s wait is generous but filesystem events can lag — if first attempt fails, retry once with 15s wait
- `misleading success output` → APPLICABLE: daemon says "Started 1 trigger(s)" even if fileWatch dir doesn't exist — ALWAYS verify actual `.processed/` move + history entries
- `dirty worktree` → NOT applicable (no code changes)
- `stale state` → APPLICABLE: existing daemon on port 3000 will conflict — KILL IT FIRST

**Commit:** `test: add E2E verification for file watch trigger`

---

## Dependencies

```
T1 (_loops.yaml) ──────┐
                        ├──→ T3 (E2E verify)
T2 (demo plan) ────────┘
```
