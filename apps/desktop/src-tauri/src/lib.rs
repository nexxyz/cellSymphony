use std::sync::mpsc::{self, Sender};
use std::thread;

use realtime_engine::synth::{render_note_preview, NoteTrigger, Waveform};
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
    channel: u8,
    note: u8,
    velocity: u8,
    duration_ms: u32,
}

#[derive(Clone, Copy)]
enum QueuedAudioEvent {
    Note(QueuedNote),
    Cc {
        channel: u8,
        controller: u8,
        value: u8,
    },
}

#[derive(Clone, Copy)]
struct FilterState {
    cutoff_hz: f32,
    resonance: f32,
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

    fn trigger_note(
        &self,
        channel: u8,
        note: u8,
        velocity: u8,
        duration_ms: u32,
        filter: FilterState,
    ) -> Result<(), String> {
        let waveform = match channel {
            1 => Waveform::Pulse { duty: 0.5 },
            _ => Waveform::Sine,
        };
        let data = render_note_preview(
            NoteTrigger {
                midi_note: note,
                velocity,
                duration_ms,
                waveform,
                lowpass_cutoff_hz: filter.cutoff_hz,
                lowpass_resonance: filter.resonance,
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
    trigger_tx: Sender<QueuedAudioEvent>,
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
            let _ = channel;
            let duration = duration_ms.unwrap_or(120).clamp(10, 5000);
            state
                .trigger_tx
                .send(QueuedAudioEvent::Note(QueuedNote {
                    channel: channel.clamp(0, 15),
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
                channel: channel.clamp(0, 15),
                controller,
                value,
            })
            .map_err(|e| format!("audio queue send failed: {e}")),
        MusicalEventPayload::Unsupported => Ok(()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (trigger_tx, trigger_rx) = mpsc::channel::<QueuedAudioEvent>();

    thread::spawn(move || {
        let audio = match AudioRuntime::new() {
            Ok(audio) => audio,
            Err(error) => {
                eprintln!("{error}");
                return;
            }
        };

        let mut filter = FilterState {
            cutoff_hz: 8_000.0,
            resonance: 0.2,
        };

        while let Ok(event) = trigger_rx.recv() {
            match event {
                QueuedAudioEvent::Note(note) => {
                    if let Err(error) = audio.trigger_note(
                        note.channel,
                        note.note,
                        note.velocity,
                        note.duration_ms,
                        filter,
                    ) {
                        eprintln!("audio trigger failed: {error}");
                    }
                }
                QueuedAudioEvent::Cc {
                    channel,
                    controller,
                    value,
                } => {
                    let _ = channel;
                    if controller == 74 {
                        let norm = (value as f32 / 127.0).clamp(0.0, 1.0);
                        filter.cutoff_hz = 120.0 + norm * 15_880.0;
                    }
                    if controller == 71 {
                        filter.resonance = (value as f32 / 127.0).clamp(0.0, 1.0);
                    }
                    if controller == 120 || controller == 123 {
                        filter.cutoff_hz = 8_000.0;
                        filter.resonance = 0.2;
                    }
                }
            }
        }
    });

    tauri::Builder::default()
        .manage(AppState { trigger_tx })
        .invoke_handler(tauri::generate_handler![trigger_musical_event])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
