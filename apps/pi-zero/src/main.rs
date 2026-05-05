//! Headless Pi Zero 2W binary for Cell Symphony
//! Uses HAL modules to drive hardware directly

use cellsymphony_hal::{
    encoder_gpio::*, i2c_bus::*, neokey::*, neotrellis::*, oled_ssd1351::*, pinmap::*,
};
use std::sync::mpsc;
use std::thread;
use std::time::{Duration, Instant};

fn main() {
    println!("Cell Symphony - Headless Pi Zero 2W");

    // Initialize HAL
    let i2c_bus = I2CBus::new(1).expect("I2C init failed");
    let mut oled = OledSsd1351::new().expect("OLED init failed");
    let mut trellis = NeoTrellis::new("/dev/i2c-1").expect("Trellis init failed");
    let mut neokey = NeoKey::new("/dev/i2c-1").expect("NeoKey init failed");

    // Event channel
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

    println!("Hardware initialized. Starting main loop...");

    // Main loop (8ms tick = 125Hz)
    let mut last_tick = Instant::now();
    let tick_duration = Duration::from_millis(8);

    loop {
        // Handle hardware events
        while let Ok(event) = event_rx.try_recv() {
            match event {
                HardwareEvent::EncoderTurn { id, delta } => {
                    println!("Encoder {} turn: {}", id, delta);
                }
                HardwareEvent::EncoderPress { id } => {
                    println!("Encoder {} pressed", id);
                }
            }
        }

        // Scan NeoTrellis grid
        if let Ok(presses) = trellis.scan_keys() {
            for (x, y, pressed) in presses {
                println!(
                    "Grid ({}, {}) {}",
                    x,
                    y,
                    if pressed { "press" } else { "release" }
                );
            }
        }

        // Scan NeoKey buttons
        if let Ok(keys) = neokey.scan() {
            for (key, pressed) in keys {
                println!(
                    "NeoKey {} {}",
                    key,
                    if pressed { "press" } else { "release" }
                );
            }
        }

        // Tick at 8ms interval
        if last_tick.elapsed() >= tick_duration {
            last_tick = Instant::now();
        }

        thread::sleep(Duration::from_millis(1));
    }
}
