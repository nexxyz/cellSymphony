# Architecture Modularity Requirements

## Intent

The platform must separate "device operation basics" from "musical/generative behaviors" so the same firmware/app foundation can later host multiple paradigms (generative, drum machine, step sequencer, clip launcher, performance controller) without core rewrites.

## Hard Separation Boundaries

### 1) Platform Layer (reusable)

Owns:

- Navigation model (pages, focus, edit/select states)
- Input abstraction (encoder, buttons, matrix presses)
- Transport control (play, stop, tempo, clock state)
- MIDI and audio I/O plumbing
- Patch/sample/project persistence
- Render contracts for screen and LED matrix

Must not depend on:

- Any specific generator algorithm (e.g., Game of Life)
- Any single sequencing philosophy

### 2) Behavior Engine Layer (replaceable)

Owns:

- Musical behavior modules that produce note/trigger/modulation events
- Generative algorithm implementations
- Future paradigms (drum machine, step sequencer, launchpad-style modes)

Must depend only on:

- Stable platform contracts (transport, device input events, output event bus)

### 3) Sound Engine Layer (reusable)

Owns:

- Internal synth engine(s)
- ROMpler one-shot engine
- Voice allocation and mix bus

Must be independent of:

- Specific behavior engines (it consumes generic musical events)

## Contract-Driven Design Rules

- All user interaction enters through a `DeviceInput` bus.
- All musical behaviors emit generic `MusicalEvent` messages.
- Sound and MIDI backends consume `MusicalEvent` only.
- UI renders from `DisplayFrame` and `LedMatrixFrame` models only.

No direct coupling allowed between:

- UI components and specific behavior internals
- Behavior modules and concrete UI widgets
- Behavior modules and concrete audio implementation details

## Proposed Package Structure

- `packages/platform-core`
  - navigation state machine
  - transport state and clock interface
  - project schema and persistence APIs
  - shared event bus contracts
- `packages/behavior-api`
  - behavior engine interface definitions
  - lifecycle hooks and capability descriptors
- `packages/behaviors-life`
  - Conway/Game-of-Life behavior implementation
- `packages/device-contracts`
  - input/output frame and event types
- `packages/musical-events`
  - common note/trigger/cc event schema
- `crates/realtime-engine`
  - scheduler, MIDI, synth, ROMpler
- `apps/desktop`
  - simulator UI shell, diagnostics UI, adapter bindings

## Behavior Engine Interface (high-level)

Each behavior module should provide:

- `init(config, context)`
- `onInput(deviceInput, context)`
- `onTick(tickContext)`
- `renderModel()` for behavior-specific display segment
- `serialize()/deserialize()` for project persistence

Context access should be capability-scoped (transport query, grid state helpers, event emitters), not full mutable global state.

## Extensibility Requirements

- Adding a new behavior mode must not require changes to audio engine core.
- Adding a new behavior mode must not require changing hardware input abstractions.
- Navigation should treat modes as pluggable pages/functions.
- Behavior selection should be project-configurable and serializable.

## Testing Requirements for Decoupling

- Contract tests verifying behavior engines run against mocked platform context.
- Regression tests ensuring identical `MusicalEvent` output from same seed/settings.
- Platform tests proving navigation/transport functions with no behavior engine loaded.
