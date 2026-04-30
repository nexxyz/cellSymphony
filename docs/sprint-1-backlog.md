# Sprint 1 Backlog (Foundation + Simulator Skeleton)

## Sprint Goal

Establish the modular foundation and desktop simulator skeleton with strict hardware-style controls, while keeping platform/navigation/transport decoupled from generative behavior logic.

## Deliverables

- Monorepo skeleton and package boundaries
- Device contracts and event schemas
- Platform core scaffolding (navigation + transport interfaces)
- Behavior API and Game of Life behavior module scaffold
- Desktop simulator shell with required keyboard/control mappings
- CI workflow scaffold and quality gates in repository

## Backlog Items

### 1) Repository Skeleton

Priority: High

Tasks:

- Create directories:
  - `apps/desktop`
  - `packages/device-contracts`
  - `packages/platform-core`
  - `packages/behavior-api`
  - `packages/behaviors-life`
  - `packages/musical-events`
  - `crates/realtime-engine`
- Add top-level workspace manifests (`pnpm-workspace.yaml`, root `package.json`).
- Add base TypeScript config and shared lint/format config.

Acceptance:

- Workspace install and base scripts resolve cleanly.

### 2) Device Contract Definitions

Priority: High

Tasks:

- Add TS types for device input:
  - `EncoderTurn`, `EncoderPress`, `ButtonA`, `ButtonS`, `GridPress`
- Add TS types for render/output models:
  - `DisplayFrame`, `LedMatrixFrame`, `TransportFrame`, `EngineFrame`
- Add serialization-safe schemas (zod or equivalent) for project storage boundaries.

Acceptance:

- Contract package builds and exports typed public API.

### 3) Platform Core Scaffolding

Priority: High

Tasks:

- Implement navigation state machine skeleton:
  - page selection
  - focus/edit mode
  - Back/Cancel handling (Button A)
- Implement transport state skeleton:
  - play/stop toggle (Button S)
  - bpm value storage
  - clock interface abstraction (implementation deferred)
- Define behavior host interface:
  - register active behavior
  - route input/tick
  - collect `MusicalEvent` output

Acceptance:

- Platform core handles controls without referencing any specific behavior internals.

### 4) Behavior API + Game of Life Module Scaffold

Priority: High

Tasks:

- Create behavior API package with interface/lifecycle contracts.
- Create `behaviors-life` package implementing the interface with placeholders.
- Add deterministic state/tick scaffolding and serialization stubs.

Acceptance:

- Platform can mount behavior module via API without direct imports into UI layer.

### 5) Desktop Simulator UI Skeleton

Priority: High

Tasks:

- Initialize Tauri + React app shell.
- Build required UI elements:
  - screen panel
  - encoder control widget
  - A/S button widgets
  - clickable 16x16 matrix
- Implement keyboard mapping:
  - Left/Right -> encoder delta
  - Enter -> encoder press
  - A/S -> dedicated buttons
- Route events through contract bus only.

Acceptance:

- Visible simulator shell operates with required mappings and emits typed input events.

### 6) CI + Quality Baseline Integration

Priority: High

Tasks:

- Add CI workflow (`.github/workflows/ci.yml`) and adjust scripts as packages land.
- Add minimal test harness in TS packages.
- Add rust crate skeleton with passing fmt/clippy/test commands.

Acceptance:

- CI passes for scaffold state on PR.

## Suggested Task Order

1. Repository skeleton
2. Device contracts
3. Platform core scaffold
4. Behavior API + life scaffold
5. Desktop simulator skeleton
6. CI script wiring and test harness

## Out of Scope for Sprint 1

- Full CA musical mapping logic
- MIDI runtime implementation
- Internal synth DSP implementation
- FLAC import conversion pipeline implementation
- ROMpler playback engine implementation

## Risks and Mitigation

- Risk: accidental coupling between UI and behavior internals.
  - Mitigation: enforce contract-only data flow in code reviews/tests.
- Risk: CI workflow mismatch before scripts exist.
  - Mitigation: include temporary no-op or scaffold scripts and tighten quickly.

## Definition of Done (Sprint 1)

- All Sprint 1 deliverables are merged with passing CI.
- Control mappings match the hardware-first specification.
- Platform/navigation/transport code remains behavior-agnostic.
- A behavior module can be swapped without touching platform core interfaces.
