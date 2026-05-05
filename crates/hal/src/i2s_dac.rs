//! I2S PCM5102 DAC driver for Raspberry Pi Zero 2W
//! Uses rodio with ALSA backend (same as desktop)

#[cfg(not(feature = "pi-zero"))]
use std::fmt;

/// I2S DAC wrapper (uses rodio with ALSA backend)
/// Note: The actual rodio/audio implementation lives in the Pi binary,
/// this is just the HAL interface trait.
#[cfg(feature = "pi-zero")]
pub struct I2sDac {
    // Placeholder - actual implementation in pi-zero app
}

#[cfg(feature = "pi-zero")]
impl I2sDac {
    /// Initialize I2S DAC
    pub fn new() -> Result<Self, String> {
        // I2S on Pi Zero 2W requires no initialization -
        // PCM5102 is a dumb DAC that auto-detects I2S clock
        Ok(Self {})
    }

    /// Trigger a note (for testing/playback)
    pub fn trigger_note(
        &self,
        _channel: u8,
        _note: u8,
        _velocity: u8,
        _duration_ms: u32,
    ) -> Result<(), String> {
        // Note: actual audio rendering is done by realtime-engine crate
        // This is just a placeholder for the HAL interface
        Ok(())
    }
}

/// Stub for non-Pi builds
#[cfg(not(feature = "pi-zero"))]
pub struct I2sDac {
    _private: (),
}

#[cfg(not(feature = "pi-zero"))]
impl I2sDac {
    pub fn new() -> Result<Self, String> {
        Ok(Self { _private: () })
    }

    pub fn trigger_note(
        &self,
        _channel: u8,
        _note: u8,
        _velocity: u8,
        _duration_ms: u32,
    ) -> Result<(), String> {
        Ok(())
    }
}

#[cfg(not(feature = "pi-zero"))]
impl fmt::Debug for I2sDac {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "I2sDac {{ ... }}")
    }
}
