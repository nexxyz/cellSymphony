# Runtime Boundaries

This project keeps UI/hardware emulation separate from logic and processing.

Authoritative menu/control behavior spec: `docs/menu-and-controls-spec.md`.

## Layer Responsibilities

- UI layer (`apps/desktop/src/`)
  - renders simulator snapshot data
  - captures user interaction and emits `DeviceInput`
  - contains no transport/menu/audio/interpretation logic

- Runtime orchestration layer (`apps/desktop/src/runtime`)
  - owns lifecycle (`start`/`stop`)
  - schedules ticks through `runtimeScheduler`
  - applies core state transitions (`routeInput`, `tick`)
  - publishes snapshots and musical events
  - owns MIDI input/output via Tauri bridges only (no Web MIDI)

- Core logic layer (`packages/platform-core`, `packages/interpretation-core`, `packages/mapping-core`, `packages/behavior-api`, all behavior packages)
  - deterministic simulation, menu/control state, interpretation, mapping
  - no UI framework code
  - no platform-specific I/O

- Output adapters (`apps/desktop/src/runtime/outputAdapters/`)
  - desktop audio sink maps musical events to native Tauri/rodio
  - MIDI output via `tauriMidi.ts` (Tauri→midir)

## Dependency Rules

- UI may import runtime modules and type contracts only.
- UI must not call `tick`, `routeInput`, or native audio/MIDI bridges directly.
- Runtime may import core and output/input adapters.
- Core packages must stay platform-agnostic.

## Data Flow

1. UI interaction -> `DeviceInput`
2. Runtime receives input -> `platform-core` transition
3. Runtime scheduler triggers tick -> `platform-core` processing
4. Runtime publishes snapshot -> UI render (OLED + NeoKey LEDs)
5. Runtime publishes musical events -> output adapters (audio/MIDI)
