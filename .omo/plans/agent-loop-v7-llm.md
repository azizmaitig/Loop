# agent-loop-v7-llm - Work Plan

## TL;DR (For humans)

**What you'll get:** Your loop will talk to OpenAI or Anthropic. Tasks can call an LLM directly, evaluations use AI instead of exit codes, and the maker/checker plugin verifies results intelligently. One `.env` file configures everything.

**Why this approach:** One function, raw `fetch()`, no npm deps. Reuses your existing API key. Works with OpenAI, Anthropic, or any OpenAI-compatible endpoint (local Ollama, etc.).

**What it will NOT do:** No streaming, no retry logic, no multi-model routing. Simple request-response LLM calls.

**Effort:** Short
**Risk:** Low — additive code, no breaking changes
**Decisions to sanity-check:** The provider dispatch logic (OpenAI vs Anthropic URL/format)

Your next move: approve. Execution is ~30 min.

---

> TL;DR (machine): Short, Low. Add `src/llm.ts` with `callLLM()`, refactor evaluate.ts, add POST /api/llm + POST /task llm support, update maker/checker plugin. Tests included.

## Scope
### Must have
- `src/llm.ts` — single function `callLLM(config, prompt, system?)` using `fetch()`, dispatches to OpenAI or Anthropic via `LLM_PROVIDER` env var
- `src/types.ts` — `LLMConfig` type: `{ provider, apiKey, model, endpoint?, maxTokens?, temperature? }`
- `.env.example` — `LLM_PROVIDER=openai|anthropic LLM_API_KEY=sk-... LLM_MODEL=gpt-4o`
- `src/evaluate.ts` — new direct path: if `phase.llm.provider` exists, call `callLLM()` instead of MCP; keep MCP as fallback
- `src/daemon.ts` — `POST /api/llm` endpoint (auth-gated), returns `{ response, model, usage? }`
- `src/daemon.ts` — `POST /task` with `llm: { prompt, system? }` executes via LLM instead of shell
- `src/maker-checker-plugin.ts` — maker checker sends result to LLM for judgment instead of re-executing
- `POST /api/llm` — 401 without auth, 400 if no prompt, 200 with response
- Tests: provider unit tests, evaluate unit, daemon API tests, maker-checker tests

### Must NOT have (guardrails, anti-slop, scope boundaries)
- No npm packages for LLM (only fetch)
- No streaming
- No retry/backoff
- No multi-provider per-task (one provider per daemon instance)
- No breaking changes to existing APIs (MCP eval still works)
- No changes to plan-executor.ts, orchestrator.ts, triggers.ts, history.ts

## Verification strategy
> Zero human intervention - all verification is agent-executed.
- Test decision: TDD (red-green-refactor per module)
- Evidence: `.omo/evidence/task-<N>-agent-loop-v7-llm.md`

## Execution strategy
### Parallel execution waves
Wave 1: Todo 1+2 parallel (types + provider module)
Wave 2: Todos 3+4+5 parallel (evaluate refactor, daemon API, maker/checker)
Wave 3: Todo 6 (tests)
Wave FINAL: 4 verification checks

### Dependency matrix
| Todo | Depends on | Blocks | Can parallelize with |
| --- | --- | --- | --- |
| 1. LLM types | None | 3,4,5 | 2 |
| 2. LLM provider (`src/llm.ts`) | None | 3,4,5 | 1 |
| 3. Evaluate refactor | 1,2 | 6 | 4,5 |
| 4. Daemon LLM API + task | 1,2 | 6 | 3,5 |
| 5. Maker/checker AI | 1,2 | 6 | 3,4 |
| 6. Tests | 3,4,5 | Final | None |

## Todos
> Implementation + Test = ONE todo. Never separate.
<!-- APPEND TASK BATCHES BELOW THIS LINE WITH edit/apply_patch - never rewrite the headers above. -->
- [ ] 1. Add LLM types to `src/types.ts`
  What to do / Must NOT do: Add `LLMConfig` interface and `LLMProvider` string literal type. Do NOT modify any existing types.
  Parallelization: Wave 1 | Blocked by: None | Blocks: 3,4,5
  References: `src/types.ts` (full file, 183 lines — add after existing types)
  Acceptance criteria: `LLMConfig` has `provider`, `apiKey`, `model`, `endpoint?`, `maxTokens?`, `temperature?`. TypeScript compiles.
  QA scenarios: `tsc --noEmit` passes; grep for `LLMConfig` in types.ts. Evidence `.omo/evidence/task-1-agent-loop-v7-llm.md`
  Commit: Y | `feat(agent-loop-v7): add LLMConfig type`

- [ ] 2. Implement LLM provider `src/llm.ts`
  What to do / Must NOT do: Create `callLLM(config: LLMConfig, prompt: string, system?: string): Promise<string>`. Uses raw `fetch()`. OpenAI: POST https://api.openai.com/v1/chat/completions. Anthropic: POST https://api.anthropic.com/v1/messages (requires `anthropic-version` header). Parse response and return content text. Must handle HTTP errors, non-JSON responses, empty content. Do NOT add npm packages, do NOT add streaming.
  Parallelization: Wave 1 | Blocked by: None | Blocks: 3,4,5
  References: `src/types.ts` (LLMConfig type), OpenAI API docs (chat completions), Anthropic API docs (messages)
  Acceptance criteria: `callLLM({ provider: 'openai', apiKey: 'sk-test', model: 'gpt-4o' }, 'say hi')` returns a string. `callLLM({ provider: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-sonnet-4' }, 'say hi')` returns a string. Bad API key throws error with message.
  QA scenarios: Unit test with mocked fetch. Test both providers. Test error cases (401, 500, timeout). Evidence `.omo/evidence/task-2-agent-loop-v7-llm.md`
  Commit: Y | `feat(agent-loop-v7): add callLLM provider with OpenAI/Anthropic support`

- [ ] 3. Refactor `src/evaluate.ts` to use direct LLM
  What to do / Must NOT do: In `evaluatePhase()`, if `phase.llm` has `provider` field (not `mcpServer`), call `callLLM()` directly instead of `executeMcpPhase()`. Keep MCP path as fallback when `phase.llm.mcpServer` is set. Must parse JSON response same way. Update `PhaseDef.llm` type to accept both shapes.
  Parallelization: Wave 2 | Blocked by: 1,2 | Blocks: 6
  References: `src/evaluate.ts` (81 lines, lines 59-61 are MCP call, lines 62-69 parse response), `src/types.ts` (PhaseDef line 8)
  Acceptance criteria: When phase.llm has `provider`, evaluatePhase returns Judgment from direct LLM response. When phase.llm has `mcpServer`, uses old MCP path. LLM parse error falls back to exit code.
  QA scenarios: Unit test with mocked callLLM returning valid/invalid JSON. Unit test MCP path still works. Evidence `.omo/evidence/task-3-agent-loop-v7-llm.md`
  Commit: Y | `feat(agent-loop-v7): refactor evaluatePhase to support direct LLM calls`

- [ ] 4. Add `POST /api/llm` endpoint + `POST /task` LLM support to daemon
  What to do / Must NOT do: In `src/daemon.ts`, add `POST /api/llm` route (requires auth, body: `{ prompt, system?, model?, temperature? }`, returns `{ response, model }`). In task execution loop, if task has `llm.prompt`, call `callLLM()` instead of `Bun.spawnSync()`. Must NOT break existing task execution or auth.
  Parallelization: Wave 2 | Blocked by: 1,2 | Blocks: 6
  References: `src/daemon.ts` (route registration, auth gate, executeTask), `src/task-queue.ts` (Task type has llm field)
  Acceptance criteria: `curl -X POST http://localhost:3000/api/llm -H "x-api-key: test123" -d '{"prompt":"say hi"}'` returns 200 with response string. `curl -X POST http://localhost:3000/task -H "x-api-key: test123" -d '{"command":"echo hi"}'` still works. Existing tests pass.
  QA scenarios: Daemon integration test — POST /api/llm with auth, without auth (401), with invalid body (400). POST /task with shell command still works (regression). Evidence `.omo/evidence/task-4-agent-loop-v7-llm.md`
  Commit: Y | `feat(agent-loop-v7): add /api/llm endpoint and LLM task execution`

- [ ] 5. Update maker/checker plugin for AI verification
  What to do / Must NOT do: In `src/maker-checker-plugin.ts`, after initial execution, send stdout+stderr+exitCode to LLM via `callLLM()` for judgment. If LLM says passed, accept. If LLM says failed, re-run (old behavior). LLM call uses default provider from env. Must NOT break existing double-execution fallback.
  Parallelization: Wave 2 | Blocked by: 1,2 | Blocks: 6
  References: `src/maker-checker-plugin.ts` (current double-exec logic), `src/llm.ts` (callLLM)
  Acceptance criteria: Plugin calls LLM before re-running. If LLM approves, skips re-run. If LLM rejects or errors, falls back to re-run.
  QA scenarios: Mock callLLM to approve → verify only 1 execution. Mock callLLM to reject → verify 2 executions. Evidence `.omo/evidence/task-5-agent-loop-v7-llm.md`
  Commit: Y | `feat(agent-loop-v7): add AI verification to maker/checker plugin`

- [ ] 6. Integration tests for all LLM paths
  What to do / Must NOT do: Create `__tests__/llm.test.ts` — unit tests for callLLM with mocked fetch, test for evaluate.ts direct LLM path, daemon integration test for POST /api/llm (mock fetch). Create `__tests__/maker-checker-llm.test.ts` — test AI verification. Do NOT call real APIs in tests (mock fetch globally).
  Parallelization: Wave 3 | Blocked by: 3,4,5 | Blocks: Final
  References: `src/llm.ts`, `src/evaluate.ts`, `src/daemon.ts`, `src/maker-checker-plugin.ts`
  Acceptance criteria: +15 new tests minimum. All existing 302 tests still pass. `bun test` exits 0.
  QA scenarios: Run `bun test` — all pass. Evidence `.omo/evidence/task-6-agent-loop-v7-llm.md`
  Commit: Y | `test(agent-loop-v7): add LLM provider + API + maker/checker tests`

## Final verification wave
> Runs in parallel after ALL todos. ALL must APPROVE. Surface results and wait for the user's explicit okay before declaring complete.
- [ ] F1. `bun test` — all existing + new tests pass
- [ ] F2. `tsc --noEmit` — no type errors
- [ ] F3. Verify no npm packages added (grep package.json for openai, anthropic)
- [ ] F4. Verify no breaking changes (old POST /task still works, MCP eval still works)

## Commit strategy
5 commits (1 per todo), all prefixed `feat/test(agent-loop-v7)`. Conventional commits.

## Success criteria
- [ ] `src/llm.ts` exports `callLLM()` supporting OpenAI and Anthropic
- [ ] `src/evaluate.ts` supports direct LLM path + keeps MCP fallback
- [ ] `POST /api/llm` returns LLM response
- [ ] `POST /task` with `llm: { prompt }` executes via LLM
- [ ] Maker/checker plugin uses LLM for AI verification
- [ ] 302+ tests pass, tsc clean, zero npm deps added
- [ ] `.env.example` documents all LLM config vars
