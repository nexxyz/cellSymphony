# Menu-Driven Interpretation Refactor Plan

## Goal

Move all interpretation/population controls to hardware-parity menu navigation using only:

- Encoder turn
- Encoder press
- Button A (back/cancel)
- Button S (global play/stop)
- Matrix interaction for grid population/editing

No extra runtime control keys beyond the hardware model.

## Target Architecture Flow

1. Matrix Population Logic
2. Matrix Interpretation Logic
3. Cell Trigger Mapping
4. Cell Trigger Execution

Interpretation must remain modular and configurable via menu/state, not ad-hoc key toggles.

## Menu Structure (Authoritative)

- Population
  - Mode
    - Grid
    - Conway
- Interpretation
  - Scan Mode
    - Immediate
    - Scanning
      - Rows
      - Columns
  - X Axis Modulation
    - Scale steps (default 1)
    - Filter Cutoff
    - Filter Resonance
    - Velocity
  - Y Axis Modulation
    - Scale steps (default 3)
    - Filter Cutoff
    - Filter Resonance
    - Velocity

For all progressive scanning modes:

- Ticks per unit (default 8th notes)
- Forward / Reverse

For all modulation options:

- On/off
- Forward / Reverse

For all percentage-based modulation options:

- On/off
- min (least-impact default)
- max (default 100%)
- grid offset (default 0)
- linear / curve

## Config Schema Additions

### PopulationConfig

- `mode: "grid" | "conway"`

### InterpretationConfig

- `scanMode: "immediate" | "scanning"`
- `scanAxis: "rows" | "columns"`
- `ticksPerUnit: "1/8" | ...`
- `direction: "forward" | "reverse"`

### AxisModulationConfig (X and Y)

- `mode: "scale_steps" | "filter_cutoff" | "filter_resonance" | "velocity"`
- `enabled: boolean`
- `direction: "forward" | "reverse"`
- `scaleSteps: number`
- `min: number`
- `max: number`
- `gridOffset: number`
- `curve: "linear" | "curve"`

### CellOverrideConfig (placeholder)

Storeable now, editor later.

## Precedence Rule

When cell-level overrides are introduced:

1. Cell override
2. Axis modulation config
3. Global/default mapping config

## Execution Plan

1. Add shared schema/defaults for population + interpretation + axis modulation.
2. Build menu state machine in platform-core.
3. Render menu path and editable values in screen panel.
4. Remove non-hardware shortcuts (profile/event/state toggle keys).
5. Refactor interpretation-core to consume config-driven scan/event/state behavior.
6. Refactor mapping-core to consume axis modulation configs.
7. Persist/load settings in project data.
8. Verify behavior and parity.

## Validation Checklist

- Full menu navigable by encoder + A/S only.
- S always toggles transport globally.
- Immediate mode triggers event interpretation each tick.
- Scanning mode interprets current row/column with ticks-per-unit + direction.
- X default scale steps = 1; Y default scale steps = 3.
- Settings persist and reload correctly.
- No required runtime controls beyond hardware model.
