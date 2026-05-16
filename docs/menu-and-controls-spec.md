# Menu and Controls Spec (Authoritative)

This is the single source of truth for menu structure, control mappings, and parameter behavior.

Context-help copy source: `docs/menu-help-texts.tsv` (required header row).

## Control Mapping

| Control | Simulator Key | Function |
|---|---|---|
| Main encoder turn | ← → | Move cursor / adjust values |
| Main encoder press | Enter | Enter group / enter/exit edit / trigger action |
| Back button | Backspace | Go back / exit edit / clear grid (with Shift) |
| Space button | Space | Play / Pause |
| Shift + Space | Shift+Space | Emergency stop (panic + reset scan origin) |
| Shift + Back | Shift+Backspace | Clear grid (re-initialize behavior) |
| Aux encoder 1-4 turn | (simulated) | Adjust bound turn mapping |
| Aux encoder 1-4 press | (simulated) | Trigger bound press mapping |
| Shift + Aux encoder press | Shift + (simulated) | Bind current item / open unbind confirm |
| Shift + Fn + Main press | Shift+Ctrl+Enter | Context help for highlighted entry |

## Transport States

- Play: `▶` (green flash on beat, red flash on measure)
- Pause: `⏸`
- Stop (emergency): `■`

## Menu Tree (Full)

### Root Menu

```
Root (group)
├── L1: Life (group)
├── L2: Sense (group)
├── L3: Voice (group)
├── [spacer] (visual separator)
├── Playback (group)
└── System (group)
```

### L1: Life

```
L1: Life
├── Step Rate: [1/16, 1/8, 1/4, 1/2, 1/1]    ← controls how often onTick() is called
├── Behaviour: [sequencer | life | brain | ant | bounce | shapes | raindrops | dla | glider]
└── ... per-behavior dynamic config from active engine's configMenu()
```

Behavior-specific config items (from `configMenu()`):

| Behavior | Config Items | Type/Options |
|---|---|---|
| sequencer | *(none)* | — |
| life | Random Cells/Tick: [0..10] | number, step 1 |
| life | Random Interval: [1, 2, 4, 8, 16] | enum |
| life | !Spawn Random [S] | action, shared route `trigger.life.spawn_now` |
| brain | Fire Threshold: [1..6] | number, step 1 |
| brain | !Seed Random [S] | action, shared route `trigger.life.spawn_now` |
| ant | Max Ants: [1..10] | number, step 1 |
| ant | !Spawn Ant [S] | action, shared route `trigger.life.spawn_now` |
| bounce | Max Balls: [1..20] | number, step 1 |
| bounce | !Add Ball [S] | action, shared route `trigger.life.spawn_now` |
| shapes | Shape: [ring, heart, star, plus, x] | enum |
| shapes | Expansion Speed: [1..5] | number, step 1 |
| shapes | Auto Spawn Int: [0=off, 10, 20, 50] | enum |
| shapes | !Spawn Pulse [S] | action, shared route `trigger.life.spawn_now` |
| raindrops | !Drop Now [S] | action, shared route `trigger.life.spawn_now` |
| dla | !Seed Cluster [S] | action, shared route `trigger.life.spawn_now` |
| glider | Glider Spawn Int: [0=off, 1, 2, 4, 8, 16] | enum |
| glider | !Spawn Glider [S] | action, shared route `trigger.life.spawn_now` |

### L2: Sense

```
L2: Sense
├── Scan Mode: [immediate | scanning]
├── Scan Axis: [rows | columns]           ← visible when scanning
├── Scan Unit: [1/16, 1/8, 1/4, 1/2, 1/1] ← visible when scanning
├── Scan Direction: [forward | reverse]    ← visible when scanning
├── Event Triggers: [on | off]
├── Event Pattern: [none | activate_even_deactivate_odd]
├── State Notes: [on | off]
├── X Axis (group)
│   ├── Pitch Steps (group)
│   │   ├── Enabled: [on | off]
│   │   └── Steps: [-16..16] step 1       ← visible when enabled
│   ├── Velocity (group)
│   │   ├── Enabled: [on | off]
│   │   ├── From: [0..127] step 1         ← visible when enabled
│   │   ├── To: [0..127] step 1
│   │   ├── Grid Offset: [-7..7] step 1
│   │   └── Curve: [linear | curve]
│   ├── Filter Cutoff (group)
│   │   ├── Enabled: [on | off]
│   │   ├── From: [0..127] step 1
│   │   ├── To: [0..127] step 1
│   │   ├── Grid Offset: [-7..7] step 1
│   │   └── Curve: [linear | curve]
│   └── Filter Resonance (group)
│       ├── Enabled: [on | off]
│       ├── From: [0..127] step 1
│       ├── To: [0..127] step 1
│       ├── Grid Offset: [-7..7] step 1
│       └── Curve: [linear | curve]
└── Y Axis (group)
    └── (same sub-structure as X Axis, keys use y.* prefix, defaults: Pitch Steps steps=8)
```

### L3: Voice

```
L3: Voice
├── Note Mapping (group)
│   ├── Starting Note: [0..127] step 1   default 48 (C3)
│   ├── Lowest Note: [0..127] step 1     default 36 (C2)
│   ├── Highest Note: [0..127] step 1    default 84 (C6)
│   ├── Out of Range: [clamp | wrap]     default clamp
│   ├── Scale: [chromatic | major | natural_minor | dorian | mixolydian | major_pentatonic | minor_pentatonic | harmonic_minor]  default major_pentatonic
│   └── Root: [C | C# | D | D# | E | F | F# | G | G# | A | A# | B]  default C
├── Activate Target: [0 | 1 | 2 | 3]     ← algorithm: cell became active
├── Stable Target: [0 | 1 | 2 | 3]       ← algorithm: cell stays active
├── Deactivate Target: [0 | 1 | 2 | 3]   ← algorithm: cell became inactive
├── Scanned Target: [0 | 1 | 2 | 3]      ← scanning layer: cell found active (only in scanning mode)
├── X Axis (group)
│   └── (same sub-structure as L2 X Axis)
└── Y Axis (group)
    └── (same sub-structure as L2 Y Axis, defaults: Pitch Steps steps=3)
```

### Playback

```
Playback
└── BPM: [40..240] step 1  default 120
```

### System

```
System
├── Audio (group)
│   └── Master Vol: [0..100] step 1  default 73
├── Presets (group)
│   ├── Library (group)
│   │   ├── Save As (group)
│   │   │   ├── Name: (text, max 32 chars)  ← on exit/press: saves preset
│   │   │   └── Save: (action)
│   │   ├── Save Current: (action)    ← saves currently loaded preset (with confirm)
│   │   ├── Load (group)             ← dynamic: one action per preset
│   │   ├── Rename (group)           ← dynamic: one text+action per preset
│   │   ├── Delete (group)           ← dynamic: one action per preset
│   │   └── Refresh List: (action)
│   ├── Default (group)
│   │   ├── Save Default: (action)
│   │   ├── Load Default: (action)
│   │   └── Auto Save: [on | off]    ← auto-persists config on every change
│   └── Factory (group)
│       └── Load Fact. Default: (action)
├── MIDI (group)
│   ├── Enabled: [on | off]
│   ├── !Panic: (action)
│   ├── MIDI Out (group)             ← dynamic: one action per detected MIDI output port
│   ├── MIDI In (group)              ← dynamic: one action per detected MIDI input port
│   ├── Sync & Clock (group)
│   │   ├── Sync Mode: [internal | external]
│   │   ├── Clock Out: [on | off]
│   │   ├── Clock In: [on | off]
│   │   └── Respond Start/Stop: [on | off]
├── Sound (group)
│   ├── Note Length: [30..2000] step 10 ms  default 120
│   ├── Velocity Scale: [0..200] step 5 %   default 100
│   └── Velocity Curve: [linear | soft | hard]
└── UI Settings (group)
    ├── Screen Sleep: [0..600] step 10 s    default 60 (0=off)
    ├── Display Brightness: [10..100] step 5  default 75
    ├── Grid Brightness: [10..100] step 5     default 75
    └── Button Brightness: [10..100] step 5   default 75
```

## OLED Display

- 128×128 pixel, simulated in desktop app
- 20 characters × 8 lines of text (5×7 font, 16px line height)
- Top line: title bar (colored by section)
- Body lines 2-8: menu items with `@@` prefix on selected line, `*` prefix when editing
- Bottom-right corner: transport icon (`▶` / `⏸` / `■`)
- Transport flash: green (beat) or red (measure) border on play icon
- Yellow event dot: briefly shown when notes fire
- Toast text: displayed at bottom for feedback messages

Value editing semantics:

- Number/enum/bool rows enter edit mode on main press
- Bool behaves like a 2-option enum (`off`/`on`) and changes on encoder turn, not immediate row press

Action row markers:

- `!` prefix means the row is an action item
- `[S]` suffix means the action is shared/routable across behaviors

## Grid LED Behavior (NeoKey per-key RGB)

Each cell in the 8×8 grid is mapped to an LED with color based on its `CellTriggerType`:

| Condition | Color |
|---|---|
| Cell off | Off (0, 0, 0) |
| `activate` | Bright white |
| `stable` | Green |
| `deactivate` | Dim white |
| `scanned` | Red (only if scan mode is "scanning") |

Brightness is scaled by the Grid Brightness setting.

## Auto-Save

- Location: System > Presets > Default > Auto Save
- When enabled: every config change (via turnMenu, pressMenu, or turnAuxEncoder) emits a `store_save_default` effect, persisting the entire `ConfigPayload` (activeBehavior + runtimeConfig + mappingConfig)
- Disabled by default
- Toggling Auto Save itself does NOT trigger an auto-save

## Aux Encoder Binding

- Each aux encoder has two independent slots:
  - turn slot: bound to value parameters (number/enum/bool)
  - press slot: bound to actions
- Shift + aux press on a bindable item binds/overwrites the slot:
  - while editing a value item: binds turn slot
  - while selecting an action item: binds press slot
- Shift + aux press when unbinding would occur opens confirmation with: `Both`, `Click`, `Turn`, `Cancel`
- Regular aux press triggers the press slot action (if any)
- Regular aux turn adjusts the turn slot value (if any)
- If no slot is bound, toast shows `S#: No binding` or `T#: No binding`
- Turn toasts show current value, e.g. `T1: Spawn Count: 3`
- For unsupported shared mappings, toast shows `N/A`, e.g. `S1: N/A (Spawn Now)`
- Shared route currently implemented:
  - `trigger.life.spawn_now` resolves per behavior (sequencer has no implementation)
- Enum turning is clamped (no wrap)
- Bool turning is clamped with directional behavior (`-1 => Off`, `+1 => On`)
- `activeBehavior` and `behaviorConfig.*` updates re-initialize behavior state
- All aux value changes trigger auto-save when enabled

## Config Persistence (ConfigPayload)

Structured as:
```typescript
type ConfigPayload = {
  activeBehavior: string;
  runtimeConfig: RuntimeConfig;   // all menu-settable parameters
  mappingConfig: MappingConfig;   // activate/stable/deactivate/scanned targets + MIDI note params
};
```

On restore (`applyConfigPayload`), the payload is deep-merged with factory defaults via `sanitizePayload`, then:
- `activeBehavior` and `runtimeConfig` are applied
- `mappingConfig` is applied
- If behavior engine changed, behavior state is re-initialized via `behavior.init({})`
- All timing accumulators are reset to 0

## Brightness Behavior

- Display Brightness scales OLED display intensity in simulator.
- Grid Brightness scales matrix LED RGB intensity.
- Button Brightness scales NeoKey button LED intensity.

## Modulation Behavior

- Pitch modulation is additive across axes (`X Steps + Y Steps`).
- Axis pitch steps are signed (`-16..16`).
- Pitch note generation uses scale-degree stepping (not post-quantize).
- `Velocity` lane modulates outgoing `note_on` velocity.
- `Filter Cutoff` lane emits CC74 (mapped to lowpass cutoff).
- `Filter Resonance` lane emits CC71 (mapped to lowpass resonance).
- Lowpass is currently the active filter type.
- `Grid Offset` rotates axis indexing (offset=5 => cell 5 treated as first, then wraps).
- `Grid Offset` bounds are derived: `-(GRID_SIZE-1) .. +(GRID_SIZE-1)` → `-7..7`.

## Edit Marker

- Selected editable value line uses compact marker: `*Value`.
- In text edit mode: `*` prefix and cursor shown within the text.

## Behavior Engine Interface

```typescript
interface BehaviorEngine<TState, TConfig> {
  id: string;
  init: (config?: TConfig) => TState;
  onInput: (state: TState, input: DeviceInput) => TState;
  onTick: (state: TState, ctx: { bpm: number; emit: () => void }) => TState;
  renderModel: (state: TState) => BehaviorRenderModel;
  serialize: (state: TState) => unknown;
  deserialize: (data: unknown) => TState;
  triggerTypes?: (prev: TState, next: TState) => CellTriggerType[];
  configMenu?: () => BehaviorConfigItem[];
}
```

All behaviors use `CellTriggerType`: `"activate" | "stable" | "deactivate" | "scanned" | "none"`.

## 4 Trigger Types

| Type | Source | When |
|---|---|---|
| `activate` | Algorithm | Cell becomes active (birth, shape hits cell, etc.) |
| `stable` | Algorithm | Cell stays active (alive, inside shape interior, etc.) |
| `deactivate` | Algorithm | Cell becomes inactive (death, shape leaves cell, etc.) |
| `scanned` | Scanning layer | Cell found active during scan (only in "scanning" mode) |

Scan mode "immediate" generates NO `scanned` triggers. Only "scanning" mode (column/row) generates `scanned` triggers.

## Maintenance Rule

Any control/menu/runtime behavior change must update this document in the same commit.
