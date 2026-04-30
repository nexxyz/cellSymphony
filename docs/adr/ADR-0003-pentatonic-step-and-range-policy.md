# ADR-0003: Pentatonic Step and Range Policy

## Status
Accepted

## Context
Early mapping produced musically constrained or flattening behavior when range-limiting collapsed many events to near-identical high notes.

## Decision
- Default mapping uses pentatonic scale with:
  - row step = 3 pentatonic degrees
  - column step = 1 pentatonic degree
- Range limiting defaults to wrapping in degree-space, not semitone-space clamping.

## Alternatives Considered
- Row/column both at 3-degree steps.
- Hard clamp in MIDI semitone space.

## Consequences
- More melodic column movement.
- Better contour preservation under bounded ranges.

## Follow-ups
- Keep these values file-configurable.
- Add preset variants for denser/sparser melodic behavior.
