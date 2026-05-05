//! Rotary encoder input via GPIO (quadrature + push switch)
//! Uses rppal for interrupt-driven decoding on Pi Zero 2W

#[cfg(feature = "pi-zero")]
use rppal::gpio::{Gpio, InputPin, Level, Trigger};
#[cfg(feature = "pi-zero")]
use std::sync::mpsc::Sender;

#[cfg(not(feature = "pi-zero"))]
use std::fmt;

/// Hardware event from encoders
#[derive(Debug, Clone, Copy)]
pub enum HardwareEvent {
    EncoderTurn { id: &'static str, delta: i8 },
    EncoderPress { id: &'static str },
}

/// Rotary encoder with GPIO interrupt handling
#[cfg(feature = "pi-zero")]
pub struct EncoderGpio {
    id: &'static str,
    a: InputPin,
    b: InputPin,
    sw: InputPin,
    last_ab: (Level, Level),
    tx: Sender<HardwareEvent>,
}

#[cfg(feature = "pi-zero")]
impl EncoderGpio {
    /// Create new encoder on given pins (A, B, Switch)
    pub fn new(
        id: &'static str,
        pins: &crate::pinmap::EncoderPins,
        tx: Sender<HardwareEvent>,
    ) -> Result<Self, String> {
        let gpio = Gpio::new().map_err(|e| e.to_string())?;

        let mut a = gpio
            .get(pins.a)
            .map_err(|e| e.to_string())?
            .into_input_pullup();
        let mut b = gpio
            .get(pins.b)
            .map_err(|e| e.to_string())?
            .into_input_pullup();
        let mut sw = gpio
            .get(pins.sw)
            .map_err(|e| e.to_string())?
            .into_input_pullup();

        let last_ab = (a.read(), b.read());

        // Quadrature decoding on A/B edges
        let tx_a = tx.clone();
        let id_a = id;
        a.set_async_interrupt(Trigger::Both, move |_level_a| {
            let _ = tx_a.send(HardwareEvent::EncoderTurn { id: id_a, delta: 1 });
        })
        .map_err(|e| e.to_string())?;

        let tx_b = tx.clone();
        let id_b = id;
        b.set_async_interrupt(Trigger::Both, move |_level_b| {
            let _ = tx_b.send(HardwareEvent::EncoderTurn {
                id: id_b,
                delta: -1,
            });
        })
        .map_err(|e| e.to_string())?;

        // Switch press (active low)
        let tx_sw = tx.clone();
        let id_sw = id;
        sw.set_async_interrupt(Trigger::FallingEdge, move |_| {
            let _ = tx_sw.send(HardwareEvent::EncoderPress { id: id_sw });
        })
        .map_err(|e| e.to_string())?;

        Ok(Self {
            id,
            a,
            b,
            sw,
            last_ab,
            tx,
        })
    }
}

/// Stub for non-Pi builds
#[cfg(not(feature = "pi-zero"))]
pub struct EncoderGpio {
    _private: (),
}

#[cfg(not(feature = "pi-zero"))]
impl EncoderGpio {
    pub fn new(
        _id: &'static str,
        _pins: &crate::pinmap::EncoderPins,
        _tx: Sender<HardwareEvent>,
    ) -> Result<Self, String> {
        Ok(Self { _private: () })
    }
}

#[cfg(not(feature = "pi-zero"))]
impl fmt::Debug for EncoderGpio {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "EncoderGpio {{ ... }}")
    }
}
