use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput};
use realtime_engine::synth::{InstrumentsConfig, SynthEngine};
use rodio::{OutputStream, OutputStreamHandle, Sink};
use serde::Deserialize;
use tauri::Emitter;

#[derive(Deserialize)]
#[serde(tag = "type")]
enum MusicalEventPayload {
    #[serde(rename = "note_on")]
    NoteOn {
        channel: u8,
        note: u8,
        velocity: u8,
        #[serde(default, rename = "durationMs")]
        duration_ms: Option<u32>,
    },
    #[serde(rename = "note_off")]
    NoteOff { channel: u8, note: u8 },
    #[serde(rename = "cc")]
    Cc {
        channel: u8,
        controller: u8,
        value: u8,
    },
    #[serde(other)]
    Unsupported,
}

struct AudioRuntime {
    _stream: OutputStream,
    handle: OutputStreamHandle,
}

#[derive(Clone, Copy)]
struct QueuedNote {
    instrument_slot: u8,
    note: u8,
    velocity: u8,
    duration_ms: u32,
}

#[derive(Clone, Copy)]
enum QueuedAudioEvent {
    Note(QueuedNote),
    NoteOff {
        instrument_slot: u8,
        note: u8,
    },
    Cc {
        instrument_slot: u8,
        controller: u8,
        value: u8,
    },
}

impl AudioRuntime {
    fn new() -> Result<Self, String> {
        let (stream, handle) =
            OutputStream::try_default().map_err(|e| format!("audio init failed: {e}"))?;
        Ok(Self {
            _stream: stream,
            handle,
        })
    }

    fn start_engine(&self, engine: Arc<Mutex<SynthEngine>>) -> Result<(), String> {
        let source = EngineSource::new(engine, 48_000);
        let sink = Sink::try_new(&self.handle).map_err(|e| format!("sink create failed: {e}"))?;
        sink.append(source);
        sink.play();
        sink.detach();
        Ok(())
    }
}

struct EngineSource {
    engine: Arc<Mutex<SynthEngine>>,
    sample_rate: u32,
    buf: Vec<f32>,
    idx: usize,
}

impl EngineSource {
    fn new(engine: Arc<Mutex<SynthEngine>>, sample_rate: u32) -> Self {
        Self {
            engine,
            sample_rate,
            buf: Vec::new(),
            idx: 0,
        }
    }

    fn refill(&mut self) {
        const BLOCK: usize = 128;
        self.buf.clear();
        self.buf.reserve(BLOCK);
        if let Ok(mut eng) = self.engine.lock() {
            for _ in 0..BLOCK {
                self.buf.push(eng.next_sample());
            }
        } else {
            for _ in 0..BLOCK {
                self.buf.push(0.0);
            }
        }
        self.idx = 0;
    }
}

impl Iterator for EngineSource {
    type Item = f32;
    fn next(&mut self) -> Option<Self::Item> {
        if self.idx >= self.buf.len() {
            self.refill();
        }
        let v = self.buf.get(self.idx).copied().unwrap_or(0.0);
        self.idx += 1;
        Some(v)
    }
}

impl rodio::Source for EngineSource {
    fn current_frame_len(&self) -> Option<usize> {
        None
    }

    fn channels(&self) -> u16 {
        1
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<std::time::Duration> {
        None
    }
}

struct AppState {
    trigger_tx: Sender<QueuedAudioEvent>,
    engine: Arc<Mutex<SynthEngine>>,
    midi_out: Mutex<Option<midir::MidiOutputConnection>>,
    midi_in: Mutex<Option<MidiInputConnection<()>>>,
}

#[derive(serde::Serialize)]
struct MidiPortInfo {
    id: String,
    name: String,
}

#[derive(serde::Serialize, Clone)]
struct MidiInMessage {
    bytes: Vec<u8>,
}

#[tauri::command]
fn midi_list_outputs() -> Result<Vec<MidiPortInfo>, String> {
    let out = MidiOutput::new("cellsymphony-midi-out").map_err(|e| e.to_string())?;
    let ports = out.ports();
    let mut res = Vec::new();
    for (idx, port) in ports.iter().enumerate() {
        let name = out
            .port_name(port)
            .unwrap_or_else(|_| "<unknown>".to_string());
        res.push(MidiPortInfo {
            id: idx.to_string(),
            name,
        });
    }
    Ok(res)
}

#[tauri::command]
fn midi_list_inputs() -> Result<Vec<MidiPortInfo>, String> {
    let mut input = MidiInput::new("cellsymphony-midi-in").map_err(|e| e.to_string())?;
    input.ignore(Ignore::None);
    let ports = input.ports();
    let mut res = Vec::new();
    for (idx, port) in ports.iter().enumerate() {
        let name = input
            .port_name(port)
            .unwrap_or_else(|_| "<unknown>".to_string());
        res.push(MidiPortInfo {
            id: idx.to_string(),
            name,
        });
    }
    Ok(res)
}

#[tauri::command]
fn midi_select_output(id: Option<String>, state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state
        .midi_out
        .lock()
        .map_err(|_| "midi mutex poisoned".to_string())?;
    *guard = None;
    let Some(id) = id else {
        return Ok(());
    };
    let idx: usize = id
        .parse()
        .map_err(|_| "invalid midi output id".to_string())?;
    let out = MidiOutput::new("cellsymphony-midi-out").map_err(|e| e.to_string())?;
    let ports = out.ports();
    let port = ports
        .get(idx)
        .ok_or_else(|| "midi output id out of range".to_string())?;
    let conn = out
        .connect(port, "cellsymphony-midi-out-conn")
        .map_err(|e| e.to_string())?;
    *guard = Some(conn);
    Ok(())
}

#[tauri::command]
fn midi_select_input(
    id: Option<String>,
    state: tauri::State<AppState>,
    app: tauri::AppHandle,
) -> Result<(), String> {
    let mut guard = state
        .midi_in
        .lock()
        .map_err(|_| "midi mutex poisoned".to_string())?;
    *guard = None;
    let Some(id) = id else {
        return Ok(());
    };
    let idx: usize = id
        .parse()
        .map_err(|_| "invalid midi input id".to_string())?;

    let mut input = MidiInput::new("cellsymphony-midi-in").map_err(|e| e.to_string())?;
    input.ignore(Ignore::None);
    let ports = input.ports();
    let port = ports
        .get(idx)
        .ok_or_else(|| "midi input id out of range".to_string())?;
    let app2 = app.clone();
    let conn = input
        .connect(
            port,
            "cellsymphony-midi-in-conn",
            move |_stamp, msg, _| {
                let _ = app2.emit(
                    "midi_in",
                    MidiInMessage {
                        bytes: msg.to_vec(),
                    },
                );
            },
            (),
        )
        .map_err(|e| e.to_string())?;
    *guard = Some(conn);
    Ok(())
}

#[tauri::command]
fn midi_send(bytes: Vec<u8>, state: tauri::State<AppState>) -> Result<(), String> {
    let mut guard = state
        .midi_out
        .lock()
        .map_err(|_| "midi mutex poisoned".to_string())?;
    let Some(conn) = guard.as_mut() else {
        return Ok(());
    };
    conn.send(&bytes).map_err(|e| e.to_string())
}

#[tauri::command]
fn trigger_musical_event(
    event: MusicalEventPayload,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    match event {
        MusicalEventPayload::NoteOn {
            channel,
            note,
            velocity,
            duration_ms,
        } => {
            let duration = duration_ms.unwrap_or(86_400_000).clamp(10, 86_400_000);
            state
                .trigger_tx
                .send(QueuedAudioEvent::Note(QueuedNote {
                    instrument_slot: channel.clamp(0, 15),
                    note: note.min(127),
                    velocity: velocity.clamp(1, 127),
                    duration_ms: duration,
                }))
                .map_err(|e| format!("audio queue send failed: {e}"))
        }
        MusicalEventPayload::Cc {
            channel,
            controller,
            value,
        } => state
            .trigger_tx
            .send(QueuedAudioEvent::Cc {
                instrument_slot: channel.clamp(0, 15),
                controller,
                value,
            })
            .map_err(|e| format!("audio queue send failed: {e}")),
        MusicalEventPayload::NoteOff { channel, note } => state
            .trigger_tx
            .send(QueuedAudioEvent::NoteOff {
                instrument_slot: channel.clamp(0, 15),
                note: note.min(127),
            })
            .map_err(|e| format!("audio queue send failed: {e}")),
        MusicalEventPayload::Unsupported => Ok(()),
    }
}

#[tauri::command]
fn audio_set_instruments(
    config: InstrumentsConfig,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mut eng = state
        .engine
        .lock()
        .map_err(|_| "audio engine mutex poisoned".to_string())?;
    eng.set_instruments(config);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (trigger_tx, trigger_rx) = mpsc::channel::<QueuedAudioEvent>();

    let engine = Arc::new(Mutex::new(SynthEngine::new(48_000)));
    let engine2 = engine.clone();

    thread::spawn(move || {
        let audio = match AudioRuntime::new() {
            Ok(audio) => audio,
            Err(error) => {
                eprintln!("{error}");
                return;
            }
        };

        if let Err(error) = audio.start_engine(engine2.clone()) {
            eprintln!("audio engine start failed: {error}");
            return;
        }

        while let Ok(event) = trigger_rx.recv() {
            match event {
                QueuedAudioEvent::Note(note) => {
                    if let Ok(mut eng) = engine2.lock() {
                        eng.note_on(
                            note.instrument_slot,
                            note.note,
                            note.velocity,
                            note.duration_ms,
                        );
                    }
                }
                QueuedAudioEvent::Cc {
                    instrument_slot,
                    controller,
                    value,
                } => {
                    if let Ok(mut eng) = engine2.lock() {
                        if controller == 120 || controller == 123 {
                            eng.all_notes_off();
                        }
                        eng.cc(instrument_slot, controller, value);
                    }
                }
                QueuedAudioEvent::NoteOff {
                    instrument_slot,
                    note,
                } => {
                    if let Ok(mut eng) = engine2.lock() {
                        eng.note_off(instrument_slot, note);
                    }
                }
            }
        }
    });

    tauri::Builder::default()
        .manage(AppState {
            trigger_tx,
            engine,
            midi_out: Mutex::new(None),
            midi_in: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            trigger_musical_event,
            audio_set_instruments,
            midi_list_outputs,
            midi_list_inputs,
            midi_select_output,
            midi_select_input,
            midi_send
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
