use std::sync::mpsc::{self, Sender};
use std::thread;

use realtime_engine::synth::{render_note_preview, NoteTrigger};
use rodio::{buffer::SamplesBuffer, OutputStream, OutputStreamHandle, Sink};
use serde::Deserialize;

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
    #[serde(other)]
    Unsupported,
}

struct AudioRuntime {
    _stream: OutputStream,
    handle: OutputStreamHandle,
}

#[derive(Clone, Copy)]
struct QueuedNote {
    note: u8,
    velocity: u8,
    duration_ms: u32,
}

impl AudioRuntime {
    fn new() -> Result<Self, String> {
        let (stream, handle) = OutputStream::try_default().map_err(|e| format!("audio init failed: {e}"))?;
        Ok(Self {
            _stream: stream,
            handle,
        })
    }

    fn trigger_note(&self, note: u8, velocity: u8, duration_ms: u32) -> Result<(), String> {
        let data = render_note_preview(
            NoteTrigger {
                midi_note: note,
                velocity,
                duration_ms,
            },
            48_000,
        );
        let source = SamplesBuffer::new(1, 48_000, data);
        let sink = Sink::try_new(&self.handle).map_err(|e| format!("sink create failed: {e}"))?;
        sink.append(source);
        sink.detach();
        Ok(())
    }
}

struct AppState {
    trigger_tx: Sender<QueuedNote>,
}

#[tauri::command]
fn trigger_musical_event(event: MusicalEventPayload, state: tauri::State<AppState>) -> Result<(), String> {
    match event {
        MusicalEventPayload::NoteOn {
            channel,
            note,
            velocity,
            duration_ms,
        } => {
            let _ = channel;
            let duration = duration_ms.unwrap_or(120).clamp(10, 5000);
            state
                .trigger_tx
                .send(QueuedNote {
                    note: note.min(127),
                    velocity: velocity.clamp(1, 127),
                    duration_ms: duration,
                })
                .map_err(|e| format!("audio queue send failed: {e}"))
        }
        MusicalEventPayload::Unsupported => Ok(()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (trigger_tx, trigger_rx) = mpsc::channel::<QueuedNote>();

    thread::spawn(move || {
        let audio = match AudioRuntime::new() {
            Ok(audio) => audio,
            Err(error) => {
                eprintln!("{error}");
                return;
            }
        };

        while let Ok(note) = trigger_rx.recv() {
            if let Err(error) = audio.trigger_note(note.note, note.velocity, note.duration_ms) {
                eprintln!("audio trigger failed: {error}");
            }
        }
    });

    tauri::Builder::default()
        .manage(AppState { trigger_tx })
        .invoke_handler(tauri::generate_handler![trigger_musical_event])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
