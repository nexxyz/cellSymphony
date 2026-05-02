# Cell Symphony - Product Purpose, Architecture, and Delivery Plan

## 1) Purpose

Cell Symphony is a cellular-algorithm-driven musical instrument that starts as a desktop simulator and is intentionally engineered for a straightforward migration to embedded physical hardware.

Core product intent:

- Turn cellular automata behavior (starting with Conway's Game of Life) into playable and expressive music.
- Operate as a standalone instrument with internal sound generation.
- Integrate cleanly with external hardware/software through MIDI.
- Preserve a hardware-first control model from day one, even in desktop simulation.

Non-goals for initial versions:

- No plugin hosting (VST/AU/LV2/etc.).
- No sample looping, slicing, chopping, or time-stretching.
- No dependency on desktop-only control patterns that cannot map to physical controls.

## 2) Product Scope and Constraints

### 2.1 Runtime audio/sampling scope

- Internal engines only.
- Synth engine(s): built-in, no plugin architecture.
- ROMpler-style sampler: loadable one-shot samples only.
- Runtime sample format support: WAV only.

### 2.2 Sample import policy

- Import-only source support includes FLAC, specifically to ingest Renoise sample library content.
- Imported assets are converted to canonical WAV and copied into the project folder.
- Runtime playback always uses project-local WAV files.

### 2.3 Canonical imported sample format

- WAV
- 48 kHz
- 16-bit PCM
- Mono by default unless source is stereo-critical
- Normalization default: off

### 2.4 Starter content policy

- A default starter drum/percussion set of 16 imported samples.
- Suggested category distribution:
  - 3 kicks
  - 3 snares
  - 2 claps
  - 2 cymbal/hat
  - 2 toms
  - 4 percussion/shaker

## 3) Hardware-First Interaction Model

Desktop simulator input must mirror intended hardware controls.

Controls:

- Encoder rotation: keyboard Left/Right arrows
- Encoder press: keyboard Enter
- Button A: keyboard A
- Button S: keyboard S
- 8x8 NeoTrellis-like matrix: clickable grid cells (mouse/touch) in simulator

Global behavior defaults:

- A = Back/Cancel
- S = Play/Stop transport toggle

Hardware target assumptions:

- Pi-compatible platform (or similar class compute)
- Small display
- 1 rotary encoder with push
- 2 auxiliary buttons
- 8x8 pressable illuminated matrix

## 4) High-Level Architecture

### 4.1 Monorepo direction

- TypeScript-first product logic with Rust realtime/audio backend via Tauri.

Proposed layout:

- `apps/desktop` - Tauri + React simulator application
- `packages/core` - Cellular automata and deterministic state transitions
- `packages/mapping` - Automata events -> musical events
- `packages/device-contracts` - Shared control/event/display contracts
- `crates/realtime-engine` - Rust realtime scheduler, MIDI, synth, ROMpler

### 4.2 Architectural boundaries

- UI never mutates core state directly.
- UI emits device-like input events only.
- Core/realtime return render models (display, LED matrix, transport/audio state).
- Rust backend is authoritative for musical timing and scheduling.

### 4.3 Why this split

- Maximizes portability to hardware.
- Keeps deterministic logic testable and reusable.
- Isolates platform-specific timing/audio concerns.

### 4.4 Decoupling requirement (critical)

The system must strictly separate reusable device operation fundamentals from musical behavior modules.

Reusable fundamentals include:

- Navigation/menu model
- Transport state and clock orchestration
- MIDI/audio routing and engine hosting
- Project/sample persistence
- Display/LED rendering contracts

Behavior modules include:

- Generative modes (starting with Game of Life)
- Future non-generative modes (drum machine, sequencer, launchpad-style)

Design rule: behavior modules can be replaced or added without rewriting platform/navigation/transport/audio foundations.

## 5) Detailed Simulator UI Plan (v1)

### 5.1 Required visual components

- Small device-screen panel (menu/status text model)
- Encoder UI element
- Button UI elements (Encoder press, A, S)
- 8x8 clickable LED matrix

### 5.2 Input mapping requirements

- `ArrowLeft` -> `EncoderTurn(-1)`
- `ArrowRight` -> `EncoderTurn(+1)`
- `Enter` -> `EncoderPress`
- `A` -> `ButtonA`
- `S` -> `ButtonS`
- Matrix click -> `GridPress(x, y)`

### 5.3 Initial page model

- Transport
- Rule
- Mapping
- Sound
- Samples
- Project

### 5.4 UX behavior rules

- Encode all control actions through shared device contracts.
- Maintain hardware parity: no required desktop-only shortcuts.
- Simulator-only diagnostics can exist, but core operation must not depend on them.

## 6) Musical Engine Plan

### 6.1 Cellular automata phase

- Initial automata: Conway's Game of Life on 8x8 grid.
- Deterministic stepping with seedable behavior where randomness is used.
- Transport supports stopped/running and BPM control.

### 6.2 Mapping phase

- Map CA lifecycle events (birth/death/survival changes) to note/trigger outputs.
- Quantize pitch to selected scales.
- Use density or topology-derived modulation for velocity/probability.

### 6.3 Internal sound phase

- Synth v1: simple subtractive voice architecture.
- ROMpler v1: one-shot zone playback with polyphony and voice stealing.

Default polyphony target:

- 8 synth voices
- 8 ROMpler voices

## 7) Sample Import and ROMpler Design

### 7.1 Import workflow

1. User chooses source audio files (including FLAC).
2. Backend decodes source data.
3. Backend converts to canonical WAV.
4. Converted files are copied into `project/samples/`.
5. Asset metadata is written to project data.

### 7.2 ROMpler data model (v1)

- `SampleAsset`: id, relative path, channels, sample rate, frame count, root note, default gain
- `Zone`: sample id, key range, velocity range, tuning, gain, pan
- `Patch`: list of zones + envelope/filter + polyphony

### 7.3 Runtime behavior constraints

- One trigger creates one voice instance.
- Voices run until one-shot ends or are stolen by allocator.
- No loop points, slices, warping, or stretch.

## 8) Project Persistence Requirements

Each project must be portable across machines when project folder is copied.

Minimum project structure:

- `project.json`
- `samples/*.wav` (imported assets)

Project metadata should include:

- Versioning
- CA/rule settings
- Mapping settings
- Transport defaults
- Sample assets and patch/zone definitions
- Relative asset references only for runtime playback

## 9) Milestone Plan

### M0 - Specification and contracts

- Freeze event contracts, state models, and project schema.

### M1 - Simulator shell

- Deliver input mapping and all dummy UI elements.

### M2 - Core automata/transport

- Game of Life tick/step/run with deterministic behavior.

### M3 - Mapping + MIDI

- Musical event generation and MIDI output path.

### M4 - Internal synth

- Subtractive engine integrated with scheduler.

### M5 - Import + ROMpler

- FLAC import conversion + WAV runtime playback.

### M6 - Persistence

- Save/load full project state and assets.

### M7 - Stabilization

- Timing/perf diagnostics and reliability hardening.

## 10) Acceptance Criteria (v1)

- Keyboard and UI controls exactly mirror planned hardware controls.
- 8x8 grid is clickable and can drive automata/music.
- MIDI out functions for generated events.
- Internal synth and ROMpler both operate standalone.
- FLAC import succeeds and runtime reads only project-local WAV.
- Project folder is portable with preserved behavior.
