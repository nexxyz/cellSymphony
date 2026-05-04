//! NeoTrellis 8x8 LED matrix driver (4x4 devices x4 chain)
//! Uses seesaw over I2C

#[cfg(feature = "pi-zero")]
use crate::i2c_bus::I2CBus;
#[cfg(feature = "pi-zero")]
use embedded_hal::blocking::i2c::{SevenBitAddress, I2C};

/// NeoTrellis device (4x4, daisy-chained to make 8x8)
#[cfg(feature = "pi-zero")]
pub struct NeoTrellis {
    i2c: I2CBus,
    devices: [(SevenBitAddress, [u8; 16]); 4],
}

#[cfg(feature = "pi-zero")]
impl NeoTrellis {
    /// Initialize 4 NeoTrellis devices at addresses 0x2E, 0x2F, 0x30, 0x31
    pub fn new(i2c: I2CBus) -> Result<Self, String> {
        let devices = [
            (0x2E as SevenBitAddress, [0; 16]),
            (0x2F as SevenBitAddress, [0; 16]),
            (0x30 as SevenBitAddress, [0; 16]),
            (0x31 as SevenBitAddress, [0; 16]),
        ];

        let mut trellis = Self { i2c, devices };

        // Initialize seesaw on each device
        for (addr, _) in &trellis.devices {
            // Seesaw init: set module base, enable keypad
            let init_cmd = [0xFE, 0x41]; // Seesaw HW_ID
            trellis
                .i2c
                .write(*addr, &init_cmd)
                .map_err(|e| format!("Trellis init failed at {:#04x}: {}", addr, e))?;
        }

        Ok(trellis)
    }

    /// Scan all keys, return Vec<(x, y, pressed)>
    pub fn scan_keys(&mut self) -> Result<Vec<(u8, u8, bool)>, String> {
        let mut result = Vec::new();

        for (dev_idx, (addr, _)) in self.devices.iter().enumerate() {
            // Read keypad FIFO (seesaw register 0x10)
            let mut buf = [0u8; 4];
            let read_cmd = [0x10];
            self.i2c
                .write_read(*addr, &read_cmd, &mut buf)
                .map_err(|e| format!("Trellis scan failed: {}", e))?;

            // Parse keypad data
            let key_count = buf[0];
            for i in 0..key_count {
                let key_data = buf[i as usize + 1];
                let pressed = (key_data & 0x80) == 0;
                let key_num = key_data & 0x7F;
                // Map 4x4 key to 8x8 grid position
                let local_x = key_num % 4;
                let local_y = key_num / 4;
                let base_x = (dev_idx % 2) * 4;
                let base_y = (dev_idx / 2) * 4;
                let x = base_x + local_x;
                let y = base_y + local_y;
                result.push((x, y, pressed));
            }
        }

        Ok(result)
    }

    /// Write LED frame (8x8 RGB values)
    pub fn write_led_frame(&mut self, frame: &[[u8; 3]; 64]) -> Result<(), String> {
        for (dev_idx, (addr, _)) in self.devices.iter().enumerate() {
            let base_x = (dev_idx % 2) * 4;
            let base_y = (dev_idx / 2) * 4;

            // Batch write LED states via seesaw
            let mut cmd = vec![0x0E, 0x00]; // Seesaw LED base

            for y in base_y..(base_y + 4) {
                for x in base_x..(base_x + 4) {
                    let idx = (y * 8 + x) as usize;
                    let rgb = &frame[idx];
                    cmd.push(rgb[0]); // R
                    cmd.push(rgb[1]); // G
                    cmd.push(rgb[2]); // B
                }
            }

            self.i2c
                .write(*addr, &cmd)
                .map_err(|e| format!("Trellis LED write failed: {}", e))?;
        }

        Ok(())
    }
}

/// Stub for non-Pi builds
#[cfg(not(feature = "pi-zero"))]
pub struct NeoTrellis {
    _private: (),
}

#[cfg(not(feature = "pi-zero"))]
impl NeoTrellis {
    pub fn new(_i2c: ()) -> Result<Self, String> {
        Ok(Self { _private: () })
    }

    pub fn scan_keys(&mut self) -> Result<Vec<(u8, u8, bool)>, String> {
        Ok(Vec::new())
    }

    pub fn write_led_frame(&mut self, _frame: &[[u8; 3]; 64]) -> Result<(), String> {
        Ok(())
    }
}
