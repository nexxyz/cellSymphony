# Pin Conflict Matrix

Target: Raspberry Pi Zero 2W

This matrix captures all currently assigned pins and their roles to quickly verify there are no conflicts.

## Assigned Pins

| Pin | GPIO | Function | Bus/Domain | Notes |
|---|---:|---|---|---|
| 1 | 3V3 | OLED VIN power | Power | OLED powered from 3.3V |
| 2 | 5V | +5V rail | Power | Main 5V distribution |
| 3 | GPIO2 | I2C SDA | I2C1 | NeoTrellis + NeoKey |
| 5 | GPIO3 | I2C SCL | I2C1 | NeoTrellis + NeoKey |
| 6 | GND | Ground rail | Power | Common ground |
| 7 | GPIO4 | Encoder SW3-B | GPIO input | Encoder quadrature input |
| 8 | GPIO14 | Encoder SW5-A | GPIO input | Disable serial console if enabled |
| 11 | GPIO17 | Encoder SW2-SW | GPIO input | Push switch |
| 12 | GPIO18 | DAC BCK | I2S | PCM5102 bit clock |
| 13 | GPIO27 | Encoder SW3-A | GPIO input | Encoder quadrature input |
| 15 | GPIO22 | Encoder SW4-SW | GPIO input | Push switch |
| 16 | GPIO23 | Encoder SW4-B | GPIO input | Encoder quadrature input |
| 18 | GPIO24 | OLED DC | SPI control | Display data/command |
| 19 | GPIO10 | OLED MOSI | SPI0 | Display write data |
| 21 | GPIO9 | Encoder SW5-B | GPIO input | SPI MISO reused (write-only OLED) |
| 22 | GPIO25 | OLED RST | SPI control | Display reset |
| 23 | GPIO11 | OLED SCLK | SPI0 | Display clock |
| 24 | GPIO8 | OLED CS | SPI0 CE0 | Display chip select |
| 26 | GPIO7 | Encoder SW5-SW | GPIO input | Push switch |
| 29 | GPIO5 | Encoder SW1-A | GPIO input | Main encoder A |
| 31 | GPIO6 | Encoder SW1-B | GPIO input | Main encoder B |
| 32 | GPIO12 | Encoder SW1-SW | GPIO input | Main encoder push |
| 33 | GPIO13 | Encoder SW2-A | GPIO input | Encoder quadrature input |
| 35 | GPIO19 | DAC LRCK | I2S | PCM5102 word clock |
| 36 | GPIO16 | Encoder SW2-B | GPIO input | Encoder quadrature input |
| 37 | GPIO26 | Encoder SW4-A | GPIO input | Encoder quadrature input |
| 38 | GPIO20 | Encoder SW3-SW | GPIO input | Push switch |
| 40 | GPIO21 | DAC DIN | I2S | PCM5102 data input |

## Status

- No hard pin conflicts detected in the current assignment.
- SPI, I2C, I2S, and encoder GPIO allocations are mutually compatible.

## Cautions

- `GPIO14` can be claimed by UART TX if serial console is enabled; disable serial console for encoder reliability.
- `GPIO9` is typically SPI MISO; reuse is valid here because OLED path is write-only.
- Keep all encoder pins configured as inputs with pull-ups and software debounce.
