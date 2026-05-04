//! Hardware Abstraction Layer for Cell Symphony
//! Used by headless Pi Zero 2W binary (and optionally desktop for testing)

// Only compile HAL modules when targeting Pi
#[cfg(feature = "pi-zero")]
pub mod pinmap;
#[cfg(feature = "pi-zero")]
pub mod encoder_gpio;
#[cfg(feature = "pi-zero")]
pub mod i2c_bus;
#[cfg(feature = "pi-zero")]
pub mod neotrellis;
#[cfg(feature = "pi-zero")]
pub mod neokey;
#[cfg(feature = "pi-zero")]
pub mod oled_ssd1351;
#[cfg(feature = "pi-zero")]
pub mod i2s_dac;

// Re-exports for convenience
#[cfg(feature = "pi-zero")]
pub use encoder_gpio::EncoderGpio;
#[cfg(feature = "pi-zero")]
pub use i2c_bus::I2CBus;
#[cfg(feature = "pi-zero")]
pub use neotrellis::NeoTrellis;
#[cfg(feature = "pi-zero")]
pub use neokey::NeoKey;
#[cfg(feature = "pi-zero")]
pub use oled_ssd1351::OledSsd1351;
#[cfg(feature = "pi-zero")]
pub use i2s_dac::I2sDac;
