# Loop Dashboard

## TL;DR

> **Quick Summary**: Build a local web dashboard (Node/Express + vanilla HTML/JS + Chart.js) to visualize health score trends, monitor loop state, configure loops, browse work history and evidence, and manage Windows scheduled tasks — all from a single-page app running on localhost:3099.

> **Deliverables**:
> - Node.js Express server with 10 REST API endpoints
> - Single-page dashboard frontend (dark theme, hash-based routing)
> - Trend chart (Chart.js) for health score + 4 sub-scores
> - Loop state viewer + configuration editor
> - Work history / Gantt view
> - Evidence file gallery browser
> - Windows scheduler viewer + editor

> **Estimated Effort**: Medium (2-3 sessions)
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Express server scaffold → API endpoints → Frontend shell → Feature pages

---

## Context

### Original Request
Build a dashboard to visualize the vault health loops, their achievements, and configure them (enable/disable, change schedules, etc.).

### Interview Summary
**Key Decisions**:
- **Stack**: Vanilla HTML/CSS/JS (no build step), Express.js backend, Chart.js via CDN
- **Server**: Node.js Express on localhost:3099, bound to 127.0.0.1 only
- **Auth**: None — localhost trust model
- **Auto-refresh**: Every 30 seconds via `setInterval` + `fetch()`
- **Responsive**: Desktop-first (mobile usable but not polished)
- **Scheduler edits**: Allowed with graceful degradation if server not running as Administrator
- **Tests**: Tests after implementation (primary QA via agent-executed scenarios)
- **Evidence handling**: Thumbnail grid, click to open in new tab. WAV/MP4 inline, HTML in iframe badge
- **Works history**: 6 works in boulder.json (1 abandoned), handle stale `active_work_id`

**Data Sources**:
- `.omo/pulse-trend.json` — 30 entries, 6 unique scores, has BOM (\xef\xbb\xbf) encoding issue
- `.omo/loop-slots.json` — 4 slots (loop-config, loop-state, loop-last-run, loop-kill-switch). `loop-config.content` is double-encoded JSON string.
- `.omo/loop-circuit-breaker.json` — circuit breaker state
- `.omo/boulder.json` — 6 works with task breakdowns, 1 abandoned (timeline-add-cards), stale `active_work_id` (invisible-qr-code doesn't exist as a key)
- `.omo/evidence/` — ~241 files + 6 subdirectories (PNG, WAV, JSON, HTML, MP4, logs)
- `70-Memory/context/pulse.md` — current vault pulse
- Windows Scheduled Tasks (via `schtasks /Query`)

### Metis Review
**Identified Gaps** (addressed):
- **BOM in pulse-trend.json**: Use `fs.readFileSync(path, 'utf-8-sig')` or strip BOM before `JSON.parse`
- **Atomic file writes**: Write to `.tmp` then rename for loop-slots updates
- **Work count**: 6 works not 7; evidence files: 241 not 164
- **Active work ID stale**: `invisible-qr-code` doesn't match any work key — dashboard should show this
- **schtasks security**: Use `execFile()` not `exec()` to prevent command injection
- **Path traversal**: Resolve evidence paths against `.omo/evidence/` and validate
- **Double-encoded JSON**: `loop-config.content` is a JSON string inside JSON — needs two `JSON.parse()` calls
- **Dedup trend entries**: Collapse consecutive identical scores before charting

---

## Work Objectives

### Core Objective
Build a local web dashboard to visualize health score trends, monitor loop state, configure loop parameters, browse work execution history and evidence, and manage Windows scheduled tasks — all served from a Node.js Express server on localhost:3099.

### Concrete Deliverables
- `00-System/Tools/loop-dashboard/server.js` — Express server with all API routes
- `00-System/Tools/loop-dashboard/public/index.html` — SPA shell with hash-based routing
- `00-System/Tools/loop-dashboard/public/style.css` — Dark theme design system
- `00-System/Tools/loop-dashboard/public/app.js` — Frontend application logic
- `00-System/Tools/loop-dashboard/package.json` — npm dependencies (express, maybe chart.js bundled)
- `00-System/Tools/run-loop-dashboard.bat` — One-click launcher

### Definition of Done
- [ ] `curl http://localhost:3099/` returns HTML dashboard
- [ ] All 5 feature pages render without console errors
- [ ] Trend chart shows health score evolution with deduplicated data
- [ ] Loop config form reads current values and persists changes
- [ ] Evidence gallery lists all files with type icons
- [ ] Scheduler page shows tasks and allows enable/disable
- [ ] Auto-refresh updates data every 30s
- [ ] Missing/corrupt data sources show graceful degradation, not crashes

### Must Have
- **Trend Chart**: Chart.js line chart with overall score + 4 sub-scores, deduplicated
- **Loop State Cards**: Show loop-state, kill-switch, circuit breaker, last run summary
- **Loop Config Editor**: Edit target_score, toggle kill-switch
- **Work History**: Horizontal bar chart / timeline of 6 works with task breakdown
- **Evidence Gallery**: Thumbnail grid with type badges, click-to-open
- **Scheduler Status**: Show Windows tasks (next run, last run, last result, state)
- **Scheduler Editor**: Toggle enable/disable tasks, edit run time
- **Graceful Degradation**: All panels work independently if one data source is missing

### Must NOT Have (Guardrails)
- No authentication system, login, or API keys
- No database (SQLite, LevelDB, etc.) — all data from file reads
- No full media player for evidence files (click to open in new tab)
- No CRON visual editor for scheduler (text input only)
- No drag-to-reorder Gantt for work history
- No search/filter for evidence gallery
- No build step (no webpack, vite, etc.)

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: YES (node v24.14.1, npm 11.4.0)
- **Automated tests**: Tests-after (primary: agent-executed QA scenarios)
- **Framework**: None for this project (API tested via curl, UI via browser snapshot)
- **Tests-after**: Test tasks added after ALL feature tasks in Wave 3

### QA Policy
Every task MUST include agent-executed QA scenarios. Evidence saved to `.omo/evidence/`.

- **API endpoints**: Bash (curl) — Send request, assert status code + response body
- **Frontend**: Playwright (browser snapshot) — Navigate, verify elements render, no console errors
- **Config updates**: Bash (curl POST) + curl GET to verify persistence
- **Scheduler edits**: PowerShell (schtasks /Query) to verify changes took effect
- **Error handling**: Delete/move source files, verify dashboard degrades gracefully

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation — start immediately):
├── Task 1: Express server scaffold + package.json + launcher batch
├── Task 2: API — READ endpoints (GET pulse-trend, loop-slots, circuit-breaker, boulder, evidence, scheduled-tasks, pulse)
├── Task 3: Frontend shell (index.html + app.js routing + dark theme CSS)
├── Task 4: Chart.js integration + trend chart component
└── Task 5: Frontend — Loop state cards panel

Wave 2 (Features — after Wave 1, MAX PARALLEL):
├── Task 6: API — WRITE endpoints (POST loop-slots, POST scheduled-tasks)
├── Task 7: Frontend — Loop config editor
├── Task 8: Frontend — Work history / Gantt view
├── Task 9: Frontend — Evidence gallery browser
├── Task 10: Frontend — Scheduler viewer + editor
└── Task 11: Frontend — Auto-refresh (30s polling)

Wave 3 (Polish + Tests — after Wave 2):
├── Task 12: Error handling + graceful degradation for all panels
├── Task 13: Integration tests (agent-executed QA scenarios)
└── Task 14: README + documentation

Wave FINAL (After ALL tasks — parallel reviews):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)
-> Present results -> Get explicit user okay
```

### Dependency Matrix
- **1**: — 2,3
- **2**: 1 — 6
- **3**: 1 — 4,5,7,8,9,10,11
- **4**: 3 — (none, refines existing page)
- **5**: 3 — (none, refines existing page)
- **6**: 2 — 7,10
- **7-11**: 3,6 — 12
- **12**: 7-11 — 13
- **13**: 12 — 14
- **14**: 13 — F1-F4

### Agent Dispatch Summary
- **Wave 1**: 5 tasks — T1→`quick`, T2→`unspecified-high`, T3→`visual-engineering`, T4→`visual-engineering`, T5→`visual-engineering`
- **Wave 2**: 6 tasks — T6→`unspecified-high`, T7→`visual-engineering`, T8→`visual-engineering`, T9→`visual-engineering`, T10→`visual-engineering`, T11→`quick`
- **Wave 3**: 3 tasks — T12→`unspecified-high`, T13→`unspecified-high`, T14→`writing`
- **FINAL**: 4 tasks — F1→`oracle`, F2→`unspecified-high`, F3→`unspecified-high`, F4→`deep`

---

## TODOs

- [x] 1. Express server scaffold + launcher

  **What to do**:
  - Create `00-System/Tools/loop-dashboard/` directory
  - Create `package.json` with express dependency
  - Create `server.js` with:
    - Express app listening on `127.0.0.1:3099`
    - Static file serving from `./public/`
    - CORS headers (optional, localhost)
    - JSON body parser middleware
    - Error handling middleware
    - Graceful shutdown on SIGINT/SIGTERM
  - Create `run-loop-dashboard.bat` that does `cd /d "%~dp0" && npm install && node server.js`
  - `npm install express`

  **Must NOT do**:
  - No auth middleware
  - No database connections
  - No dependency beyond express (and chart.js if bundled)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard Express server scaffold, well-known pattern
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: `mcp-server-patterns` (not building an MCP server), `fastapi-patterns` (Node not Python)

  **Parallelization**:
  - **Can Run In Parallel**: NO (foundation)
  - **Parallel Group**: Wave 1 (alone — everything depends on this)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:
  - `10-Projects/11-Active/fleet-server/src/index.js` — Express server pattern used in this vault (vanilla JS, route organization, error handling). Not a copy but a reference for style.
  - `10-Projects/11-Active/fleet-server/package.json` — Express dependency versioning pattern

  **Acceptance Criteria**:
  - [ ] `node server.js` starts without error on port 3099
  - [ ] `curl -s -o /dev/null -w "%{http_code}" http://localhost:3099/` returns 200
  - [ ] `run-loop-dashboard.bat` launches server on double-click
  - [ ] `curl http://localhost:3099/api/health` returns `{"status":"ok"}`

  **QA Scenarios**:
  ```
  Scenario: Server starts and responds
    Tool: Bash
    Preconditions: No other process on port 3099
    Steps:
      1. Start server: `cd 00-System/Tools/loop-dashboard/ && node server.js &`
      2. Wait 2s: `sleep 2`
      3. Health check: `curl -s http://localhost:3099/api/health`
      4. Kill server: `kill %1`
    Expected Result: Health endpoint returns 200 with JSON `{"status":"ok"}`
    Evidence: .omo/evidence/task-1-server-health.txt

  Scenario: Port conflict handled gracefully
    Tool: Bash
    Preconditions: Something is already on port 3099
    Steps:
      1. Start something on 3099: `npx -y serve -l 3099 &`
      2. Try starting server: `node server.js` (capture stderr)
      3. Kill both
    Expected Result: Server logs EADDRINUSE error and exits cleanly, doesn't crash
    Evidence: .omo/evidence/task-1-port-conflict-log.txt
  ```

  **Evidence to Capture**:
  - [ ] `/api/health` response body
  - [ ] Startup log output (no errors)
  - [ ] Batch file executes successfully

  **Commit**: YES
  - Message: `feat(loop-dashboard): add Express server scaffold and launcher`
  - Files: `00-System/Tools/loop-dashboard/`

- [x] 2. API — READ endpoints (all data sources)

  **What to do**:
  - Add these GET routes to `server.js`:
    - `GET /api/pulse-trend` — reads `.omo/pulse-trend.json`, handles BOM (`\ufeff`), returns JSON array
    - `GET /api/loop-slots` — reads `.omo/loop-slots.json`, returns slot data
    - `GET /api/circuit-breaker` — reads `.omo/loop-circuit-breaker.json`
    - `GET /api/boulder` — reads `.omo/boulder.json`
    - `GET /api/evidence` — reads `.omo/evidence/` directory, returns filtered file list (by type, size, date), depth up to 2 levels
    - `GET /api/evidence/:path(*)` — serves files from `.omo/evidence/` with path traversal protection (resolve against evidence dir, verify prefix)
    - `GET /api/scheduled-tasks` — runs `schtasks /Query /FO CSV /V /TN "opencode-job-second-brain-3f23411e0285-*"`, parses CSV output into JSON array
    - `GET /api/pulse` — reads `70-Memory/context/pulse.md` and returns as markdown text
  - Path traversal protection: `path.resolve()` then verify `.startsWith(evidencePath)` — reject with 403 if violated
  - BOM handling: read file as UTF-8, strip `\ufeff` or `\xef\xbb\xbf` before `JSON.parse`
  - Error handling: each endpoint wrapped in try/catch, returns `{"error": "message"}` with appropriate HTTP status
  - File not found: return 404 with `{"error": "File not found"}`

  **Must NOT do**:
  - No `exec()` with string interpolation — use `execFile()` for schtasks
  - No writing files in READ endpoints
  - No exposing files outside `.omo/evidence/`

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Multiple endpoints, security-sensitive (path traversal, schtasks), BOM handling, CSV parsing
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: `security-and-hardening` (relevant but overkill for a local tool; basic path traversal guard is sufficient)

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on server.js scaffold)
  - **Parallel Group**: Wave 1 (blocks feature development)
  - **Blocks**: Task 6 (write endpoints share patterns)
  - **Blocked By**: Task 1

  **References**:
  - `fleet-server/src/routes/status.js:1-30` — Route pattern for Express GET handlers in this vault
  - `fleet-server/src/ssh.js:1-20` — `execFile` usage pattern (security-conscious command execution)
  - `00-System/Tools/pulse.ps1:84-88` — Evidence of BOM-like content structure in vault files
  - Node.js docs: `execFile` vs `exec` — use `execFile('schtasks', ['/Query', ...])` for security

  **Acceptance Criteria**:
  - [ ] `curl http://localhost:3099/api/pulse-trend` returns 200 + JSON array with >= 1 entry
  - [ ] `curl http://localhost:3099/api/loop-slots` returns 200 + JSON with 4 slot: keys
  - [ ] `curl http://localhost:3099/api/circuit-breaker` returns 200 + JSON with `state` field
  - [ ] `curl http://localhost:3099/api/boulder` returns 200 + JSON with `works` object
  - [ ] `curl http://localhost:3099/api/evidence` returns 200 + JSON array of files
  - [ ] `curl http://localhost:3099/api/pulse` returns 200 + markdown text
  - [ ] `curl http://localhost:3099/api/evidence/../server.js` returns 403 (path traversal blocked)
  - [ ] `curl http://localhost:3099/api/evidence/nonexistent.png` returns 404

  **QA Scenarios**:
  ```
  Scenario: All read endpoints return data
    Tool: Bash
    Preconditions: Server running, vault files exist
    Steps:
      1. For each endpoint: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3099/api/{endpoint}` for pulse-trend, loop-slots, circuit-breaker, boulder, evidence, pulse
      2. Assert each returns 200
      3. For pulse-trend: verify response is a JSON array with length > 0
    Expected Result: All 6 endpoints return HTTP 200 with valid JSON/markdown
    Evidence: .omo/evidence/task-2-read-endpoints.txt

  Scenario: Path traversal attack blocked
    Tool: Bash
    Preconditions: Server running
    Steps:
      1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3099/api/evidence/../server.js`
      2. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3099/api/evidence/..%2f..%2fpackage.json`
    Expected Result: Both return 403
    Evidence: .omo/evidence/task-2-path-traversal.txt

  Scenario: Missing file returns 404
    Tool: Bash
    Preconditions: Server running
    Steps:
      1. `curl -s -o /dev/null -w "%{http_code}" http://localhost:3099/api/evidence/THIS_FILE_DOES_NOT_EXIST.png`
    Expected Result: 404
    Evidence: .omo/evidence/task-2-404.txt
  ```

  **Evidence to Capture**:
  - [ ] Response bodies for each endpoint (first 500 chars)
  - [ ] Path traversal rejection headers
  - [ ] Error response for missing file

  **Commit**: YES (with Task 1)
  - Message: `feat(loop-dashboard): add Express server scaffold and API endpoints`
  - Files: All in `00-System/Tools/loop-dashboard/`

- [x] 3. Frontend shell — SPA with routing + dark theme

  **What to do**:
  - Create `public/index.html` — SPA shell:
    - Sidebar navigation with 5 links: Dashboard, Config, Works, Evidence, Scheduler
    - `<div id="app">` container for page content
    - Chart.js CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>`
    - Hash-based routing: `#dashboard` (default), `#config`, `#works`, `#evidence`, `#scheduler`
    - Loading indicator overlay
    - Toast notification system (for save confirmations, errors)
  - Create `public/style.css` — Dark theme design system:
    - CSS custom properties for colors (matching vault dark theme aesthetic from fleet-server)
    - Dark background (`#1a1a2e` or similar), light text, accent color for interactive elements
    - Sidebar styling (fixed left, ~220px wide)
    - Card component styles
    - Chart container styles
    - Form element styles (inputs, toggles, buttons)
    - Evidence gallery grid styles
    - Responsive breakpoints (desktop-first, tablet-friendly)
    - Toast notification styles
  - Create `public/app.js` — SPA router + core logic:
    - `navigate(hash)` function — shows/hides page sections
    - `fetchData(url)` helper — wraps fetch with error handling
    - Default route to `#dashboard`
    - `showToast(message, type)` — success/error notifications
    - Auto-refresh timer (30s) — re-fetches data for current page

  **Must NOT do**:
  - No build step (no Vite, no bundler)
  - No UI framework dependencies (no React, no jQuery)
  - No complex animation libraries

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI/UX design, dark theme, responsive layout, SPA architecture
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: `frontend-ui-engineering` (overkill for an internal tool; fleet-server aesthetic is sufficient)

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 1)
  - **Parallel Group**: Wave 1 (blocks all frontend feature tasks)
  - **Blocks**: Tasks 4, 5, 7, 8, 9, 10, 11
  - **Blocked By**: Task 1

  **References**:
  - `fleet-server/public/index.html` — Sidebar nav + main content area layout pattern
  - `fleet-server/public/style.css` — Dark theme CSS custom properties, card styles, color palette
  - `fleet-server/public/app.js` — Fetch API usage, DOM manipulation patterns
  - `fleet-server/public/style.css:1-50` — CSS custom properties for dark theme (--bg-primary, --bg-secondary, --text-primary, --accent)

  **Acceptance Criteria**:
  - [ ] `curl http://localhost:3099/` returns HTML with sidebar + `<div id="app">`
  - [ ] Navigating to `http://localhost:3099/#config` shows Config page content
  - [ ] Sidebar has 5 navigation links that switch page content
  - [ ] Dark theme renders with no unstyled content flash
  - [ ] Toast notification works (call `showToast('test', 'success')` from console)
  - [ ] No JavaScript console errors on page load

  **QA Scenarios**:
  ```
  Scenario: All routes render without errors
    Tool: Playwright
    Preconditions: Server running on localhost:3099
    Steps:
      1. Navigate to http://localhost:3099/
      2. Take a snapshot — verify sidebar with 5 links exists
      3. Click each sidebar link: Dashboard, Config, Works, Evidence, Scheduler
      4. After each click, verify console has no errors
      5. Take screenshot of full page
    Expected Result: All 5 pages render, sidebar is visible, no console errors
    Evidence: .omo/evidence/task-3-routes.png

  Scenario: Toast notification appears
    Tool: Playwright
    Preconditions: On dashboard page
    Steps:
      1. Evaluate in console: `showToast('Test notification', 'success')`
      2. Wait 100ms
      3. Take snapshot — verify toast text appears
      4. Wait 3s — verify toast disappears
    Expected Result: Toast shows and auto-dismisses
    Evidence: .omo/evidence/task-3-toast.txt
  ```

  **Evidence to Capture**:
  - [ ] Full page screenshot
  - [ ] Console log (no errors)
  - [ ] Toast notification screenshot

  **Commit**: YES (with Tasks 1, 2)
  - Files: `00-System/Tools/loop-dashboard/public/`

- [x] 4. Chart.js integration + trend chart

  **What to do**:
  - Add TrendChart component to `public/app.js`:
    - `renderTrendChart(data)` function
    - Creates a `<canvas>` element inside `#page-dashboard`
    - Initializes Chart.js line chart with:
      - X-axis: timestamps (formatted as MM/DD HH:mm)
      - Y-axis: score 0-100
      - 5 datasets (overall score + 4 sub-scores: linkDensity, freshness, connectivity, consistency)
      - Each dataset has distinct colors
      - Legend at top
    - Data deduplication: collapse consecutive entries with identical score into the last entry
    - Empty state: "No trend data available yet" message if fewer than 2 data points
    - Responsive: chart resizes with window
    - Tooltip shows exact values on hover
  - Add to dashboard page lifecycle:
    - On `#dashboard` navigation, fetch `/api/pulse-trend` then call `renderTrendChart()`
    - Auto-refresh re-renders chart every 30s

  **Must NOT do**:
  - No custom Chart.js plugins (keep it simple)
  - No animation on data update (instant swap is fine)
  - No downsampling beyond dedup (30 entries is fine for Chart.js)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Chart rendering, data visualization, color choices
  - **Skills**: `[]`
  - **Skills Evaluated but Omitted**: `ui-ux-pro-max` (overkill for a simple line chart)

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 5)
  - **Blocks**: Task 12
  - **Blocked By**: Task 3

  **References**:
  - Chart.js docs: `https://www.chartjs.org/docs/latest/charts/line.html` — Line chart configuration reference
  - No existing chart pattern in vault — this is the first
  - `fleet-server/public/style.css:120-140` — Color palette for vault dark theme: `#00d4aa` (green accent), `#ff6b6b` (red), `#4ecdc4` (teal), `#ffe66d` (yellow), `#a8e6cf` (mint)

  **Acceptance Criteria**:
  - [ ] Trend chart renders on Dashboard page with 5 lines
  - [ ] Chart shows X-axis with dates, Y-axis 0-100
  - [ ] Data deduplication reduces 30 entries to ≤6 visible X-axis labels
  - [ ] Empty state displays message when no data
  - [ ] Chart resizes when browser window resizes
  - [ ] Tooltip shows exact values on hover

  **QA Scenarios**:
  ```
  Scenario: Trend chart renders with data
    Tool: Playwright
    Preconditions: Server running, pulse-trend.json has data
    Steps:
      1. Navigate to http://localhost:3099/#dashboard
      2. Wait 2s for Chart.js to initialize
      3. Take screenshot — verify canvas element exists and has rendered content
      4. Evaluate `document.querySelector('canvas') !== null` — should be true
      5. Check console for Chart.js errors
    Expected Result: Chart renders with 5 lines, no Chart.js errors in console
    Evidence: .omo/evidence/task-4-trend-chart.png

  Scenario: Empty state when no data
    Tool: Bash
    Preconditions: pulse-trend.json is temporarily emptied
    Steps:
      1. Backup pulse-trend.json: `cp .omo/pulse-trend.json .omo/pulse-trend.json.bak`
      2. Write empty array: `echo '[]' > .omo/pulse-trend.json`
      3. Navigate to dashboard page
      4. Take screenshot — verify "No trend data" message
      5. Restore: `mv .omo/pulse-trend.json.bak .omo/pulse-trend.json`
    Expected Result: Empty state message displayed, no chart errors
    Evidence: .omo/evidence/task-4-empty-state.png
  ```

  **Evidence to Capture**:
  - [ ] Dashboard page screenshot with chart
  - [ ] Console log snippet
  - [ ] Empty state screenshot

  **Commit**: YES (with Wave 1)
  - Files: `public/app.js`, `public/style.css`

- [x] 5. Frontend — Loop state cards panel

  **What to do**:
  - Add `renderLoopState()` to `public/app.js` — renders on `#dashboard` page:
    - Fetch `/api/loop-slots` + `/api/circuit-breaker`
    - Display 4 status cards in a 2×2 grid:
      1. **Loop State** (loop-state from slots) — green=IDLE, yellow=RUNNING, red=FAILED, orange=PARTIAL
      2. **Kill Switch** (loop-kill-switch) — green=RUN, red=STOP with toggle button
      3. **Circuit Breaker** — green=CLOSED, yellow=HALF_OPEN, red=OPEN, with success/failure counts
      4. **Last Run** (loop-last-run) — truncated text summary with "View full" expand link
    - Each card shows:
      - Icon/indicator dot (color-coded)
      - Label
      - Current value
      - Timestamp (from updatedAt where available)
    - Auto-refresh updates cards every 30s

  **Must NOT do**:
  - No real-time WebSocket (polling is sufficient)
  - No animation on state transitions

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI cards, status indicators, layout
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 4)
  - **Blocks**: Task 12
  - **Blocked By**: Task 3

  **References**:
  - `fleet-server/public/style.css:60-100` — Card component styles (--card-bg, --card-border, --card-radius)
  - `fleet-server/public/index.html` — Grid/flex layout patterns for dashboard cards

  **Acceptance Criteria**:
  - [ ] 4 status cards render below the trend chart on Dashboard
  - [ ] Loop state card shows correct value with color
  - [ ] Kill switch card shows RUN/STOP with toggle button
  - [ ] Circuit breaker card shows state + consecutive successes/failures
  - [ ] Last run card shows timestamp + truncated summary
  - [ ] Cards update on 30s auto-refresh

  **QA Scenarios**:
  ```
  Scenario: All 4 state cards render with correct data
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Navigate to http://localhost:3099/#dashboard
      2. Wait for data to load (2s)
      3. Take snapshot — verify 4 card elements exist
      4. Check card texts contain expected values (PARTIAL, RUN, CLOSED)
    Expected Result: 4 cards visible with current loop state values
    Evidence: .omo/evidence/task-5-state-cards.png

  Scenario: Cards update on refresh
    Tool: Bash + Playwright
    Preconditions: Dashboard loaded
    Steps:
      1. Note current kill-switch value on screen
      2. POST to toggle kill-switch: `curl -s -X POST -H 'Content-Type: application/json' -d '{"kill_switch":"STOP"}' http://localhost:3099/api/loop-slots`
      3. Wait 30s for auto-refresh (or force: `window.location.reload()`)
      4. Verify kill-switch card now shows STOP
      5. Restore: `curl -s -X POST -H 'Content-Type: application/json' -d '{"kill_switch":"RUN"}' http://localhost:3099/api/loop-slots`
    Expected Result: Cards reflect updated state after refresh
    Evidence: .omo/evidence/task-5-cards-update.png
  ```

  **Evidence to Capture**:
  - [ ] Screenshot of dashboard with cards + chart
  - [ ] Card update verification

  **Commit**: YES (with Wave 1)

---

## TODOs (Wave 2 — Features)

- [x] 6. API — WRITE endpoints (loop-slots, scheduled-tasks)

  **What to do**:
  - Add POST routes to `server.js`:
    - `POST /api/loop-slots` — updates loop-config (target_score, waves) and/or kill-switch:
      - Receives `{ config: { target_score, plan, waves }, kill_switch: "RUN"/"STOP" }`
      - Reads existing `loop-slots.json`, merges changes
      - Writes atomically: write to `.tmp` then `rename()` to `.json`
      - Returns updated slot data
    - `POST /api/scheduled-tasks/:name` — updates a Windows scheduled task:
      - Receives `{ enabled: true/false, schedule: "0 0 * * *" }` (optional fields)
      - Uses `execFile('schtasks', ['/Change', '/TN', taskName, ...])`
        - `/ENABLE` or `/DISABLE` for enabled toggle
        - No built-in cron-to-schtasks schedule change — that requires delete+recreate. For v1, only enable/disable.
      - Returns `{ success: true, taskName, enabled, error: null }` or `{ success: false, error: "..." }` on failure
    - Check for admin rights on startup: try `execFile('schtasks', ['/Query', '/FO', 'CSV'])` — if it fails, set `server.isAdmin = false`
    - For `/api/scheduled-tasks/:name` POST: if `!server.isAdmin`, return 403 with `{ error: "Server not running as Administrator. Restart server as Admin to modify tasks." }`
  - Atomic write pattern:
    ```js
    const tmp = filePath + '.tmp'
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
    fs.renameSync(tmp, filePath)
    ```

  **Must NOT do**:
  - No delete/recreate tasks (too risky for v1) — only enable/disable
  - No schtasks /Create (schedule change requires it, but we skip for safety)
  - No running as root/admin by default — just detect and degrade

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: File I/O with atomic writes, Windows API interaction, admin detection, error handling
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on Task 2 patterns)
  - **Parallel Group**: Wave 2 (blocks config editor and scheduler editor UIs)
  - **Blocks**: Tasks 7, 10
  - **Blocked By**: Task 2

  **References**:
  - `fleet-server/src/ssh.js:20-40` — `execFile` usage for PowerShell/CMD commands
  - Node.js `fs.renameSync` docs — atomic file replacement
  - Windows `schtasks /Change` docs — `/ENABLE`, `/DISABLE`, `/TN` flags

  **Acceptance Criteria**:
  - [ ] `curl -s -X POST -H 'Content-Type: application/json' -d '{"kill_switch":"STOP"}' http://localhost:3099/api/loop-slots` returns 200 + updated data
  - [ ] After POST, `GET /api/loop-slots` shows kill-switch as STOP
  - [ ] Restore: POST `{"kill_switch":"RUN"}`
  - [ ] `curl -s -X POST -H 'Content-Type: application/json' -d '{"enabled":false}' http://localhost:3099/api/scheduled-tasks/opencode-job-second-brain-3f23411e0285-pulse-test` returns either success or 403 with admin error message
  - [ ] Atomic write: if server crashes mid-write, `.tmp` file is left but `.json` is intact

  **QA Scenarios**:
  ```
  Scenario: Toggle kill-switch via API
    Tool: Bash
    Preconditions: Server running, loop-slots.json has kill_switch=RUN
    Steps:
      1. POST to set STOP: `curl -s -X POST -H 'Content-Type: application/json' -d '{"kill_switch":"STOP"}' http://localhost:3099/api/loop-slots`
      2. Verify response status 200 + kill_switch = STOP
      3. GET to confirm: `curl -s http://localhost:3099/api/loop-slots | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)['slot:loop-kill-switch'].content))"`
      4. Restore: POST `{"kill_switch":"RUN"}`
      5. GET to confirm restore
    Expected Result: Kill-switch toggles STOP → RUN, file persists
    Evidence: .omo/evidence/task-6-kill-switch.txt

  Scenario: Scheduler toggle without admin rights
    Tool: Bash
    Preconditions: Server running as non-admin
    Steps:
      1. POST to disable: `curl -s -w "\n%{http_code}" -X POST -H 'Content-Type: application/json' -d '{"enabled":false}' http://localhost:3099/api/scheduled-tasks/opencode-job-second-brain-3f23411e0285-pulse-test`
    Expected Result: Returns 403 with admin error message
    Evidence: .omo/evidence/task-6-scheduler-no-admin.txt
  ```

  **Evidence to Capture**:
  - [ ] Kill-switch toggle + verify response
  - [ ] Scheduler 403 response
  - [ ] Loop-slots file content after write

  **Commit**: YES (with Wave 2)
  - Message: `feat(loop-dashboard): add write endpoints for loop-slots and scheduler`

- [x] 7. Frontend — Loop config editor

  **What to do**:
  - Add `renderConfig()` to `public/app.js` — renders on `#config` page:
    - Fetch `/api/loop-slots` to get current config
    - Form fields:
      - **Target Score**: number input (0-100), pre-filled from `loop-config.target_score`
      - **Waves**: number input, pre-filled from `loop-config.waves`
      - **Plan**: text input showing current plan name
      - **Kill Switch**: toggle switch (RUN/STOP), pre-filled from `loop-kill-switch`
    - Save button → POST to `/api/loop-slots`
    - Success: green toast "Configuration saved"
    - Error: red toast with error message
    - Cancel: reset form to current values
    - Read-only fields (display only): loop-state, last-run summary
  - Loading state while fetching data
  - Error state if data unavailable

  **Must NOT do**:
  - No free-form JSON editor for loop-config (structured form only)
  - No delete/archive actions
  - No history of changes

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Form UI, toggle switches, validation feedback
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 8, 9, 10, 11)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 3, 6

  **References**:
  - `fleet-server/public/app.js` — Form submission, fetch POST patterns
  - `fleet-server/public/style.css` — Form input, button, toggle styling

  **Acceptance Criteria**:
  - [ ] Config page displays current values from API
  - [ ] Changing target_score + Save → shows success toast
  - [ ] Toggling kill-switch → confirmed on re-load
  - [ ] Cancel button resets to original values
  - [ ] Error state shows when API is unreachable

  **QA Scenarios**:
  ```
  Scenario: Config form saves changes
    Tool: Playwright
    Preconditions: Server running, dashboard loaded
    Steps:
      1. Navigate to http://localhost:3099/#config
      2. Wait for form to load with current values
      3. Change target_score to 80
      4. Click Save button
      5. Verify toast "Configuration saved" appears
      6. Reload page → verify target_score shows 80
      7. Restore original value and save
    Expected Result: Config persists across page reloads
    Evidence: .omo/evidence/task-7-config-save.png

  Scenario: Cancel resets form
    Tool: Playwright
    Preconditions: Form loaded with values
    Steps:
      1. Change target_score to 99
      2. Click Cancel
      3. Verify target_score reverts to original
    Expected Result: Form resets to saved values
    Evidence: .omo/evidence/task-7-config-cancel.png
  ```

  **Evidence to Capture**:
  - [ ] Config page screenshot
  - [ ] Save + toast screenshot
  - [ ] Cancel + revert screenshot

  **Commit**: YES (with Wave 2)

- [x] 8. Frontend — Work history / Gantt view

  **What to do**:
  - Add `renderWorks()` to `public/app.js` — renders on `#works` page:
    - Fetch `/api/boulder`
    - Display a horizontal bar chart / timeline of all 6 works:
      - Each work is a row
      - Bar shows duration (start → end)
      - Color-coded by status (completed=green, abandoned=gray, running=blue)
      - Work name on the left
      - Start/end dates displayed
      - Duration displayed (hh:mm format)
    - Below each work bar: expandable task list
      - Tasks are listed with: task_title, category icon, agent, duration, status, verdict
      - Collapsed by default, click to expand
    - Summary cards at top:
      - Total works, completed, abandoned, running
      - Total elapsed time across all works
    - Handle stale `active_work_id` — show a yellow warning banner if it references a non-existent work
    - Empty state if no works

  **Must NOT do**:
  - No drag-to-reorder
  - No filtering/search
  - No in-line editing of work status

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Timeline visualization, expandable lists, summary cards
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 9, 10, 11)
  - **Blocks**: Task 12
  - **Blocked By**: Task 3

  **Reference**:
  - Fleet-server `public/style.css` — Card/grid layout patterns for timeline bars

  **Acceptance Criteria**:
  - [ ] Works page shows 6 work rows with duration bars
  - [ ] Color coding matches status (green/blue/gray)
  - [ ] Expandable task list shows on click
  - [ ] Summary cards show counts
  - [ ] Stale active_work_id shows warning banner
  - [ ] Empty state renders when no works

  **QA Scenarios**:
  ```
  Scenario: Work history renders correctly
    Tool: Playwright
    Preconditions: Server running, boulder.json has 6 works
    Steps:
      1. Navigate to http://localhost:3099/#works
      2. Wait for data
      3. Take snapshot — verify 6 row elements exist
      4. Click first expand arrow — verify tasks appear
      5. Check summary card shows "6 total works" or similar
    Expected Result: All 6 works visible, tasks expandable
    Evidence: .omo/evidence/task-8-works.png

  Scenario: Stale work ID warning
    Tool: Bash
    Preconditions: boulder.json has active_work_id pointing to non-existent key
    Steps:
      1. Navigate to http://localhost:3099/#works
      2. Verify yellow warning banner is visible with text about stale pointer
    Expected Result: Warning banner shown
    Evidence: .omo/evidence/task-8-stale-warning.png
  ```

  **Evidence to Capture**:
  - [ ] Works page screenshot
  - [ ] Expanded task list screenshot
  - [ ] Warning banner screenshot

  **Commit**: YES (with Wave 2)

- [x] 9. Frontend — Evidence gallery browser

  **What to do**:
  - Add `renderEvidence()` to `public/app.js` — renders on `#evidence` page:
    - Fetch `/api/evidence` to get file list
    - Grid layout (responsive: 4 columns desktop, 2 tablet, 1 mobile)
    - Each file shown as a card with:
      - File type icon/emoji: 📄 for text, 🖼 for PNG, 🎵 for WAV, 🎬 for MP4, 📊 for JSON, 🌐 for HTML
      - File name (truncated if long)
      - File size (KB/MB)
      - Last modified date
    - Clicking a file opens it in a new tab: `/api/evidence/{path}`
    - Sort options: by date (default), by name, by size — dropdown
    - Filter by type: All, Images, Audio, Video, Documents, Data — button group
    - Loading: show skeleton cards
    - Empty: "No evidence files found"
    - Performance: don't pre-render 241 items into DOM at once — use pagination (20 per page) or lazy render on scroll
    - Subdirectory handling: files in subdirectories shown with their relative path as a badge

  **Must NOT do**:
  - No in-page media player (click to open in new tab)
  - No search bar
  - No bulk download
  - No file delete/upload

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Gallery grid, file type icons, filtering, pagination
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 8, 10, 11)
  - **Blocks**: Task 12
  - **Blocked By**: Task 3

  **References**:
  - `fleet-server/public/style.css` — Grid layout, card patterns
  - No gallery pattern exists in vault — this is new

  **Acceptance Criteria**:
  - [ ] Evidence grid shows file cards with type icons
  - [ ] 241+ files load without freezing browser
  - [ ] Pagination shows 20 files per page
  - [ ] Type filter buttons work (All, Images, Audio, etc.)
  - [ ] Sort dropdown works (date, name, size)
  - [ ] Clicking a file opens in new tab
  - [ ] Loading state shows skeleton cards

  **QA Scenarios**:
  ```
  Scenario: Evidence gallery loads and paginates
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Navigate to http://localhost:3099/#evidence
      2. Wait for files to load
      3. Verify pagination controls are visible (showing "Page 1 of N")
      4. Click "Next page" — verify content changes
      5. Click "Images" filter — verify only image files shown
      6. Check no console errors
    Expected Result: Gallery loads, paginates, filters work
    Evidence: .omo/evidence/task-9-evidence.png

  Scenario: File opens in new tab
    Tool: Playwright
    Preconditions: Gallery loaded
    Steps:
      1. Click on a file card
      2. Wait for new tab/page to load
      3. Verify new page contains file content (or download starts)
    Expected Result: File opens/downloads correctly
    Evidence: .omo/evidence/task-9-file-open.txt
  ```

  **Evidence to Capture**:
  - [ ] Gallery page screenshot
  - [ ] Filtered view screenshot
  - [ ] File open verification

  **Commit**: YES (with Wave 2)

- [x] 10. Frontend — Scheduler viewer + editor

  **What to do**:
  - Add `renderScheduler()` to `public/app.js` — renders on `#scheduler` page:
    - Fetch `/api/scheduled-tasks`
    - Table of scheduled tasks with columns:
      - Task name (shortened display name)
      - Schedule (daily at 00:00, every 5 min)
      - Status (Ready/Disabled/Running)
      - Next Run Time (or "N/A")
      - Last Run Time (or "Never")
      - Last Result (or "-")
      - Actions: Enable/Disable toggle button
    - Enable/Disable toggle:
      - POST to `/api/scheduled-tasks/{taskName}` with `{ enabled: true/false }`
      - If 403 (non-admin): show red toast "Server not running as Administrator. Restart as Admin to modify tasks."
      - If 200: show green toast "Task {name} enabled/disabled", update table
    - Admin status indicator: badge at top showing "Server: Administrator" (green) or "Server: Limited" (yellow, edit buttons disabled)
    - Loading state
    - Error state: "Scheduler data unavailable" if schtasks command fails

  **Must NOT do**:
  - No CRON visual editor
  - No delete/recreate tasks
  - No change schedule from UI (too risky — would need delete+recreate)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Data table, toggle buttons, admin status badge
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7, 8, 9, 11)
  - **Blocks**: Task 12
  - **Blocked By**: Tasks 3, 6

  **References**:
  - `fleet-server/public/app.js` — Table rendering, fetch patterns
  - `fleet-server/public/style.css:80-120` — Table/row styling

  **Acceptance Criteria**:
  - [ ] Scheduler page shows task table with all columns
  - [ ] Admin status badge shows correct mode
  - [ ] Toggle button triggers POST and shows toast
  - [ ] Non-admin mode shows disabled buttons with explanation
  - [ ] Table updates after toggle without full page reload
  - [ ] Error state when schtasks unavailable

  **QA Scenarios**:
  ```
  Scenario: Scheduler table renders with tasks
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Navigate to http://localhost:3099/#scheduler
      2. Wait for table to load
      3. Take snapshot — verify 2 task rows (vault-pulse + pulse-test)
      4. Check admin status badge
      5. If admin: click toggle, verify toast
      6. If non-admin: verify toggle shows "Requires admin" message
    Expected Result: Scheduler page fully functional with correct admin mode
    Evidence: .omo/evidence/task-10-scheduler.png
  ```

  **Evidence to Capture**:
  - [ ] Scheduler page screenshot
  - [ ] Admin/limited badge screenshot
  - [ ] Toggle result toast

  **Commit**: YES (with Wave 2)

- [x] 11. Frontend — Auto-refresh (30s polling)

  **What to do**:
  - Add to `public/app.js`:
    - `startAutoRefresh()` function
    - On page load, start a 30-second `setInterval`
    - On each tick, re-fetch data for the currently active page and re-render
    - On navigation (hash change), immediately re-render (don't wait for next tick)
    - Don't refresh if the page is hidden (use `document.hidden` or `visibilitychange` event) — saves resources
    - Manual "Refresh now" button in the header
    - Last updated timestamp displayed (e.g., "Last updated: 21:45:30")
    - Loading spinner only on first load, not on auto-refresh (smooth transition)

  **Must NOT do**:
  - No WebSocket (30s polling is sufficient)
  - No loading flicker on auto-refresh

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Simple setInterval, visibility API, DOM updates
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (fits anywhere)
  - **Blocks**: Task 12
  - **Blocked By**: Task 3

  **Acceptance Criteria**:
  - [ ] Data refreshes every 30 seconds on all pages
  - [ ] No refresh when browser tab is hidden
  - [ ] "Refresh now" button forces immediate refresh
  - [ ] "Last updated" timestamp updates correctly
  - [ ] Navigation immediately shows fresh data

  **QA Scenarios**:
  ```
  Scenario: Auto-refresh updates data
    Tool: Playwright
    Preconditions: Dashboard page open
    Steps:
      1. Note current "Last updated" timestamp
      2. Wait 35 seconds
      3. Verify "Last updated" timestamp has changed
      4. Check no page flicker or console errors
    Expected Result: Data updates silently every 30s
    Evidence: .omo/evidence/task-11-autorefresh.txt

  Scenario: Refresh now button works
    Tool: Playwright
    Preconditions: Dashboard open
    Steps:
      1. Click "Refresh now" button
      2. Verify "Last updated" updates immediately
    Expected Result: Manual refresh works
    Evidence: .omo/evidence/task-11-refresh-now.txt
  ```

  **Evidence to Capture**:
  - [ ] "Last updated" timestamp screenshot
  - [ ] Refresh now button screenshot

  **Commit**: YES (with Wave 2)

---

## TODOs (Wave 3 — Polish + Tests)

- [x] 12. Error handling + graceful degradation

  **What to do**:
  - Review ALL existing frontend pages for error states:
    - Each data-fetching function must handle:
      - HTTP error (non-200 response): show "Data temporarily unavailable" card
      - Network error (fetch throws): show "Server unreachable" with retry button
      - Empty data (empty array/null): show "No data available yet" message
      - Corrupt data (JSON parse fails): show "Data format error" with details
    - Each page should work independently — if one API fails, other pages still work
  - Backend: add `/api/health` endpoint returning `{ status: 'ok', isAdmin: true/false, uptime: seconds }`
  - Frontend: add health check on page load
    - If health check fails → show full-page "Server offline" message with retry button
    - If health check succeeds but individual APIs fail → show partial degradation
  - Toast system improvements:
    - Error toasts auto-dismiss after 8s (instead of 3s for success)
    - Sticky errors: if same error repeats, don't stack duplicates
  - Console error suppression: catch all unhandled promise rejections
  - Add a footer with version/build info ("Loop Dashboard v1 — 2026")

  **Must NOT do**:
  - No sentry/logging service — errors shown in UI only
  - No error detail page

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Error handling review, edge cases, resilience patterns
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO (depends on all feature pages)
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 13
  - **Blocked By**: Tasks 7, 8, 9, 10, 11

  **Acceptance Criteria**:
  - [ ] Delete `.omo/pulse-trend.json` → Dashboard shows "Data unavailable" card, not crash
  - [ ] Delete `.omo/loop-slots.json` → Config page shows "No data" state
  - [ ] Kill server → Dashboard shows "Server offline" full-page message
  - [ ] Restart server → Everything recovers
  - [ ] No unhandled promise rejections in console
  - [ ] Toast duplicates don't stack for same error

  **QA Scenarios**:
  ```
  Scenario: Missing data source degrades gracefully
    Tool: Bash + Playwright
    Preconditions: Server running
    Steps:
      1. Backup and remove pulse-trend.json: `mv .omo/pulse-trend.json .omo/pulse-trend.json.bak`
      2. Navigate to Dashboard page
      3. Verify trend chart area shows "Data unavailable" message
      4. Verify state cards still render (they use different API)
      5. Restore: `mv .omo/pulse-trend.json.bak .omo/pulse-trend.json`
      6. Refresh — verify chart returns
    Expected Result: Chart panel degrades gracefully, other panels unaffected
    Evidence: .omo/evidence/task-12-missing-source.png

  Scenario: Server offline full-page message
    Tool: Playwright
    Preconditions: Server running
    Steps:
      1. Stop the server
      2. Refresh dashboard page
      3. Verify "Server offline" full-page message with retry button
      4. Start server again
      5. Click retry — verify dashboard loads fully
    Expected Result: Clear server offline state with recovery
    Evidence: .omo/evidence/task-12-server-offline.png
  ```

  **Evidence to Capture**:
  - [ ] Degraded dashboard screenshot
  - [ ] Server offline screenshot
  - [ ] Recovery screenshot

  **Commit**: YES (with Wave 3)
  - Message: `feat(loop-dashboard): add error handling and graceful degradation`

- [x] 13. Integration tests (agent-executed QA scenarios)

  **What to do**:
  - Create a comprehensive test script `00-System/Tools/loop-dashboard/smoke-test.bat` that:
    1. Starts the server
    2. Runs curl tests for all endpoints
    3. Verifies HTTP 200 for each
    4. Tests write endpoints (toggle kill-switch, restore)
    5. Tests error states (404, 403)
    6. Kills server
  - Create a cross-feature integration test:
    1. Start server
    2. Open dashboard in browser (via Playwright)
    3. Navigate to all 5 pages — verify no errors
    4. Change config → verify state panel updates
    5. Open evidence → navigate pages → verify pagination
    6. Toggle scheduler (if admin) → verify table updates
    7. Wait for auto-refresh → verify timestamp updates
  - Document test results in `.omo/evidence/`

  **Must NOT do**:
  - No formal test framework (mocha/jest) — keep it as shell + Playwright scripts
  - No CI integration

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Automated smoke tests, cross-feature integration
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Task 14
  - **Blocked By**: Task 12

  **Acceptance Criteria**:
  - [ ] Smoke test script passes all endpoint tests
  - [ ] Integration test covers all 5 pages
  - [ ] Test results saved to `.omo/evidence/`

  **QA Scenarios**:
  ```
  Scenario: Full smoke test passes
    Tool: Bash
    Preconditions: Server not running
    Steps:
      1. Run: `cd 00-System/Tools/loop-dashboard && smoke-test.bat`
      2. Check exit code (0 = pass)
      3. Review output for any FAIL lines
    Expected Result: All tests pass, exit code 0
    Evidence: .omo/evidence/task-13-smoke-test.txt
  ```

  **Evidence to Capture**:
  - [ ] Smoke test output
  - [ ] Integration test screenshots

  **Commit**: YES (with Wave 3)
  - Message: `feat(loop-dashboard): add integration tests and smoke test script`

- [x] 14. README + documentation

  **What to do**:
  - Create `00-System/Tools/loop-dashboard/README.md` with:
    - Quick start: run `run-loop-dashboard.bat`
    - Features overview with screenshots
    - API reference table
    - Architecture diagram (ASCII or Mermaid)
    - Port configuration (how to change from 3099)
    - Admin mode instructions (run as Administrator for scheduler edits)
    - Troubleshooting (port conflicts, BOM errors, schtasks permission)
    - Data sources reference (which files power which panels)
  - Add a comment header to `server.js` with the same quick-start info

  **Must NOT do**:
  - No detailed developer guide (this is an internal tool)
  - No contributing guide

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: Documentation, user guide
  - **Skills**: `[]`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: Nothing (can run last)
  - **Blocked By**: Task 13

  **Acceptance Criteria**:
  - [ ] README.md exists with all sections
  - [ ] Quick start instructions work
  - [ ] API reference lists all 10 endpoints

  **QA Scenarios**:
  ```
  Scenario: Documentation is accurate
    Tool: Bash
    Preconditions: Server not running
    Steps:
      1. Check README exists: `test -f 00-System/Tools/loop-dashboard/README.md && echo "EXISTS"`
      2. Quick start: run `run-loop-dashboard.bat`
      3. Verify server starts
      4. Verify API endpoint from docs works: `curl http://localhost:3099/api/health`
      5. Kill server
    Expected Result: README exists and quick start works
    Evidence: .omo/evidence/task-14-readme.txt
  ```

  **Evidence to Capture**:
  - [ ] README exists
  - [ ] Quick start verification

  **Commit**: YES (with Wave 3)
  - Message: `feat(loop-dashboard): add documentation and README`
  - Files: `README.md`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

- [x] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (curl endpoint, read file, open browser). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .omo/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [x] F2. **Code Quality Review** — `unspecified-high`
  Run `node --check server.js` + linter. Review all files for: path traversal vulnerabilities, command injection risks, unhandled promise rejections, missing error boundaries, console.log in prod, unused imports.
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Security [N issues] | VERDICT`

- [x] F3. **Real Manual QA** — `unspecified-high`
  Start from clean state (server stopped). Start server. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-feature integration (config save → state panel updates). Test error states (missing files, corrupt JSON). Save to `.omo/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [x] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance.
  Output: `Tasks [N/N compliant] | Creep [CLEAN/N issues] | VERDICT`

---

## Commit Strategy

- **Wave 1**: `feat(loop-dashboard): add Express server, API endpoints, frontend shell with trend chart`
- **Wave 2**: `feat(loop-dashboard): add config editor, work history, evidence gallery, scheduler management`
- **Wave 3**: `feat(loop-dashboard): add error handling, tests, and documentation`

---

## Success Criteria

### Verification Commands
```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3099/  # Expected: 200
curl -s http://localhost:3099/api/pulse-trend | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>console.log(JSON.parse(d).length))"  # Expected: >=1
curl -s http://localhost:3099/api/loop-slots | node -e "process.stdin.resume(); let d=''; process.stdin.on('data',c=>d+=c); process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(Object.keys(j).filter(k=>k.startsWith('slot:')).length)})"  # Expected: 4
```

### Final Checklist
- [ ] All 5 dashboard pages render (Dashboard, Config, Works, Evidence, Scheduler)
- [ ] Trend chart shows data with no duplicate flatlines
- [ ] Loop config save shows success toast + updated state
- [ ] Evidence gallery loads 241+ files without timeout
- [ ] Scheduler toggle disables task (or shows admin error gracefully)
- [ ] Auto-refresh updates data every 30s without flicker
- [ ] No JavaScript console errors on any page
- [ ] Missing data sources show "Data unavailable" cards, not crashes
