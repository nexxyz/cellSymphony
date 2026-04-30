# ADR-0002: Split Birth/Death Sonic Identity by Channel/Waveform

## Status
Accepted

## Context
Birth and death transitions are semantically different and should be audibly distinguishable during performance.

## Decision
Use channel-based timbre routing in native audio path:

- Birth (default channel 0) -> sine
- Death (default channel 1) -> pulse

## Alternatives Considered
- Single waveform for all transitions.
- Distinguish only by velocity/duration.

## Consequences
- Better perceptual separation of event kinds.
- Slightly more complexity in native event routing.

## Follow-ups
- Expose waveform assignment in future configuration UI.
- Keep defaults musical and conservative.
