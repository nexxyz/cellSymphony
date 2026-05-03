# Simulator Hardware-Parity Plan

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

- Space toggles Play/Stop.
- Shift+Space is emergency brake:
  - stop transport immediately
  - reset scan origin based on axis+direction
  - kill active notes/samples
  - keep transport icon in Stop until Play resumes
- Startup transport state is Stop.

## OLED Status

- Persistent bottom-right transport icon:
  - Stop = `■`
  - Play = `▶`
- Transport icon pulses while playing:
  - measure start = blue/green pulse
  - other quarter beats = green pulse
- A dot to the right blips on actual note/sample trigger events.

## NeoKey LED Behavior

- Space key LED pulses:
  - beat 1 = strong green pulse
  - beats 2/3/4 = lighter green pulse
- Pulses are transport-clock driven and active only while playing.

## Encoder UI

- Simulator encoders are shown as dial + center push.
- Main encoder controls menu.
- Aux encoders are visible and reserved.
