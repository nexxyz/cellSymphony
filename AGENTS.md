# AGENTS.md — Conventions for AI Coding Assistants

## Project Overview

Cell Symphony is a monorepo (pnpm workspaces) combining a TypeScript core engine with a Rust realtime synth, packaged as a Tauri desktop app. The app turns cellular automata algorithms into music via a pluggable `BehaviorEngine` system.

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

### Architecture

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
- Prefer parity over convenience when there is a conflict
- Simulator rendering should reflect core state; avoid duplicating/forking control logic outside `platform-core`
- If a simulator-only helper is temporarily necessary, keep it isolated and explicitly documented as temporary
- Any parity-affecting control behavior change must update `docs/menu-and-controls-spec.md` in the same commit
- Tests should prioritize parity at input-routing/state-transition level; UI tests verify rendering only

### Documentation

- `docs/menu-and-controls-spec.md` is the **single source of truth** for menu structure and controls
- Any control/menu/runtime behavior change must update this document in the same commit
- Any menu or feature add/change/remove must also review `docs/menu-help-texts.tsv` and update help entries in the same commit when needed
- `docs/runtime-boundaries.md` describes layer responsibilities
- `docs/engineering-quality-requirements.md` defines CI, coverage, and quality gates
- `docs/implementation-done.md` summarizes the 10-algorithm implementation

### Common Pitfalls

- Multi-line edits that span `scripts` and `devDependencies` blocks in package.json may accidentally delete the `dependencies` block if the pattern doesn't include it
- After editing package.json, always run `pnpm install` to resolve workspace symlinks
- Menu `enum` options for channel targets are strings (`"0"`, `"1"`, `"2"`, `"3"`), not numbers
- `visibleChildren()` filters nodes using optional `visible` predicate on `RuntimeConfig`
