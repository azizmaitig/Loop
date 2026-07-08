# Loop Tracker — 88-Labs Experiment Dashboard

## Overview
Create a live auto-refreshing dark-themed HTML dashboard that displays all 88-Labs experiment stats. The data format uses `window.__LOOP_STATS` JS variable (not JSON/fetch) so it works from `file://` protocol without CORS errors.

## TODOs

1. [x] Create 88-Labs/loop-stats.js with window.__LOOP_STATS backfilling all 7 experiments
2. [x] Create 88-Labs/loop-tracker.html — dark-themed live auto-refreshing dashboard using script-tag load
3. [x] Update .opencode/skills/88-labs/SKILL.md Phase 4 — write JS variable format after persist + auto-increment counter

## Final Verification Wave

F1. [x] Verify loop-stats.js loads correctly — zero CORS/network errors, all 7 experiments display
F2. [x] Verify SKILL.md Phase 4 has JS variable write + counter increment — dashboard auto-refreshes

## Success Criteria
- Dashboard works from `file://` (no server needed)
- All 7 experiments shown with stats
- Auto-refresh detects new data without page reload
- SKILL.md counter increments after each loop iteration
- Zero CORS or network errors in browser console

## Data File Format
```
window.__LOOP_STATS = {
  "experiments": [
    {
      "name": "...",
      "slug": "...",
      "date": "YYYY-MM-DD",
      "totalIterations": N,
      "completionSignals": ["INCOMPLETE", "SATISFACTORY", ...],
      "finalSignal": "SATISFACTORY|EXHAUSTED|ABORT|INCOMPLETE",
      "clusters": N,
      "totalSources": N,
      "highConfidenceFindings": N,
      "unresolvedContradictions": N
    }
  ],
  "totalExperiments": 7,
  "totalIterations": N,
  "lastUpdated": "ISO_TIMESTAMP"
}
```
