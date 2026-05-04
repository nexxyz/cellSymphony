//! Headless Pi Zero 2W binary for Cell Symphony
//! Uses HAL modules to drive hardware directly

#[cfg(feature = "pi-zero")]
mod hal {
    pub use cellsymphony_hal::*;
}

#[cfg(not(feature = "pi-zero"))]
mod hal {
    pub struct Stub;
}

use cellsymphony_hal::{
    encoder_gpio::*, i2c_bus::*, neokey::*, neotrellis::*, oled_ssd1351::*, pinmap::*,
};
use realtime_engine::synth::{NoteTrigger, Waveform};
use std::sync::mpsc::{self, Sender};
use std::thread;
use std::time::{Duration, Instant};

/// Hardware events from interrupts
#[derive(Debug, Clone)]
enum HardwareEvent {
    EncoderTurn { id: &'static str, delta: i8 },
    EncoderPress { id: &'static str },
    GridPress { x: u8, y: u8, pressed: bool },
    NeoKeyPress { key: u8, pressed: bool },
}

fn main() {
    println!("Cell Symphony - Headless Pi Zero 2W");

    // Initialize HAL
    let gpio = rppal::gpio::Gpio::new().expect("GPIO init failed");
    let i2c_bus = I2CBus::new(1).expect("I2C init failed");
    let mut oled = OledSsd1351::new().expect("OLED init failed");
    let mut trellis = NeoTrellis::new(&i2c_bus).expect("Trellis init failed");
    let mut neokey = NeoKey::new(&i2c_bus).expect("NeoKey init failed");

    // Event channel
    let (event_tx, event_rx) = mpsc::channel::<HardwareEvent>(1024);

    // Spawn encoder interrupt handlers (5 encoders)
    for (i, pins) in ENCODERS.iter().enumerate() {
        let tx = event_tx.clone();
        let id = match i {
            0 => "encoder_main",
            1 => "encoder_aux_1",
            2 => "encoder_aux_2",
            3 => "encoder_aux_3",
            _ => "encoder_aux_4",
        };
        EncoderGpio::new(id, pins, tx).expect("Encoder init failed");
    }

    println!("Hardware initialized. Starting main loop...");

    // Main loop (8ms tick = 125Hz)
    let mut last_tick = Instant::now();
    let tick_duration = Duration::from_millis(8);

    loop {
        // Handle hardware events
        while let Ok(event) = event_rx.try_recv() {
            // Convert hardware event to platform-core input
            // Note: This is simplified - actual integration needs platform-core bindings
            match event {
                HardwareEvent::EncoderTurn { id, delta } => {
                    println!("Encoder {} turn: {}", id, delta);
                    // route_input(DeviceInput::EncoderTurn { id, delta }, state);
                }
                HardwareEvent::EncoderPress { id } => {
                    println!("Encoder {} pressed", id);
                    // route_input(DeviceInput::EncoderPress { id }, state);
                }
                HardwareEvent::GridPress { x, y, pressed } => {
                    println!(
                        "Grid ({}, {}) {}",
                        x,
                        y,
                        if pressed { "press" } else { "release" }
                    );
                    // route_input(DeviceInput::GridPress { x, y, pressed }, state);
                }
                HardwareEvent::NeoKeyPress { key, pressed } => {
                    println!(
                        "NeoKey {} {}",
                        key,
                        if pressed { "press" } else { "release" }
                    );
                    // route_input(DeviceInput::ButtonA/B/etc., state);
                }
            }
        }

        // Tick at 8ms interval
        if last_tick.elapsed() >= tick_duration {
            // tick(state, &behavior);
            last_tick = Instant::now();
        }

        // Update outputs (when state changes)
        // let frame = to_simulator_frame(&state, &behavior);
        // oled.write_frame(&frame.oled.pixels).unwrap();
        // trellis.write_led_frame(&frame.leds.cells).unwrap();

        thread::sleep(Duration::from_millis(1));
    }
}
