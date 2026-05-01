# Hardware BOM and I/O Plan (v1 + Future-Proofing)

## Purpose

This document captures the current hardware direction for the first physical Cell Symphony build, including future-proofing decisions agreed during desktop-first development.

## Core Hardware Direction

- Compute target: Raspberry Pi compatible platform (Pi 5 preferred, Pi 4 acceptable).
- Audio: native engine path on device (no WebAudio dependency).
- Controls:
  - 1 primary rotary encoder with push (navigation)
  - 2 dedicated buttons
  - 16x16 interactive grid with LED feedback
  - small display

## Future-Proofing Update (Locked)

Add **4 auxiliary encoders** now, for a total of **5 encoders** in hardware BOM.

- Primary encoder: active in v1 firmware.
- Auxiliary encoders (x4): physically installed and electrically integrated, but functionally unassigned in v1.

Rationale:

- Prevent front-panel redesign later.
- Reserve expressive controls for future modes (sequencer/drum/launchpad/layer controls).
- Keep PCB/mechanical iteration risk lower by allocating controls early.

## BOM-Level Encoder Requirements

- 5x incremental rotary encoders total.
- 5x knob caps (or matched knob set).
- If using encoder push switches on aux units, wire and validate now even if unused.
- Keep encoder family consistent for sourcing and replacement simplicity.

## I/O Budget and Electrical Planning

Reserve I/O capacity for:

- Quadrature signals for 5 encoders.
- Optional 5 encoder switch lines.
- 2 dedicated buttons.
- 16x16 grid input path.
- 16x16 LED output path.
- Display bus (SPI/I2C as selected).

Recommendation:

- Use GPIO expanders or a dedicated auxiliary input path for encoder scan so realtime audio and grid scan timing remain stable.

## Software Contract Guidance

Keep event schema encoder-id aware from now on:

- `EncoderTurn { id, delta }`
- `EncoderPress { id }`

v1 behavior:

- Use `encoder_main` only.
- Accept/log/ignore `encoder_aux_1..4` until mapped in future features.

## Mechanical/Industrial Notes

- Reserve panel spacing and hand clearance for all 5 encoder knobs.
- Prefer symmetric or purpose-grouped placement to support future mode pages.
- Validate accessibility while interacting with grid and display simultaneously.

## Verification Requirements

For v1 hardware bring-up, verify:

- All 5 encoders produce stable quadrature reads.
- Encoder push switches (if populated) debounce correctly.
- No scan-induced timing instability in audio thread.
- Unassigned aux encoders do not alter behavior state.

## Scope Note

This update changes hardware readiness only. It does not require assigning functions to the 4 auxiliary encoders in the current software milestone.
