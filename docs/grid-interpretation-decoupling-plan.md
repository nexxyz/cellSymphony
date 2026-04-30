# Grid/Interpretation Decoupling Plan

## Purpose

This document captures the agreed architecture direction: Conway/grid generation must remain independent from musical interpretation/event generation.

## Core Principle

- Grid evolution logic (e.g., Conway step rules) is a pure state system.
- Musical/event interpretation consumes grid snapshots/state transitions as input.
- Timing/transport triggers when these systems run, but does not couple their internals.

## Required Separation

### 1) Grid Engine Layer (Pure)

Owns:

- Grid data model
- Conway rules and step function
- Grid editing operations (toggle/set/clear)

Must not own:

- MIDI/audio events
- Instrument/channel/sample semantics
- Interpretation-specific assumptions

### 2) Interpretation Layer (Pluggable)

Owns:

- Converting grid state snapshots into trigger intents
- Mode-specific read semantics (birth/death, column-scan, etc.)

Must not own:

- Grid rule implementation details
- Audio engine internals

### 3) Mapping/Output Layer

Owns:

- Trigger intent -> musical event conversion
- Scale/pitch/channel routing configuration
- MIDI/internal-engine event payload generation

## Tick Data Flow

1. Transport produces tick.
2. Grid engine steps state (or remains static if mode dictates).
3. Interpreter reads previous/current grid snapshots and outputs trigger intents.
4. Mapper converts intents to musical events.
5. Audio/MIDI systems consume musical events.

## v1 Interpretation Scope

- Start with `birth` and `death` events only.
- `alive` and `dead` state interpretations deferred.
- Default mapping config is file-based and editable later via UI.

## Default Mapping Rules (Agreed)

- Internal MIDI channel numbering: 0-15.
- Birth routes to target A (default channel 0).
- Death routes to target B (default channel 1).
- Pentatonic mapping baseline:
  - Low notes at bottom rows.
  - Row offset: +3 pentatonic degrees per row upward.
  - Column offset: +3 pentatonic degrees per step right.

## Future-Proofing Targets

This decoupling is required so the same platform can later host alternative behavior modes without rewriting transport/navigation/audio foundations, including:

- Column-scanning sequencer interpretation
- Drum machine style interpretation
- Launchpad/performance-grid interpretation

## Immediate Implementation Plan

1. Extract Conway logic into a pure grid module.
2. Remove direct musical event emission from Conway behavior.
3. Introduce interpreter interface (`prevGrid`, `nextGrid`, `tickCtx` -> trigger intents).
4. Implement birth/death interpreter.
5. Implement mapping module with file-based defaults.
6. Integrate into platform tick pipeline.
7. Add tests by layer (grid, interpretation, mapping).
