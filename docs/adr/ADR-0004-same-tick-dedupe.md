# ADR-0004: Same-Tick Same-Note Dedupe

## Status
Accepted

## Context
Multiple cells can map to the same channel+note on the same tick, creating redundant retriggers that degrade clarity.

## Decision
For each tick, dedupe `note_on` events by `channel:note`. Keep one event with strongest effective parameters (max velocity, max duration).

## Alternatives Considered
- No dedupe.
- Drop all duplicates after first without parameter merge.

## Consequences
- Cleaner output and less synthetic congestion.
- Slight loss of raw density from collisions.

## Follow-ups
- Add optional policy modes later (`drop`, `merge-max`, `merge-average`).
