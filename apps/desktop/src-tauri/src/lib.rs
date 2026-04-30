use std::sync::Mutex;

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
        #[serde(default)]
        durationMs: Option<u32>,
    },
    #[serde(other)]
    Unsupported,
}

struct AudioRuntime {
    _stream: OutputStream,
    handle: OutputStreamHandle,
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
    audio: Mutex<AudioRuntime>,
}

#[tauri::command]
fn trigger_musical_event(event: MusicalEventPayload, state: tauri::State<AppState>) -> Result<(), String> {
    match event {
        MusicalEventPayload::NoteOn {
            channel,
            note,
            velocity,
            durationMs,
        } => {
            let _ = channel;
            let duration = durationMs.unwrap_or(120).clamp(10, 5000);
            let audio = state
                .audio
                .lock()
                .map_err(|_| String::from("audio runtime lock poisoned"))?;
            audio.trigger_note(note.min(127), velocity.clamp(1, 127), duration)
        }
        MusicalEventPayload::Unsupported => Ok(()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let audio = AudioRuntime::new().expect("failed to initialize audio runtime");

    tauri::Builder::default()
        .manage(AppState {
            audio: Mutex::new(audio),
        })
        .invoke_handler(tauri::generate_handler![trigger_musical_event])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
