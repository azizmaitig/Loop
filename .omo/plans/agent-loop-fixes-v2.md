# agent-loop-fixes-v2 - Work Plan

## TL;DR (For humans)

**What you'll get:** 3 concrete fixes that close the remaining gaps: (1) the llm-api test will pass in any environment, (2) agentmemory hooks will be verified working end-to-end, (3) the dashboard SPA will load on `/dashboard`.

**Effort:** ~100 LOC across 4 files. All 3 are independent.

**Risk:** Very low. One test change, one daemon config, one path fix.

## Scope

**IN:**
- `__tests__/llm-api.test.ts` — fix mock to work with custom `LLM_ENDPOINT` + fix `safeBodySnippet` for short error bodies
- `src/daemon.ts` — fix dashboard path resolution
- `src/dashboard/index.html` — exists (859 lines), no changes needed
- `src/agentmemory.ts`, `src/memory-hooks.ts` — E2E verification only, no code changes

**OUT:**
- New agentmemory features
- Dashboard SPA redesign
- Any new LLM providers

## Execution strategy

All 3 are independent — can be executed in parallel.

## Todos

### T1: Fix llm-api.test.ts mock and safeBodySnippet

**Files:** `__tests__/llm-api.test.ts`, `src/llm.ts`

**Root cause:** The test mocks `globalThis.fetch` with URL matchers for `api.openai.com` / `api.anthropic.com`. When `LLM_ENDPOINT` is set to NVIDIA's URL, the mock doesn't intercept → real HTTP request → 404 response from NVIDIA → test fails. Also, `safeBodySnippet` truncates to 200 chars and appends no context about response code, obscuring the real error.

**Changes (all 3 mocks in the file, lines 15-21, 51-60, 95-104):**
1. `__tests__/llm-api.test.ts`: Change each mock's URL filter from `urlStr.includes("api.openai.com") || urlStr.includes("api.anthropic.com")` to `!urlStr.includes('localhost') && !urlStr.includes('127.0.0.1')`. This intercepts ALL external API calls (OpenAI, Anthropic, NVIDIA, Ollama, any custom endpoint) while letting the test's own `fetch` calls to `http://localhost:PORT/api/llm` pass through to the real daemon.
2. `src/llm.ts` (`safeBodySnippet`): No change needed — existing function works correctly. The issue is purely the mock URL filter.

**References:**
- `__tests__/llm-api.test.ts:17-19` — mock URL filter matches only `api.openai.com` / `api.anthropic.com`
- `__tests__/llm-api.test.ts:15-21` — test 1 mock (fail)
- `__tests__/llm-api.test.ts:51-60` — test 2 mock (success)
- `__tests__/llm-api.test.ts:95-104` — test 3 mock (success)
- `src/llm.ts:124-131` — `safeBodySnippet` reads up to 200 chars
- `src/llm.ts:63-67` — `callLLM` throws `OpenAI API error (${res.status}): ${snippet}`

**Acceptance criteria:**
- Test `POST /api/llm > returns 500 when callLLM fails and includes error message` passes with `LLM_ENDPOINT` set to any value
- All llm-api tests pass
- `bun test __tests__/llm-api.test.ts` exits 0

**QA:**
- Happy: Test passes with NVIDIA endpoint set (or any custom endpoint)
- Failure: Test still fails with 404 → mock not intercepting
- Evidence: `bun test __tests__/llm-api.test.ts` exits 0

**Commit:** `fix: make llm-api.test.ts mock URL-agnostic for custom endpoints`

---

### T2: Agentmemory E2E verification

**Files:** No code changes — verification only.

**Root cause:** All agentmemory code already exists and is wired (`src/agentmemory.ts`: 8 functions, `src/memory-hooks.ts`: 4 hooks, `src/loop.ts`: imports and lifecycle callbacks). But the `agentmemory` daemon (`localhost:3111`) was never running during testing, so hooks silently fail.

**Changes:**
1. Start `agentmemory` daemon in background (port 3111)
2. Run the stress-test plan with `--memory` flag: `bun run loop.ts start --plan plans/stress-test.yaml --memory`
3. Check that lifecycle hooks (`onPhaseFailed`, `onLoopComplete`) fire without errors
4. If hooks fail: fix any connection/binding issues

**References:**
- `src/agentmemory.ts` — 5 exported functions: `saveEpisodic`, `recallLessons`, `archiveSession`, `saveLesson`, `pushPulse`, all using fire-and-forget `fetch` to `http://localhost:3111`
- `src/memory-hooks.ts` — 4 hooks: `logPhaseContext`, `onPhaseFailed`, `onLoopComplete`, `computeHealthScore`
- `loop.ts:26` — `import { onPhaseFailed, onLoopComplete, logPhaseContext } from './src/memory-hooks.js'`
- `loop.ts:765-767` — `--memory` flag sets `config.memory = { enabled: true }`
- Start command: `agentmemory` (requires `npx @agentmemory/agentmemory` or global install)

**Acceptance criteria:**
- `agentmemory` daemon starts on `:3111`
- Loop runs without `agentmemory` connection errors in stderr
- At least one memory hook fires (verify via `bun test` or console log)

**QA:**
- Happy: Loop run completes with `[memory]` or `[memory-hooks]` prefix lines in console
- Failure: No `[memory]`/`[memory-hooks]` output, or `[agentmemory]` error prefix appears (daemon not running)
- Evidence: Console output contains `[memory]` or `[memory-hooks]` prefixes

**Commit:** N/A — no code changes (verification only)

---

### T3: Fix dashboard path resolution

**File:** `src/daemon.ts`

**Root cause:** `daemon.ts:94` uses `resolve(import.meta.dirname, 'dashboard', 'index.html')`. On Windows, `import.meta.dirname` = `D:\...\agent-loop\src\` (the directory of the `.ts` file). So it resolves to `src/dashboard/index.html`. The dashboard file IS at `src/dashboard/index.html`, so this should work.

**Changes:**
1. Verify the actual resolved path matches the file on disk
2. If mismatch: fix the resolve call to use `resolve(import.meta.dirname, '..', 'src', 'dashboard', 'index.html')` or similar
3. If already correct: add a `console.log` to confirm the resolved path at startup for debugging

**References:**
- `src/daemon.ts:94-96` — `resolve(import.meta.dirname, 'dashboard', 'index.html')`
- `src/dashboard/index.html` — exists (859 lines)
- Windows path: `import.meta.dirname` = `file:///D:/.../src/` → `dirname` = `D:\...\src`

**Acceptance criteria:**
- Daemon starts without "dashboard/index.html not found" warning
- `curl http://localhost:3000/dashboard` returns HTML (200)
- Dashboard page renders (check via browser or curl)

**QA:**
- Happy: Dashboard loads at `/dashboard` route
- Failure: Still 404 → path still wrong
- Evidence: `curl http://localhost:3000/dashboard | head -5` returns HTML content

**Commit:** `fix: resolve dashboard path correctly on Windows`

---

## Final verification wave

| Check | Command |
|-------|---------|
| F1: Test suite | `bun test` — all pass |
| F2: Dashboard | `curl http://localhost:3000/dashboard` returns 200 |
| F3: Agentmemory | Stress-test plan runs without connection errors |
| F4: Git diff | Only `__tests__/llm-api.test.ts`, `src/daemon.ts` changed |

## Commit strategy

Conventional commits, order doesn't matter:
1. `fix: make llm-api.test.ts mock URL-agnostic for custom endpoints`
2. `fix: resolve dashboard path correctly on Windows`

PR title: `fix: resolve 3 remaining gaps — test, dashboard, agentmemory verification`

## Success criteria

- `bun test` exits 0 (no pre-existing failures)
- Dashboard loads at `/dashboard`
- Agentmemory hooks verified working during loop execution
