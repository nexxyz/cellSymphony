# ADR-0006: Modular Interpretation Core (Tick/X/Y)

## Status
Accepted

## Context
Matrix interpretation must support both current generative behavior and future sequencer/drum-machine style behaviors without rewriting mapping or execution layers.

## Decision
Model interpretation as a profile composed of three assignable dimensions:

- Tick strategy: what a tick reads/advances (`whole_grid_transitions`, `scan_column_active`, `scan_row_active`)
- X strategy: how x contributes (`scale_step`, `timing_only`, `ignore`)
- Y strategy: how y contributes (`scale_step`, `timing_only`, `ignore`)

Interpretation emits `CellTriggerIntent` with a computed scale degree and event kind.

## Alternatives Considered
- Hardcoded interpretation modes with custom code paths.
- Keep interpretation tied to transition extraction only.

## Consequences
- Easier extension for new play modes.
- Cleaner separation from mapping/execution.
- Requires stable interpretation profile contracts.

## Follow-ups
- Add profile serialization and runtime selection.
- Add richer axis strategies (sample-lane map, modulation targets).
