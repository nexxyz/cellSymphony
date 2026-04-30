# ADR-0005: Birth/Death Tick-Parity Gating (Temporary Musical Policy)

## Status
Accepted

## Context
Separating birth and death across alternating ticks can improve legibility while auditioning mappings.

## Decision
- Even ticks: birth-only events
- Odd ticks: death-only events

## Alternatives Considered
- Emit both birth and death every tick.
- Randomized or probability-based gating.

## Consequences
- Clearer phase separation during listening and tuning.
- Reduced instantaneous density.

## Follow-ups
- Make gating strategy selectable in future config/UI.
