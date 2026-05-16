# Implementation Summary: 10 Algorithms + 4 Trigger Types

All 10 behavior packages, the pluggable behavior engine architecture, the menu system overhaul, auto-save, aux encoder binding, and shift+back clear-grid are implemented and tested.

## Behavior Packages

| Package | ID | Description | Tests |
|---|---|---|---|
| `behaviors-sequencer` | `sequencer` | Manual grid toggle sequencer | 5 |
| `behaviors-life` | `life` | Conway's Game of Life (B3/S23) with random seeding | 7 |
| `behaviors-brain` | `brain` | Brian's Brain (3-state: alive/dying/dead) | 5 |
| `behaviors-ant` | `ant` | Langton's Ant — one ant moves, flips cells, wraps edges | 6 |
| `behaviors-bounce` | `bounce` | Bouncing balls at 45° off grid edges | 6 |
| `behaviors-pulse` | `shapes` | Expanding shapes wavefront: ring/heart/star/plus/x | 6 |
| `behaviors-raindrops` | `raindrops` | Raindrops fall, splash into expanding rings | 6 |
| `behaviors-dla` | `dla` | Diffusion-limited aggregation | 4 |
| `behaviors-glider` | `glider` | Spawns Conway gliders at intervals | 6 |

## Architecture

- **Behavior Engine interface** in `packages/behavior-api/src/index.ts`: `BehaviorEngine<TState, TConfig>` with `init`, `onInput`, `onTick`, `renderModel`, `serialize`, `deserialize`, `triggerTypes`, `configMenu`
- **Registry** in `packages/behavior-api/src/registry.ts`: `registerBehavior`, `getBehavior`, `listBehaviorIds`
- **Platform-core** orchestrates: `menuTree`, `routeInput`, `tick`, `extractConfigPayload`, `applyConfigPayload`, `autoSaveEffect`, `bindAuxEncoder`, `turnAuxEncoder`, `reinitBehaviorState`

## Menu Structure (Implemented)

```
Root
├── L1: Life
│   ├── Step Rate: [1/16, 1/8, 1/4, 1/2, 1/1]
│   └── Behaviour: [sequencer | life | brain | ant | bounce | shapes | raindrops | dla | glider]
│       └── ... per-behavior config items
├── L2: Sense
│   ├── Scan Mode: [immediate | scanning]
│   ├── Scan Axis: [rows | columns] (if scanning)
│   ├── Scan Unit: [1/16, 1/8, 1/4, 1/2, 1/1] (if scanning)
│   ├── Scan Direction: [forward | reverse] (if scanning)
│   ├── Event Triggers: [on | off]
│   ├── Event Pattern: [All | Odd/Even]
│   ├── State Notes: [on | off]
│   ├── X Axis (Pitch Steps / Velocity / Filter Cutoff / Filter Resonance)
│   └── Y Axis (Pitch Steps / Velocity / Filter Cutoff / Filter Resonance)
├── L3: Voice
│   ├── Note Mapping
│   │   ├── Starting Note / Lowest Note / Highest Note
│   │   ├── Out of Range: [clamp | wrap]
│   │   ├── Scale: [...9 options...]
│   │   └── Root: [...12 notes...]
│   ├── Activate Target: [0, 1, 2, 3]
│   ├── Stable Target: [0, 1, 2, 3]
│   ├── Deactivate Target: [0, 1, 2, 3]
│   ├── Scanned Target: [0, 1, 2, 3]
│   ├── X Axis (Pitch Steps / Velocity / Filter Cutoff / Filter Resonance)
│   └── Y Axis (Pitch Steps / Velocity / Filter Cutoff / Filter Resonance)
├── [spacer]
├── Playback
│   └── BPM: 40-240
└── System
    ├── Audio → Master Vol: 0-100
    ├── Presets
    │   ├── Library (Save As / Load / Rename / Delete / Refresh)
    │   ├── Default (Save Default / Load Default / Auto Save)
    │   └── Factory (Revert Factory)
    ├── MIDI (Enabled / Sync Mode / MIDI Out / MIDI In / Clock Out/In / Respond Start-Stop / Panic)
    ├── Sound (Note Length / Velocity Scale / Velocity Curve)
    └── UI Settings (Screen Sleep / Display / Grid / Button Brightness)
```

## Key Features

- **Auto-save**: Toggle in System > Presets > Default > Auto Save. When on, every config change automatically emits `store_save_default` effect.
- **Aux encoder binding**: Each aux encoder has independent turn/press slots. Shift+aux press binds current item (turn while editing value, press while selecting action). Unbind now requires confirmation (`Both`/`Click`/`Turn`/`Cancel`).
- **Shared spawn route**: Spawn actions are marked `!...[S]` and bind to `trigger.life.spawn_now`, resolving per active behavior. Unsupported contexts show `S#: N/A (Spawn Now)`.
- **Shift+Backspace (button_a + shiftHeld)**: Clears the grid by re-initializing the current behavior.
- **4 trigger types**: `activate`, `stable`, `deactivate` (algorithm-generated), `scanned` (scanning-layer, only in "scanning" mode).
- **`algorithmStepUnit`**: General step rate that controls how often `onTick()` is called for the active behavior.

## Test Coverage

- **84 total tests passing**
- Platform-core: 45 tests (24 new feature tests + 21 existing)
- Interpretation-core: 3 tests
- Mapping-core: 2 tests
- Musical-events: 2 tests
- Device-contracts: 2 tests
- 9 behavior packages: 30 tests total (4-7 per package)

## Deviations from Original Plan

| Item | Planned | Actual |
|---|---|---|
| Shapes package name | `behaviors-shapes/` | `behaviors-pulse/` (internal ID: `shapes`) |
| Shape rendering | Solid filled shapes | Wavefront model (leading edge + lifespan decay) |
| Glider behavior | Glider gun | Interval-based glider spawner |
| Menu label | "Active" | "Behaviour" |
| Scanned target default | Equally distributed 0-3 | Channel 0 (same as activate) |
