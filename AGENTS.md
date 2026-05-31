# AGENTS.md — Conventions for AI Coding Assistants

## Project Overview

Cell Symphony is a monorepo (pnpm workspaces) combining a TypeScript core engine with a Rust realtime synth, packaged as a Tauri desktop app. The app turns cellular automata algorithms into music via a pluggable `BehaviorEngine` system.

## AI Assistant Guidelines

### Context Efficiency
- Read only the files directly relevant to the current task; avoid broad directory reads
- Prefer `grep`/`find` to locate specific symbols before reading full files
- Work on one package at a time; do not span multiple packages in a single task unless explicitly asked
- When modifying a file, read only the relevant section first, not the whole file

### Task Scope
- Break large tasks into explicit steps and confirm the plan before making changes
- Complete one step fully before moving to the next
- If a task requires changes to more than 3 files, pause and confirm scope first
- Do not stop before you've reached a conclusion - either a finished task or a roadblock that requires user intervention. In case of a necessary intervention, explicitly tell the user what is required.

### Output Discipline
- Keep explanations brief; code changes speak for themselves
- Do not summarize what you just did after making changes
- Do not add comments to source code (see Code Style)

### Structure Specifics
- `packages/platform-core/src/index.ts` is a barrel export; do not read it to understand scope — navigate directly to the relevant module instead
- The monorepo has many packages; use `pnpm --filter <package>` to scope commands and avoid cross-package side effects
- When tracing behavior registration, start from the specific behavior package, not from `platform-core` entry point

## Key Conventions

### Package Management

- Uses **pnpm** workspaces (not npm or yarn)
- After editing any `package.json`, run `pnpm install` (or `pnpm update -r`) to regenerate workspace symlinks
- All behavior packages depend on `@cellsymphony/behavior-api` and `@cellsymphony/device-contracts`

### Testing

- **Test framework**: Node.js `node:test` + `node:assert/strict` (via `tsx --test`)
- No Jest, no Vitest
- Run with: `pnpm --filter <package> test` or `pnpm -r test`
- Coverage: `pnpm -r test:coverage` (uses `c8`)
- Each behavior package has tests in `tests/*.test.ts`
- Behavior tests verify algorithm correctness (Conway B3/S23, Brian's Brain state machine, ant movement rules, etc.)

### Code Style

- No comments in source code unless absolutely necessary
- TypeScript, strict mode
- Prefer `type` over `interface` for plain data shapes
- Use `export type` and `export function` pattern
- Arrow functions for closures, `function` keyword for top-level exports
- Avoid duplicating operational logic across call sites. If behavior needs shared defaults, timing, validation, state transitions, or formatting, centralize it behind a small helper or existing abstraction. Prefer repeated data over repeated behavior. Example: toast creation should use a shared helper rather than each call site manually constructing `{ message, startedAtMs, untilMs }` or calling `Date.now()`.
- Prefer minimal diffs — change only what is necessary

### Architecture

- Design for Change, not for Future.

- `packages/platform-core/src/index.ts` = single-entry core module (menu, transport, config, behavior orchestration)
- `packages/behavior-api/` = `BehaviorEngine` interface + registry (`registerBehavior`, `getBehavior`, `listBehaviorIds`)
- All behaviors are registered at import time via top-level `registerBehavior()` calls
- `CellTriggerType` = `"activate" | "stable" | "deactivate" | "scanned" | "none"`
- Menu tree is built by `menuTree()` function; per-behavior config from `configMenu()`
- Auto-save: enabled via `runtimeConfig.autoSaveDefault`, triggers `store_save_default` effect on every config change
- Aux encoder binding: press main encoder to enter edit, then press aux encoder to bind

### Hardware/Software Parity

- The desktop/simulator UI is a **stand-in for the hardware interface**, not a separate product UX
- Hardware behavior is canonical: software controls must mirror hardware input semantics and constraints
- Do not add desktop-only control paths that bypass `platform-core` input routing/state transitions
- Do not add desktop-only UI elements or UI logic. All relevant information must be conveyed through the OLED or grid adapters, by central, platform-independent code.
- Prefer parity over convenience when there is a conflict
- Simulator rendering should reflect core state; avoid duplicating/forking control logic outside `platform-core`
- If a simulator-only helper is temporarily necessary, keep it isolated and explicitly documented as temporary
- Any parity-affecting control behavior change must update `docs/menu-and-controls-spec.md` in the same commit
- Tests should prioritize parity at input-routing/state-transition level; UI tests verify rendering only

### Documentation

- `docs/menu-and-controls-spec.md` is the **single source of truth** for menu structure and controls
- Any control/menu/runtime behavior change must update this document in the same commit
- Any menu or feature add/change/remove must also review `packages/platform-core/resources/menu-help-texts.tsv` and update help entries in the same commit when needed
- Help entry coverage is enforced by `pnpm --filter @cellsymphony/platform-core lint`; keep TSV entries in sync so lint remains green
- Enum help rule: when any enum parameter is added/removed/renamed/reordered or its semantics change, update the associated help text in `packages/platform-core/resources/menu-help-texts.tsv` in the same commit; enum help must describe all current options in main help text
- Quality thresholds are currently staged in warning mode (complexity/LOC/params) and will be promoted to strict errors after initial hotspot cleanup
- `docs/runtime-boundaries.md` describes layer responsibilities
- `docs/engineering-quality-requirements.md` defines CI, coverage, and quality gates
- `docs/implementation-done.md` summarizes the 10-algorithm implementation

### Common Pitfalls

- Multi-line edits that span `scripts` and `devDependencies` blocks in package.json may accidentally delete the `dependencies` block if the pattern doesn't include it
- After editing package.json, always run `pnpm install` to resolve workspace symlinks
- Menu `enum` options for channel targets are strings (`"0"`, `"1"`, `"2"`, `"3"`), not numbers
- `visibleChildren()` filters nodes using optional `visible` predicate on `RuntimeConfig`
