//! NeoKey 1x4 button + LED driver
//! Uses seesaw over I2C

#[cfg(feature = "pi-zero")]
use crate::i2c_bus::I2CBus;
#[cfg(feature = "pi-zero")]
use crate::pinmap::NEOKEY_ADDR;
#[cfg(feature = "pi-zero")]
use embedded_hal::blocking::i2c::{SevenBitAddress, I2C};

/// NeoKey 1x4 device
#[cfg(feature = "pi-zero")]
pub struct NeoKey {
    i2c: I2CBus,
    addr: SevenBitAddress,
}

#[cfg(feature = "pi-zero")]
impl NeoKey {
    /// Initialize NeoKey at default address 0x30
    pub fn new(mut i2c: I2CBus) -> Result<Self, String> {
        let addr = NEOKEY_ADDR as SevenBitAddress;

        // Init seesaw
        let init_cmd = [0xFE, 0x41]; // Seesaw HW_ID
        i2c.write(addr, &init_cmd)
            .map_err(|e| format!("NeoKey init failed: {}", e))?;

        Ok(Self { i2c, addr })
    }

    /// Returns Vec<(key_index, pressed)> for keys 0-3
    pub fn scan(&mut self) -> Result<Vec<(u8, bool)>, String> {
        let mut buf = [0u8; 4];
        let read_cmd = [0x10]; // Keypad GET
        self.i2c
            .write_read(self.addr, &read_cmd, &mut buf)
            .map_err(|e| format!("NeoKey scan failed: {}", e))?;

        let mut result = Vec::new();
        for i in 0..4 {
            let pressed = (buf[0] & (1 << i)) != 0;
            result.push((i, pressed));
        }

        Ok(result)
    }

    /// Set LED color for key (0-3)
    pub fn set_led(&mut self, key: u8, r: u8, g: u8, b: u8) -> Result<(), String> {
        let cmd = [0x0E, key, r, g, b]; // Seesaw LED set
        self.i2c
            .write(self.addr, &cmd)
            .map_err(|e| format!("NeoKey LED write failed: {}", e))
    }
}

/// Stub for non-Pi builds
#[cfg(not(feature = "pi-zero"))]
pub struct NeoKey {
    _private: (),
}

#[cfg(not(feature = "pi-zero"))]
impl NeoKey {
    pub fn new(_i2c: ()) -> Result<Self, String> {
        Ok(Self { _private: () })
    }

    pub fn scan(&mut self) -> Result<Vec<(u8, bool)>, String> {
        Ok(Vec::new())
    }

    pub fn set_led(&mut self, _key: u8, _r: u8, _g: u8, _b: u8) -> Result<(), String> {
        Ok(())
    }
}
