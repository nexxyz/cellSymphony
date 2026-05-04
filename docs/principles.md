# Cell Symphony Principles

## Purpose

These principles preserve the core intent of Cell Symphony as the project grows.

## Product Principles

- Hardware-first interaction parity: simulator controls must map to physical-device controls.
- Native audio truth: desktop UI is a control surface; realtime audio behavior belongs to native engine paths.
- Internal engines first: keep core self-contained; plugin hosting is out of scope.
- Project portability: runtime assets are local to project folders; avoid brittle absolute-path dependencies.

## Architectural Principles

- Matrix Population Logic is independent from Matrix Interpretation Logic.
- Matrix Interpretation Logic is independent from Cell Trigger Mapping.
- Cell Trigger Mapping is independent from Cell Trigger Execution implementation.
- Transport/timing orchestrates subsystem execution, but does not couple subsystem internals.
- Matrix Interpretation Logic should be profile-composable across Tick, X, and Y dimensions.

## Musical Principles

- Birth/death are distinct event kinds and can carry distinct sonic identity.
- Mapping defaults should be musical immediately, then user-editable later.
- Preserve melodic contour when constraining note range (prefer degree-space wrapping over flattening clamps).
- Avoid redundant same-note retriggers in the same tick for the same channel.

## Quality Principles

- Keep decisions explicit and recorded in ADRs.
- Validate behavior with both technical tests and listening tests.
- Optimize for modular extension (future modes like sequencer/drum/launchpad) without rewriting foundations.
