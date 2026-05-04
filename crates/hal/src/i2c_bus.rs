//! Shared I2C bus manager for NeoTrellis + NeoKey (seesaw devices)

use std::fmt;

#[cfg(feature = "pi-zero")]
use embedded_hal::blocking::i2c::{self, SevenBitAddress};
#[cfg(feature = "pi-zero")]
use linux_embedded_hal::I2Cdev;

/// I2C bus wrapper for Pi Zero 2W
#[cfg(feature = "pi-zero")]
pub struct I2CBus {
    dev: I2Cdev,
}

#[cfg(feature = "pi-zero")]
impl I2CBus {
    /// Open I2C bus (e.g., bus=1 opens /dev/i2c-1)
    pub fn new(bus: u8) -> Result<Self, String> {
        let path = format!("/dev/i2c-{}", bus);
        let dev = I2Cdev::new(path).map_err(|e| format!("I2C open failed: {}", e))?;
        Ok(Self { dev })
    }

    /// Write + read in single I2C transaction
    pub fn write_read(
        &mut self,
        addr: SevenBitAddress,
        write: &[u8],
        read: &mut [u8],
    ) -> Result<(), String> {
        self.dev
            .write_read(addr, write, read)
            .map_err(|e| format!("I2C write_read failed: {}", e))
    }

    /// Simple write to I2C device
    pub fn write(&mut self, addr: SevenBitAddress, data: &[u8]) -> Result<(), String> {
        self.dev
            .write(addr, data)
            .map_err(|e| format!("I2C write failed: {}", e))
    }

    /// Read from I2C device
    pub fn read(&mut self, addr: SevenBitAddress, data: &mut [u8]) -> Result<(), String> {
        self.dev
            .read(addr, data)
            .map_err(|e| format!("I2C read failed: {}", e))
    }
}

/// Stub for non-Pi builds
#[cfg(not(feature = "pi-zero"))]
pub struct I2CBus {
    _private: (),
}

#[cfg(not(feature = "pi-zero"))]
impl I2CBus {
    pub fn new(_bus: u8) -> Result<Self, String> {
        Ok(Self { _private: () })
    }
    pub fn write_read(&mut self, _addr: u8, _write: &[u8], _read: &mut [u8]) -> Result<(), String> {
        Ok(())
    }
    pub fn write(&mut self, _addr: u8, _data: &[u8]) -> Result<(), String> {
        Ok(())
    }
    pub fn read(&mut self, _addr: u8, _data: &mut [u8]) -> Result<(), String> {
        Ok(())
    }
}

impl fmt::Debug for I2CBus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "I2CBus {{ ... }}")
    }
}
