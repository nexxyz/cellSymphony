# Simulator Hardware-Parity Plan

Note: Active menu/control truth now lives in `docs/menu-and-controls-spec.md`.

This plan captures the agreed UI/runtime behavior so simulator and hardware match in control semantics.

## Core Rules

- UI is input/render only.
- Runtime handles orchestration, scheduling, and event fan-out.
- Core packages own logic, interpretation, and mapping.
- Hardware and simulator should differ only by physical interface.

## Navigation Tree

- Transport
  - Play/Stop
  - BPM
  - Time Sig (4/4 locked)
- Audio
  - Master Vol (0..100%)
- Population
  - Mode (Sequencer | Conway)
  - Conway Step (visible only in Conway mode)
- Interpretation
  - Scan Mode (Immediate | Scanning)
  - Scan Axis (Rows | Cols)
  - Scan Unit (1/16 | 1/8 | 1/4 | 1/2 | 1/1)
  - Scan Dir (Fwd | Rev)
  - Event On
  - Event Parity
  - State On
- Mapping
  - X Axis
  - Y Axis
  - Birth Target
  - Death Target
  - State Target
  - Range Mode
  - Base Note
- System
  - Brightness
  - About

## Transport / Safety

- Space toggles Play/Pause.
- Shift+Space is emergency brake:
  - stop transport immediately
  - reset scan origin based on axis+direction
  - kill active notes/samples
  - keep transport icon in Stop until Play resumes
- Startup transport state is Pause.

- Pause (`||`) keeps position and does not panic.
- Stop (`■`) is panic+reset semantics.

## OLED Status

- Persistent bottom-right transport icon:
  - Pause = `||`
  - Stop = `■`
  - Play = `▶`
- Transport icon pulses while playing:
  - measure start = blue/green pulse
  - other quarter beats = green pulse
- A dot to the right blips on actual note/sample trigger events.

## Shift / Back Controls

- Back action is labeled `Back` (not `A`) and mapped to Backspace in simulator.
- Back button color is red.
- Holding Shift (button or key) lights Shift in yellow.

## NeoKey LED Behavior

- Space key LED pulses with visible fill color:
  - beat 1 = strong green pulse
  - beats 2/3/4 = lighter green pulse
- Pulses are transport-clock driven and active only while playing.

## Encoder UI

- Simulator encoders are shown as dial + center push.
- Main encoder controls menu.
- Aux encoders are visible and reserved.
