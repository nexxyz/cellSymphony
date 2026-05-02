# Cell Symphony Hardware Integration Plan

This plan captures the current hardware integration direction for the Pi Zero 2W build and aligns it with software architecture.

## Locked Hardware Summary

- Compute: Raspberry Pi Zero 2W
- Matrix/buttons: NeoTrellis (4x4 x4 chain) + NeoKey 1x4 over I2C bus 1
- Display: SSD1351 OLED breakout over SPI
- Audio DAC: ADA6250 connector for PCM5102-class DAC module over I2S
- Encoders: 5 direct-GPIO clickable rotary encoders

## Architecture Alignment

The runtime keeps this flow:

1. Matrix Population Logic
2. Matrix Interpretation Logic
3. Cell Trigger Mapping
4. Cell Trigger Execution

Hardware abstraction (HAL) feeds control inputs and consumes display/LED outputs without coupling to musical logic internals.

## HAL Module Plan

- `hal/pinmap`
  - single source of truth for GPIO/SPI/I2C assignments
- `hal/encoder_gpio`
  - 5 encoders (quadrature + push), pull-ups, debounce
- `hal/i2c_bus`
  - shared I2C bus scheduler/owner
- `hal/neotrellis`
  - 16x16 key scan + LED frame batching over seesaw
- `hal/neokey`
  - 1x4 key scan over seesaw
- `hal/oled_ssd1351`
  - SPI menu/status rendering
- `hal/i2s_dac`
  - ALSA/I2S output path targeting PCM5102-class DAC

## Timing Model

- MIDI-clock style PPQN = 24
- Scan progression uses note units (`1/16`, `1/8`, `1/4`, `1/2`, `1/1`)
- Conway evolution uses independent note-unit setting
- Scan cursor remains visible in scanning modes while running and stopped

## Bus and Pin Resource Notes

- SPI in use: OLED write path (MOSI/SCLK/CE0, plus DC/RST GPIO)
- I2C in use: NeoTrellis + NeoKey seesaw devices on bus 1
- I2S in use: ADA6250/PCM5102 (`GPIO18` BCK, `GPIO19` LRCK, `GPIO21` DIN)
- GPIO9 reused for SW5 channel B is valid because OLED is write-only and SPI MISO is unused

## Input Role Mapping

- `encoder_main` (SW1): menu navigation and value editing
- `encoder_aux_1..4` (SW2..SW5): reserved for future assignments
- NeoKey:
  - key1 = A
  - key2 = S
  - key3 = Shift (reserved)
  - key4 = Fn (reserved)

## Bring-Up Checklist

1. Power rails verified under load (+5V stable)
2. I2C detection:
   - all NeoTrellis devices present
   - NeoKey present
3. OLED initializes and renders status frame
4. I2S DAC initializes and outputs test tone
5. Encoders read correctly:
    - turn direction
    - push switch debounce
6. Matrix input/output test:
    - all key coordinates map correctly
    - LED frame updates stable
7. Transport timing test:
    - scan progression follows selected note unit
    - Conway step follows independent note unit

## Mechanical/Enclosure Note

- KiCAD source remains in `hardware/KiCAD`.
- Next phase includes enclosure design with:
  - encoder spacing/clearance
  - matrix + display line-of-sight
  - service access for USB-C and debug ports
