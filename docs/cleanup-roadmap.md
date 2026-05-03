# Cleanup Roadmap

This document tracks code-smell hotspots and mitigation tasks.

## Hotspots

1. `packages/platform-core/src/index.ts` is a monolithic module.
2. String-path config read/write is brittle (`readValue`/`writeValue`).
3. Display-row highlighting uses prefixed marker strings (`@@`) instead of structured rows.
4. Runtime transport indicator state is simulator-local instead of shared state model.

## Mitigation Plan

### Step 1: Safe structural split

- Extract into modules:
  - `menuSchema.ts`
  - `menuState.ts`
  - `displayFormatter.ts`
  - `transportRuntime.ts`
  - `eventPipeline.ts`

### Step 2: Typed parameter updates

- Replace generic string-path writes with typed update actions.
- Keep menu nodes referencing typed action IDs.

### Step 3: Structured display rows

- Replace prefixed line markers with row objects:
  - `text`, `selected`, `role`

### Step 4: Runtime state convergence

- Move pause/stop indicator semantics into shared runtime transport state where appropriate.

### Step 5: Regression harness

- Add tests that assert visible menu params are either functional or intentionally read-only.
- Add tests for modulation to event outputs (velocity/CC74/CC71).
