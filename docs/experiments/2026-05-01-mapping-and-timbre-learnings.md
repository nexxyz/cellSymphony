# 2026-05-01 - Mapping and Timbre Learnings

## Change
- Implemented channel-based birth/death timbre split (birth=sine, death=pulse).
- Added same-tick same-note dedupe.
- Tuned mapping range policy and step sizes.
- Set row step to 3 and column step to 1 in pentatonic degree space.

## Expected Effect
- Better event-kind distinction.
- More melodic motion across columns.
- Less congestion from note collisions.

## Observed Result
- Birth/death timbral distinction improved readability.
- Column step 1 significantly improved melodic feel.
- Row/column both at 3 felt too repetitive and less melodic.

## Keep/Reject
- Keep channel waveform split.
- Keep dedupe.
- Keep row=3, col=1 defaults.
- Keep degree-space range handling.

## Next
- Expose mapping preset switching in UI.
- Add optional alternate gating and dedupe policies.
