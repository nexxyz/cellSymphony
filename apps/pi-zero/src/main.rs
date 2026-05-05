//! Headless Pi Zero 2W binary for Cell Symphony
//! Boots automatically, enables user to make music via OLED & controls

use cellsymphony_hal::{
    encoder_gpio::*, i2c_bus::*, i2s_dac::I2sDac, neokey::*, neotrellis::*, oled_ssd1351::*,
    pinmap::*,
};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

fn main() {
    println!("Cell Symphony - Headless Pi Zero 2W");

    // Initialize HAL hardware
    let i2c_bus = I2CBus::new(1).expect("I2C init failed");
    let mut oled = OledSsd1351::new().expect("OLED init failed");
    let mut trellis = NeoTrellis::new("/dev/i2c-1").expect("Trellis init failed");
    let mut neokey = NeoKey::new("/dev/i2c-1").expect("NeoKey init failed");
    let _dac = I2sDac::new().expect("DAC init failed");

    // Event channel for encoder interrupts
    let (event_tx, event_rx) = mpsc::channel::<HardwareEvent>();

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

    // Initialize display with startup message
    let startup_frame = vec![0u8; 128 * 128 * 2]; // Black screen
    let _ = oled.write_frame(&startup_frame);

    println!("Hardware initialized. Ready to make music!");

    // Main loop (8ms tick = 125Hz)
    let mut last_tick = Instant::now();
    let tick_duration = Duration::from_millis(8);

    loop {
        // Handle hardware events
        while let Ok(event) = event_rx.try_recv() {
            match event {
                HardwareEvent::EncoderTurn { id, delta } => {
                    println!("Encoder {} turn: {}", id, delta);
                    // TODO: route to menu/parameter control
                }
                HardwareEvent::EncoderPress { id } => {
                    println!("Encoder {} pressed", id);
                    // TODO: route to menu selection
                }
            }
        }

        // Scan NeoTrellis grid (8x8)
        if let Ok(presses) = trellis.scan_keys() {
            for (x, y, pressed) in presses {
                if pressed {
                    // Map grid position to MIDI note
                    let note = (y * 8 + x) as u8 + 60; // C4 + position
                    println!("Grid ({}, {}) pressed -> Note {}", x, y, note);
                    // TODO: trigger note via DAC
                }
            }
        }

        // Scan NeoKey buttons
        if let Ok(keys) = neokey.scan() {
            for (key, pressed) in keys {
                if pressed {
                    println!("NeoKey {} pressed", key);
                    // TODO: Map to transport controls or shortcuts
                }
            }
        }

        // 8ms tick for timing (125Hz)
        if last_tick.elapsed() >= tick_duration {
            last_tick = Instant::now();
            // TODO: Advance sequencer, update display, etc.
        }

        thread::sleep(Duration::from_millis(1));
    }
}
