# Menu and Controls Spec (Authoritative)

This is the single source of truth for menu structure, control mappings, and parameter behavior.

## Control Mapping

- Main encoder turn (`SW1`): cursor move / value adjust
- Main encoder press (`SW1`): enter group, toggle bool, enter/exit edit
- Back button: back one level / exit edit (`Backspace` in simulator)
- Space button: play/pause transport (`Space` in simulator)
- Shift + Space: emergency stop (panic + reset scan origin)

## Transport States

- Play: `▶`
- Pause: `⏸`
- Stop (emergency): `■`

## Menu Tree

- Transport
  - Play/Pause (functional)
  - BPM (functional)
- Audio
  - Master Vol 0..100% (functional)
- Engine
  - Population Mode (`Sequencer` | `Conway`) (functional)
  - Conway Step (functional in Conway mode)
- Interpretation
  - Scan Mode (functional)
  - Scan Axis (functional in scanning mode)
  - X Scan Unit (functional in scanning mode)
  - Y Scan Unit (functional in scanning mode)
  - Scan Direction (functional in scanning mode)
  - Event Triggers (functional)
  - Event Filter (`All` | `Odd/Even`) (functional)
  - State Triggers (functional)
  - X Axis (functional)
  - Y Axis (functional)
- Mapping
  - Starting Note (functional)
  - Lowest Note (functional)
  - Highest Note (functional)
  - Out of Range (`Clamp` | `Wrap`) (functional)
  - Base Note (functional)
  - Range Mode (functional)
  - Birth Target (functional)
  - Death Target (functional)
  - State Target (functional)
  - X Axis (functional)
  - Y Axis (functional)
- System
  - Display Brightness (functional)
  - Grid Brightness (functional)
  - Button Brightness (functional)

## Brightness Behavior

- Display Brightness scales OLED display intensity in simulator.
- Grid Brightness scales matrix LED RGB intensity.
- Button Brightness scales NeoKey button LED intensity.

## Modulation Behavior (Current)

- Pitch modulation is additive across axes (`X Steps + Y Steps`).
- Axis pitch steps are signed (`-16..16`).
- `Velocity` lane modulates outgoing `note_on` velocity.
- `Filter Cutoff` lane emits CC74 (mapped to lowpass cutoff).
- `Filter Resonance` lane emits CC71 (mapped to lowpass resonance).
- Lowpass is currently the active filter type.
- `Grid Offset` rotates axis indexing (offset=5 => cell 5 treated as first, then wraps).
- `Grid Offset` bounds are axis-size derived: `-(axis-1)..+(axis-1)` (8x8 => `-7..7`).

## Edit Marker

- Selected editable value line uses compact marker: `*Value`.

## Maintenance Rule

Any control/menu/runtime behavior change must update this document in the same commit.
