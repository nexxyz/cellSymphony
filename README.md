# Cell Symphony

A device (with a 1:1 simulator app) that turns cellular automata into a playable, performable synthesizer. Inspired by the Tenori-On, it combines 10 generative algorithms with real-time music generation.

> **Work in Progress.** This is an active hobby project. Things change, break, and improve rapidly.

---

## What It Is

Cell Symphony combines a pluggable generative algorithm engine with a musical interpretation layer:

- An **8×8 grid** evolves according to one of 10 algorithms (Conway, Brian's Brain, Langton's Ant, Bounce, Shapes, Raindrops, DLA, Glider, or manual Sequencer)
- A **musical interpretation layer** turns cell events (activate/stable/deactivate/scanned) into MIDI notes and internal synth sounds
- A **hardware-style control surface**: 5 rotary encoders, 4 NeoKey buttons, and the grid itself
- A **desktop app** (Tauri + React) that acts as a simulator and development harness
- All algorithms are pluggable `BehaviorEngine` packages with a shared API

---

## Status & Roadmap

### Done / Functional
- [x] **10 generative algorithms** (pluggable via `BehaviorEngine` interface)
- [x] **4 trigger types** (`activate` / `stable` / `deactivate` / `scanned`)
- [x] Musical interpretation & mapping
- [x] Internal synth (rodio + realtime-engine)
- [x] Desktop simulator (Tauri + React)
- [x] MIDI output (Tauri/midir)
- [x] MIDI input & external sync
- [x] Preset storage (save/load/rename/delete)
- [x] OLED 128×128 display (simulated)
- [x] Grid LED feedback (NeoKey-style, color-coded by trigger type)
- [x] Transport (Play / Pause / Stop)
- [x] Menu system (encoder-driven, 4-level deep)
- [x] Scale-based note mapping (9 scales, 12 roots)
- [x] Modulation lanes (velocity, filter cutoff/resonance, pitch steps)
- [x] Auxiliary encoder binding (bind any menu param to aux1-4)
- [x] Auto-save (persist config on every change)
- [x] Shift+Backspace grid clear
- [x] 84 passing tests across all packages
- [x] Coverage reporting (c8)

### In Progress
- [ ] Hardware prototype (Raspberry Pi + custom PCB) — design in `hardware/KiCAD/`

### Next on the Roadmap
- [ ] Multi-layer architecture (8 independent layers)
- [ ] Effects suite (reverb, delay, chorus, more filter types)
- [ ] Sample management, mapping and triggering
- [ ] More playful UI animations
- [ ] More versatile synth engines

---

## Controls (Hardware Parity)

| Control | Simulator Key | Function |
|---|---|---|
| Main encoder turn | ← → | Move cursor / adjust values |
| Main encoder press | Enter | Enter group / toggle / enter/exit edit |
| Back button | Backspace | Go back / exit edit |
| Space button | Space | Play / Pause |
| Shift + Space | Shift+Space | Emergency stop (panic + reset) |
| Shift + Backspace | Shift+Backspace | Clear grid |
| Aux encoder 1-4 turn | (simulated) | Adjust bound parameter |
| Aux encoder 1-4 press | (simulated) | Bind/unbind current menu item |
| Shift + aux press | Shift+(simulated) | Show current binding |

---

## Algorithms

| Algorithm | Package | Description |
|---|---|---|
| Sequencer | `behaviors-sequencer` | Manual grid toggle — cells on/off via grid press |
| Conway+ | `behaviors-life` | Game of Life (B3/S23) with optional random seeding |
| Brian's Brain | `behaviors-brain` | 3-state CA: alive→dying→dead |
| Langton's Ant | `behaviors-ant` | Ant moves, flips cells, wraps edges |
| Bounce | `behaviors-bounce` | Balls bounce at 45° off grid edges |
| Shapes | `behaviors-pulse` | Expanding wavefront: ring/heart/star/plus/x |
| Raindrops | `behaviors-raindrops` | Drops fall, splash into expanding rings |
| DLA | `behaviors-dla` | Diffusion-limited aggregation |
| Glider | `behaviors-glider` | Spawns Conway gliders at intervals |

---

## Menu Overview

Navigate with the encoder, press to enter/edit, Back to exit.

- **L1: Behaviors** — Active algorithm, step rate, per-behavior config
- **L2: Sense** — Scan mode/axis/unit/direction, event triggers, X/Y axis modulation (pitch/velocity/filter cutoff/resonance)
- **L3: Voice** — Note mapping (scale/root/range), activate/stable/deactivate/scanned MIDI targets, X/Y axis modulation
- **Playback** — BPM
- **System** — Audio (master volume), presets (save/load/rename/delete/default/auto-save), MIDI config, sound (note length/velocity), UI settings (brightness/screen sleep)

See `docs/menu-and-controls-spec.md` for the full authoritative spec.

---

## Installation (Developer Preview)

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- [Rust](https://www.rust-lang.org/tools/install) (stable)
- [Tauri](https://tauri.app/v2/guides/getting-started/prerequisites/) prerequisites

### Build & Run

```bash
# Install dependencies
pnpm install

# Start the desktop app (simulator mode)
pnpm --filter @cellsymphony/desktop tauri:dev

# Or alternatively run the .bat file after installing the dependencies
cellSymphony.bat
```

---

## Testing

```bash
# Run all TypeScript tests (84 tests across all packages)
pnpm -r test

# Run tests with coverage
pnpm -r test:coverage

# Run individual behavior tests
pnpm --filter @cellsymphony/behaviors-life test
pnpm --filter @cellsymphony/behaviors-ant test

# Run Rust tests
cargo test --workspace
```

---

## Project Structure

```
cellSymphony/
├── apps/desktop/              # Tauri desktop app (simulator + future hardware harness)
├── packages/
│   ├── platform-core/         # Core state, transport, menu system, behavior orchestration
│   ├── behavior-api/          # BehaviorEngine interface + registry
│   ├── interpretation-core/   # Grid → musical intent
│   ├── mapping-core/          # Intent → MIDI events
│   ├── musical-events/        # Event type definitions
│   ├── device-contracts/      # Shared TypeScript contracts
│   ├── midi-headless-runner/  # Headless MIDI integration tests
│   ├── behaviors-sequencer/   # Manual grid sequencer
│   ├── behaviors-life/        # Conway's Game of Life
│   ├── behaviors-brain/       # Brian's Brain
│   ├── behaviors-ant/         # Langton's Ant
│   ├── behaviors-bounce/      # Bouncing balls
│   ├── behaviors-pulse/       # Expanding shapes wavefront
│   ├── behaviors-raindrops/   # Raindrop simulation
│   ├── behaviors-dla/         # Diffusion-limited aggregation
│   └── behaviors-glider/      # Glider spawner
├── crates/
│   └── realtime-engine/       # Rust synth engine (rodio)
├── tools/
│   └── midi-io-sidecar/       # Rust MIDI I/O helper for testing
└── docs/
    ├── menu-and-controls-spec.md           # Authoritative control spec
    ├── implementation-plan-10-algorithms.md # Original plan (superseded)
    ├── implementation-done.md              # Final architecture summary
    ├── runtime-boundaries.md               # Architecture overview
    ├── principles.md                       # Product & architecture principles
    └── engineering-quality-requirements.md # CI, test, and coverage requirements
```

---

## Hardware Plan

The long-term goal is a standalone hardware device:

- **Compute**: Raspberry Pi Zero 2 W
- **Display**: 128×128 OLED (RGB565) via Adafruit 128x128 OLED Breakout Board
- **Controls**: 5 clickable rotary encoders (4 freely mappable), 4 dedicated buttons via Adafruit NeoKeys
- **Grid**: 8×8 LED matrix with pushbuttons via Adafruit NeoTrellis
- **DAC**: High-quality audio out via Adafruit PCM5102 I2S DAC
- **Power**: USB-C via Adafruit USB Type C Breakout Board
- **Sound generation**: Native synth & sample engine (no computer needed)
- **I/O**: MIDI in/out (via RPi MicroUSB)

---

## License

Copyright (c) 2026 nexxyz (Thomas Steirer).

**Free for personal/non-commercial use**: you may use, copy, modify, and build this software for personal purposes.

**Commercial use or selling hardware devices** requires prior written permission.

To request permission, contact: https://github.com/nexxyz

See the [LICENSE](LICENSE) file for full terms.
