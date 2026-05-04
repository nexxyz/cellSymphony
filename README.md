# Cell Symphony

A desktop-first cellular music instrument that turns Conway's Game of Life into a playable, performable synthesizer. Inspired by the Tenori-On, it combines cellular automata with real-time music generation.

> **Work in Progress.** This is an active hobby project. Things change, break, and improve rapidly. The MVP is not yet complete.

---

## What It Is

Cell Symphony combines a generative cellular automaton (Game of Life) with a musical interpretation engine:

- An **8×8 grid** evolves over time (Conway's Game of Life or manual sequencing)
- A **musical interpretation layer** turns cell births, deaths, and live cells into MIDI notes and internal synth sounds
- A **hardware-style control surface**: rotary encoder, two buttons, and the grid itself
- A **desktop app** (Tauri + React) that acts as a simulator and development harness

---

## Status & Roadmap

### Done / Functional
- [x] Core cellular engine (Conway)
- [x] Musical interpretation & mapping
- [x] Internal synth (rodio + realtime-engine)
- [x] Desktop simulator (Tauri + React)
- [x] MIDI output (Tauri/midir)
- [x] MIDI input & external sync
- [x] Preset storage
- [x] OLED 128×128 display (simulated)
- [x] Grid LED feedback (NeoKey-style)
- [x] Transport (Play / Pause / Stop)
- [x] Menu system (encoder-driven)
- [x] Scale-based note mapping
- [x] Modulation lanes (velocity, filter)

### In Progress
- [ ] Hardware prototype (Raspberry Pi + custom PCB) — design in `hardware/KiCAD/`

### Next on the Roadmap
- [ ] Additional generative algorithms (stars, bounces, rotations)
- [ ] More versatile synths
- [ ] Mapping of the four extra push-encoders
- [ ] More playful UI
- [ ] Effects suite (reverb, delay, chorus, more filter types)
- [ ] Sample management, mapping and triggering

---

## Controls (Hardware Parity)

The desktop simulator mirrors the planned hardware controls 1:1:

| Control | Simulator Key | Function |
|---|---|---|
| Main encoder turn | ← → | Move cursor / adjust values |
| Main encoder press | Enter | Enter group / toggle / edit |
| Back button | Backspace | Go back / exit edit |
| Space button | Space | Play / Pause |
| Shift + Space | Shift+Space | Emergency stop (panic + reset) |

### Transport States

- **Play** (`▶`): Engine running, music playing
- **Pause** (`⏸`): Engine paused, position kept
- **Stop** (`■`): Engine stopped, position reset, red indicator

> The **Space button LED** pulses with the music:
> - Red flash = start of a musical measure
> - Green flash = each quarter note beat

---

## Menu Overview

Navigate with the encoder, press to enter/edit, Back to exit.

- **Transport** — Play/Pause, BPM
- **Audio** (under System) — Master volume
- **Engine** — Population mode (Sequencer / Conway), Conway step unit
- **Interpretation** — Scan mode/axis/unit/direction, event triggers, state notes, X/Y axis modulation
- **Mapping** — Note mapping (starting/lowest/highest note, scale, root), birth/death/state MIDI targets, X/Y axis modulation
- **System** — Display brightness, grid brightness, button brightness, **Audio** (master volume), presets (save/load/rename/delete)

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
```

This opens the Cell Symphony simulator: an OLED display, grid visualization, and encoder/button controls.

---

## Testing

```bash
# Run all TypeScript tests
pnpm -r test

# Run tests with coverage
pnpm -r test:coverage

# Run Rust tests
cargo test --workspace
```

---

## Project Structure

```
cellSymphony/
├── apps/desktop/          # Tauri desktop app (simulator + future hardware harness)
├── packages/
│   ├── platform-core/    # Core state, transport, menu system
│   ├── interpretation-core/ # Grid → musical intent
│   ├── mapping-core/     # Intent → MIDI events
│   ├── musical-events/   # Event type definitions
│   ├── device-contracts/ # Shared TypeScript contracts
│   ├── behaviors-life/   # Conway's Game of Life behavior
│   └── midi-headless-runner/ # Headless MIDI integration tests
├── crates/
│   └── realtime-engine/ # Rust synth engine (rodio)
├── tools/
│   └── midi-io-sidecar/ # Rust MIDI I/O helper for testing
└── docs/
    ├── menu-and-controls-spec.md  # Authoritative control spec
    ├── runtime-boundaries.md    # Architecture overview
    ├── principles.md            # Product & architecture principles
    └── engineering-quality-requirements.md
```

---

## Hardware Plan

The long-term goal is a standalone hardware device:

- **Compute**: Raspberry Zero 2 W
- **Display**: 128×128 OLED (RGB565) via Adafruit 128x128 OLED Breakout Board
- **Controls**: 5 clickable rotary encoders (4 of them will be freely mappable), 4 dedicated buttons viy Adafruit Neokeys
- **Grid**: 8×8 LED matrix with pushbuttons via Adafruit Neotrellis
- **DAC**: High-quality audio out via Adafruit PCM5102 I2S DAC
- **Power**: USB-C via Adafruit USB Type C Breakout Board
- **Sound generation**: Native synth& sample  engine (no computer needed)
- **I/O**: MIDI in/out (via RPi MicroUSB)

---

## License:

Copyright (c) 2026 nexxyz (Thomas Steirer).

**Free for personal/non-commercial use**: you may use, copy, modify, and build this software for personal purposes.

**Commercial use or selling hardware devices** requires prior written permission.

To request permission, contact: https://github.com/nexxyz

See the [LICENSE](LICENSE) file for full terms.
