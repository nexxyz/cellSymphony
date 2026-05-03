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
  - Scan Unit (functional in scanning mode)
  - Scan Direction (functional in scanning mode)
  - Event Triggers (functional)
  - Event Filter (`All` | `Odd/Even`) (functional)
  - State Triggers (functional)
  - X Axis (functional)
  - Y Axis (functional)
- Mapping
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

- `velocity` mode modulates outgoing `note_on` velocity.
- `filter_cutoff` mode emits CC74 (mapped to lowpass cutoff).
- `filter_resonance` mode emits CC71 (mapped to lowpass resonance).
- Lowpass is currently the active filter type.

## Maintenance Rule

Any control/menu/runtime behavior change must update this document in the same commit.
