# Menu Node Spec (Implemented)

This is the implemented menu-driven control surface, navigated by encoder + A/S.

## Root

- Population
  - Mode (`grid` | `conway`)
- Interpretation
  - Scan Mode (`immediate` | `scanning`)
  - Scan Axis (`rows` | `columns`) [shown when scanning]
  - Ticks/Unit (`1/16` | `1/8` | `1/4` | `1/2` | `1/1`) [shown when scanning]
  - Scan Dir (`forward` | `reverse`) [shown when scanning]
  - Conway Step (`1/16` | `1/8` | `1/4` | `1/2` | `1/1`) [shown when population mode = conway]
  - Event On (bool)
  - Event Parity (`none` | `birth_even_death_odd`)
  - State On (bool)
  - X Axis
    - Mode (`scale_steps` | `filter_cutoff` | `filter_resonance` | `velocity`)
    - On (bool)
    - Dir (`forward` | `reverse`)
    - Scale Steps (0..16)
    - Min (0..100)
    - Max (0..100)
    - Grid Offset (-64..64)
    - Curve (`linear` | `curve`)
  - Y Axis
    - Mode (`scale_steps` | `filter_cutoff` | `filter_resonance` | `velocity`)
    - On (bool)
    - Dir (`forward` | `reverse`)
    - Scale Steps (0..16)
    - Min (0..100)
    - Max (0..100)
    - Grid Offset (-64..64)
    - Curve (`linear` | `curve`)

## Control Semantics

- Encoder turn: move cursor (select mode) or adjust value (edit mode)
- Encoder press: enter group / toggle bool / enter-or-exit edit
- A: back one level or exit edit
- S: global transport play/stop

Timing semantics use MIDI clock style resolution (PPQN=24).
