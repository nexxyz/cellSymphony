# ADR-0001: Decouple Grid Evolution from Musical Interpretation

## Status
Accepted

## Context
The project needs to support multiple musical paradigms over time (generative, sequencer, drum-machine, launchpad-style) without rewriting core grid logic.

## Decision
Treat grid evolution (Conway and future algorithms) as a pure state system. Musical interpretation consumes grid snapshots/transitions as input and emits trigger intents/events.

## Alternatives Considered
- Couple Conway state transitions directly to note generation.
- Split only at MIDI stage while keeping interpretation inside behavior modules.

## Consequences
- Better long-term extensibility for alternative modes.
- Clearer testing boundaries.
- Slight increase in interface/contract surface.

## Follow-ups
- Keep behavior modules free of output-specific audio/midi code paths.
- Maintain interpretation contracts as first-class APIs.
