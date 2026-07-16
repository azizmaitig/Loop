# DESIGN.md — agent-loop dashboard

> Extracted from the existing vanilla-CSS codebase (`src/index.css`) and the graph
> components (`src/components/graph/*`). This is an **internal observability
> dashboard** — operational tool, not marketing. Restraint is correct.
> Aesthetic direction: **dark technical / observability console** — Linear/Stripe-ops
> family, mono accents for data, glass-adjacent elevation.

## 0. Design Read

Redesign of an existing internal dashboard. Audience: the engineer running
agent-loops (technical, wants signal density + clarity, not delight).
Language: restrained dark-tech with mono data. Leaning on the existing
dark-glass + tabular-figures aesthetic already present.

Dials (inferred for this context):
- `DESIGN_VARIANCE`: 5 — dashboard, left-aligned, calm
- `MOTION_INTENSITY`: 4 — state-driven, never cinematic
- `VISUAL_DENSITY`: 7 — cockpit; DAG is data-dense

## 1. Tokens

### Color (all from existing `:root`, no orphan hex)

| Token | Value | Use |
|-------|-------|-----|
| `--bg` | `#0d1117` | page background (off-black, not pure #000) |
| `--bg-elev` | `#161b22` | cards, topbar, tabnav, drawer |
| `--bg-elev-2` | `#1c2230` | nested surfaces, hover, skeletons |
| `--border` | `#2a3340` | hairline borders, dividers |
| `--text` | `#e6edf3` | primary text |
| `--text-dim` | `#8b98a5` | secondary, labels, muted |
| `--accent` | `#58a6ff` | single accent (links, active nav, focus) |
| `--ok` | `#3fb950` | pass / completed |
| `--warn` | `#d29922` | running / in-progress |
| `--crit` | `#f85149` | fail / error / cancelled |
| `--pass` | `#3fb950` | (synonym of --ok, charts) |
| `--fail` | `#f85149` | (synonym of --crit) |
| `--error` | `#d29922` | (synonym of --warn) |

**Color rules (locked):**
- One accent only (`--accent`). Status colors are a *separate* semantic
  axis (ok/warn/crit) — they are not "accents", they are state.
- All grays are cool (blue-tinted `#161b22` family). Do NOT mix warm grays.
- No saturation > 80% on purpose; status colors are already desaturated.
- No `#000000` / `#ffffff` — off-black/white only.

### Typography

| Role | Family | Size | Notes |
|------|--------|------|-------|
| UI body | system sans (`ui-sans-serif, system-ui, ...`) | 14px | default |
| Card / node value | same | 24px / 700 | metrics |
| Label / eyebrow | same | 12px / 600 / uppercase / `+0.5px` tracking | `--text-dim` |
| Mono (data) | `ui-monospace, SFMono-Regular, Menlo, monospace` | 11–13px | commands, durations, node command lines, feed |
| Node label | same sans | 13px / 600 | |

- Numbers in data surfaces: `font-variant-numeric: tabular-nums`.
- Headlines/section titles: 15–24px, tight tracking. NO serif.

### Spacing (base unit 4px)

Multiples of 4: 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20 / 24 / 32.
Container max-width: `1320px` (`.app-main`), centered.
DAG screen height: `calc(100vh - 120px)`.

### Radius (one scale, locked)

| Element | Radius |
|---------|--------|
| Page cards / drawer / dag-node | `10px` (`--radius`) |
| Inner chips / pills / buttons | `6px` (small) / `999px` (pill) |
| Resize handle | `2px` |

Mixed radii are allowed ONLY by this rule: containers 10px, inner
controls 6px, status pills full (999px). Follow it everywhere.

### Elevation (current state = FLAT — this is the main weakness)

Current surfaces use **border-only** separation (`1px solid var(--border)`).
That reads sterile. Upgrade path (see §5): layered borders + a
single inset highlight + a tinted (not black) shadow for elevated nodes.

### Z-index scale (establish, do not spam)

| Layer | z |
|-------|---|
| Base content | 0 |
| Sticky topbar / tabnav | 10 |
| DAG resize handle | 20 |
| Drawer backdrop | 50 |
| Drawer | 51 |
| Grain/overlay | 60 (unused for now) |

### Motion (GPU-composited only)

- Allowed: `transform`, `opacity`, `filter`.
- Node pulse (running): `opacity` keyframe only (`dag-pulse`).
- Edge animate (running): xyflow native `animated` (transform-based).
- Hover transitions: `transition: box-shadow 0.15s` (cheap, composited).
- Respect `prefers-reduced-motion`: disable pulse + animated edges.

## 2. Layout

- Three screens (Ops Health / Diagnostic / Graph) under a topbar + tabnav.
- Graph screen = resizable 2-pane (canvas 70% / detail 30%) via
  `react-resizable-panels`.
- DAG canvas: `@xyflow/react` with `colorMode="dark"`.
- Node layout: `dagre` top-down (`rankdir: TB`), `nodesep: 40`, `ranksep: 60`.
- Node default size: `220 × 80` (`NODE_W` / `NODE_H`).

## 3. Component map

| Component | File | Role |
|-----------|------|------|
| `WorkflowGraph` | `graph/WorkflowGraph.tsx` | xyflow canvas, edge builder |
| `DagNode` | `graph/DagNode.tsx` | custom node (phase/task/loop/gate) |
| `NodeDetail` | `graph/NodeDetail.tsx` | right-pane detail of selected node |
| `ReplayPanel` | `screens/ReplayPanel.tsx` | checkpoint replay + timeline |
| `BreadcrumbBar` | `components/BreadcrumbBar.tsx` | deep-link nav |
| `useLoopStream` | `hooks/useLoopStream.tsx` | WS transport + RAF batch |
| `dag-store` | `stores/dag-store.ts` | zustand event→graph reducer |

## 4. Node model

Four kinds, one icon each (lucide-react — already the project's icon
set, keep it consistent, standardize `strokeWidth`):

| kind | icon | meaning |
|------|------|---------|
| `phase` | `Play` | execution phase |
| `task` | `GitBranch` | generic task |
| `loop` | `IterationCw` | iteration boundary |
| `gate` | `Shield` | FSM transition (init→run, run→verify, …) |

Status → color (locked mapping, also used by MiniMap):
`running`→warn, `completed`→ok, `failed`/`cancelled`→crit,
`queued`/`idle`→text-dim, `paused`→accent.

## 5. Upgrades in scope (this pass)

1. **DagNode surface** — replace flat border box with layered elevation:
   - base `1px solid var(--border)`
   - `+1px inset top highlight (rgba(255,255,255,0.04))` for edge light
   - `+` tinted drop shadow keyed to node status color (e.g.
     `0 4px 16px -4px <statusColor at low alpha>`), not pure black
   - status pill gets a tonal fill (already present) — keep, refine alpha
2. **Edge meaning** — running target edge already animates (amber).
   Add: completed-path edges get a faint status tint; failed path
   edges get crit tint. Edge `strokeWidth` 1.5→2 for emphasis.
3. **Interaction states** — node `:hover` lifts (translateY -1px +
   stronger shadow), `selected` gets accent ring (2px `var(--accent)`),
   `:focus` visible ring for keyboard. All via transform/box-shadow only.
4. **Empty + picker states** — composed "no DAG yet" with a clear
   next-step; checkpoint cards get a left status accent bar.
5. **Icon consistency** — lock `strokeWidth={1.5}` across all four node icons.

## 6. Anti-slop (must not regress)

- No emojis in UI (the replay panel currently uses `⏮ ▶ ⏸ ⏭`
  unicode glyphs for transport controls — replace with lucide
  `SkipBack` / `Play` / `Pause` / `SkipForward`).
- No pure black/white.
- No AI-purple gradient.
- No 3-equal-card generic row (N/A here, DAG is a graph).
- Motion only where it signals state (running pulse, animating edge).
- Keep vanilla CSS (do NOT introduce Tailwind/shadcn — match stack).
