# Matrix Pipeline Architecture

## Canonical Flow

Cell Symphony uses this abstract pipeline:

1. Matrix Population Logic
2. Matrix Interpretation Logic
3. Cell Trigger Mapping
4. Cell Trigger Execution

## Stage Definitions

### 1) Matrix Population Logic

- Produces matrix state over time.
- Examples:
  - Conway evolution
  - manual/static pattern editing
  - future algorithmic pattern generators

Output:

- `GridSnapshot` (and optionally previous snapshot context)

### 2) Matrix Interpretation Logic

- Reads matrix state in time context and emits abstract trigger intents/transitions.
- Examples:
  - birth/death transition extraction
  - parity gating
  - future row/column scan modes

Output:

- `CellTransition[]` or equivalent trigger-intent list

### 3) Cell Trigger Mapping

- Converts interpretation output into musical/runtime events.
- Examples:
  - scale mapping
  - channel/target routing
  - velocity and duration defaults

Output:

- `MusicalEvent[]`

### 4) Cell Trigger Execution

- Executes mapped events in native runtime targets.
- Examples:
  - internal synth trigger
  - ROMpler/sample trigger
  - MIDI output

## Current Status and Adaptation

Current implementation now follows the canonical flow with one explicit interpretation module path:

- Matrix Population: `packages/behaviors-life`
- Matrix Interpretation: `packages/interpretation-core`
- Cell Trigger Mapping: `packages/mapping-core`
- Cell Trigger Execution: `apps/desktop/src-tauri` + `crates/realtime-engine`

Design rule:

- Interpretation policies (like birth/death parity gating) must live in interpretation modules, not in platform orchestration.

## Near-Term Extension Model

Future modes should be added by introducing new interpretation strategies while preserving population/mapping/execution boundaries:

- `birth_death_parity`
- `column_scan`
- `row_scan`
- `density_gate`

Population source (Conway vs manual) can be swapped independently of interpretation strategy.
