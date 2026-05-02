# Menu Node Spec (Implemented)

This is the implemented menu-driven control surface, navigated by encoder + A/S.

## Root

- Population
  - Mode (`grid` | `conway`)
- Interpretation
  - Scan Mode (`immediate` | `scanning`)
  - Scan Axis (`rows` | `columns`) [shown when scanning]
  - Ticks/Unit (`2` | `4` | `8` | `16`) [shown when scanning]
  - Scan Dir (`forward` | `reverse`) [shown when scanning]
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
