//! Headless Pi Zero 2W binary for Cell Symphony
//! Boots automatically, enables user to make music via OLED & controls

use cellsymphony_hal::{
    encoder_gpio::*, i2c_bus::*, i2s_dac::I2sDac, neokey::*, neotrellis::*, oled_ssd1351::*,
    pinmap::*,
};
use midir::MidiInput;
use rodio::{OutputStream, Sink};
use std::sync::mpsc::{self, Sender};
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

/// Audio output manager using rodio (works when compiled natively on Pi)
struct AudioManager {
    _stream: OutputStream, // Keep alive
    sink: Mutex<Sink>,
}

impl AudioManager {
    fn new() -> Result<Self, String> {
        let (stream, handle) = OutputStream::try_default()
            .map_err(|e| format!("Failed to create audio stream: {}", e))?;
        let sink = Sink::try_new(&handle).map_err(|e| format!("Failed to create sink: {}", e))?;
        Ok(Self {
            _stream: stream,
            sink: Mutex::new(sink),
        })
    }

    fn play_note(&self, note: u8, velocity: u8, duration_ms: u32) -> Result<(), String> {
        use realtime_engine::synth::{render_note_preview, NoteTrigger, Waveform};

        let trigger = NoteTrigger {
            midi_note: note,
            velocity,
            duration_ms,
            waveform: Waveform::Sine,
            lowpass_cutoff_hz: 8_000.0,
            lowpass_resonance: 0.2,
        };

        let samples = render_note_preview(trigger, 48_000);
        let source = rodio::buffer::SamplesBuffer::new(1, 48_000, samples);

        let sink = self.sink.lock().unwrap();
        sink.append(source);
        Ok(())
    }

    fn stop(&self) {
        let sink = self.sink.lock().unwrap();
        sink.stop();
    }
}

/// MIDI message for cross-thread communication
enum MidiMessage {
    NoteOn { note: u8, velocity: u8 },
    NoteOff { note: u8 },
    CC { cc: u8, value: u8 },
}

fn main() {
    println!("Cell Symphony - Headless Pi Zero 2W");

    // Initialize HAL hardware
    let _i2c_bus = I2CBus::new(1).expect("I2C init failed");
    let mut oled = OledSsd1351::new().expect("OLED init failed");
    let mut trellis = NeoTrellis::new("/dev/i2c-1").expect("Trellis init failed");
    let mut neokey = NeoKey::new("/dev/i2c-1").expect("NeoKey init failed");
    let _dac = I2sDac::new().expect("DAC init failed");

    // Initialize audio
    let audio = match AudioManager::new() {
        Ok(a) => {
            println!("Audio ready (rodio + I2S -> PCM5102)");
            Some(a)
        }
        Err(e) => {
            println!("Audio init failed: {} (continuing without audio)", e);
            None
        }
    };

    // MIDI message channel (Send-safe)
    let (midi_tx, midi_rx) = mpsc::channel::<MidiMessage>();

    // Initialize MIDI input
    let midi_input = MidiInput::new("cellsymphony-pi").expect("MIDI init failed");
    let ports = midi_input.ports();
    println!(
        "Available MIDI inputs: {:?}",
        ports
            .iter()
            .map(|p| midi_input.port_name(p))
            .collect::<Vec<_>>()
    );

    // Connect to first available MIDI input (if any)
    let _midi_conn = if !ports.is_empty() {
        let port = &ports[0];
        let port_name = midi_input
            .port_name(port)
            .unwrap_or_else(|_| "<unknown>".into());
        println!("Connecting to MIDI: {}", port_name);

        let tx = midi_tx.clone();
        Some(
            midi_input
                .connect(
                    port,
                    "cellsymphony-midi",
                    move |_timestamp, message, _| {
                        if message.len() >= 3 {
                            let status = message[0] & 0xF0;
                            let data1 = message[1];
                            let data2 = message[2];
                            let msg = match status {
                                0x90 if data2 > 0 => MidiMessage::NoteOn {
                                    note: data1,
                                    velocity: data2,
                                },
                                0x90 | 0x80 => MidiMessage::NoteOff { note: data1 },
                                0xB0 => MidiMessage::CC {
                                    cc: data1,
                                    value: data2,
                                },
                                _ => return,
                            };
                            let _ = tx.send(msg);
                        }
                    },
                    (),
                )
                .expect("Failed to connect MIDI"),
        )
    } else {
        println!("No MIDI inputs found");
        None
    };

    // Test tone on startup
    if let Some(ref audio) = audio {
        let _ = audio.play_note(60, 100, 500);
        println!("Test tone played (C4)");
    }

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
        // Handle MIDI messages (sent from callback via channel)
        while let Ok(msg) = midi_rx.try_recv() {
            match msg {
                MidiMessage::NoteOn { note, velocity } => {
                    println!("MIDI Note On: {} vel {}", note, velocity);
                    if let Some(ref audio) = audio {
                        let _ = audio.play_note(note, velocity, 1000);
                    }
                }
                MidiMessage::NoteOff { note } => {
                    println!("MIDI Note Off: {}", note);
                }
                MidiMessage::CC { cc, value } => {
                    println!("MIDI CC: {} = {}", cc, value);
                }
            }
        }

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
                    // Map grid position to MIDI note and trigger
                    let note = (y * 8 + x) as u8 + 60; // C4 + position
                    println!("Grid ({}, {}) pressed -> Note {}", x, y, note);
                    if let Some(ref audio) = audio {
                        let _ = audio.play_note(note, 100, 500);
                    }
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
