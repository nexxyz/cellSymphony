mod audio_config;
mod midi;
mod samples;

use audio_config::{
    build_audio_slot_configs, parse_voice_stealing_mode, synth_payload, AudioInstrumentsConfig,
    AudioRuntimePolicyConfig,
};
use midi::{midi_list_inputs, midi_list_outputs, midi_select_input, midi_select_output, midi_send};
use rodio_engine_source::{EngineEvent, EngineSource};
use samples::{resolve_sample_file, sample_list, sample_preview};
use std::sync::mpsc::{self, Receiver, Sender};
use std::sync::Mutex;
use std::thread;

use midir::MidiInputConnection;
use realtime_engine::synth::INSTRUMENT_SLOT_COUNT;
use rodio::{OutputStream, OutputStreamHandle, Sink};
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
pub(crate) struct QueuedNote {
    instrument_slot: u8,
    note: u8,
    velocity: u8,
    duration_ms: u32,
}

#[derive(Clone)]
pub(crate) enum QueuedAudioEvent {
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
    Sample {
        path: String,
        gain: f32,
        rate: f32,
    },
    SetInstruments(realtime_engine::synth::InstrumentsConfig),
    SetVoiceStealingMode(realtime_engine::synth::VoiceStealingMode),
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

    fn start_engine(&self, control_rx: Receiver<EngineEvent>) -> Result<(), String> {
        let source = EngineSource::new(control_rx, 48_000);
        let sink = Sink::try_new(&self.handle).map_err(|e| format!("sink create failed: {e}"))?;
        sink.append(source);
        sink.play();
        sink.detach();
        Ok(())
    }
}

pub(crate) struct AppState {
    pub(crate) trigger_tx: Sender<QueuedAudioEvent>,
    synth_slots: Mutex<[bool; INSTRUMENT_SLOT_COUNT]>,
    sample_cfgs: Mutex<[SampleSlotConfig; INSTRUMENT_SLOT_COUNT]>,
    pub(crate) midi_out: Mutex<Option<midir::MidiOutputConnection>>,
    pub(crate) midi_in: Mutex<Option<MidiInputConnection<()>>>,
}

#[derive(Clone, Debug)]
pub(crate) struct SampleSlotConfig {
    pub(crate) slots: [Option<String>; 8],
    pub(crate) tune_semis: f32,
    pub(crate) gain_pct: f32,
    pub(crate) vel_sens_pct: f32,
}

impl Default for SampleSlotConfig {
    fn default() -> Self {
        Self {
            slots: [None, None, None, None, None, None, None, None],
            tune_semis: 0.0,
            gain_pct: 100.0,
            vel_sens_pct: 100.0,
        }
    }
}

#[tauri::command]
fn trigger_musical_event(
    event: MusicalEventPayload,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let is_synth_slot = |slot: u8| -> bool {
        if let Ok(guard) = state.synth_slots.lock() {
            return guard[(slot as usize).min(INSTRUMENT_SLOT_COUNT - 1)];
        }
        true
    };
    match event {
        MusicalEventPayload::NoteOn {
            channel,
            note,
            velocity,
            duration_ms,
        } => {
            let slot = channel.clamp(0, (INSTRUMENT_SLOT_COUNT - 1) as u8);
            if !is_synth_slot(slot) {
                if let Ok(cfgs) = state.sample_cfgs.lock() {
                    let cfg = &cfgs[(slot as usize).min(INSTRUMENT_SLOT_COUNT - 1)];
                    let sample_slot = (note.saturating_sub(36)).min(7) as usize;
                    if let Some(path) = &cfg.slots[sample_slot] {
                        let Some(sample_path) = resolve_sample_file(path) else {
                            return Ok(());
                        };
                        let vel_norm = (velocity as f32 / 127.0).clamp(0.0, 1.0);
                        let sens = (cfg.vel_sens_pct / 100.0).clamp(0.0, 2.0);
                        let gain = ((cfg.gain_pct / 100.0) * vel_norm * sens).clamp(0.0, 2.0);
                        let rate = 2.0_f32.powf(cfg.tune_semis / 12.0).clamp(0.25, 4.0);
                        state
                            .trigger_tx
                            .send(QueuedAudioEvent::Sample {
                                path: sample_path,
                                gain,
                                rate,
                            })
                            .map_err(|e| format!("audio queue send failed: {e}"))?;
                    }
                }
                return Ok(());
            }
            let duration = duration_ms.unwrap_or(86_400_000).clamp(10, 86_400_000);
            state
                .trigger_tx
                .send(QueuedAudioEvent::Note(QueuedNote {
                    instrument_slot: slot,
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
        } => {
            let slot = channel.clamp(0, (INSTRUMENT_SLOT_COUNT - 1) as u8);
            if !is_synth_slot(slot) {
                return Ok(());
            }
            state
                .trigger_tx
                .send(QueuedAudioEvent::Cc {
                    instrument_slot: slot,
                    controller,
                    value,
                })
                .map_err(|e| format!("audio queue send failed: {e}"))
        }
        MusicalEventPayload::NoteOff { channel, note } => {
            let slot = channel.clamp(0, (INSTRUMENT_SLOT_COUNT - 1) as u8);
            if !is_synth_slot(slot) {
                return Ok(());
            }
            state
                .trigger_tx
                .send(QueuedAudioEvent::NoteOff {
                    instrument_slot: slot,
                    note: note.min(127),
                })
                .map_err(|e| format!("audio queue send failed: {e}"))
        }
        MusicalEventPayload::Unsupported => Ok(()),
    }
}

#[tauri::command]
fn audio_set_instruments(
    config: AudioInstrumentsConfig,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let (next_slots, next_sample_cfgs) = build_audio_slot_configs(&config.instruments);
    if let Ok(mut slots) = state.synth_slots.lock() {
        *slots = next_slots;
    }
    if let Ok(mut sample_cfgs) = state.sample_cfgs.lock() {
        *sample_cfgs = next_sample_cfgs;
    }
    let synth_payload = synth_payload(&config);
    state
        .trigger_tx
        .send(QueuedAudioEvent::SetInstruments(synth_payload))
        .map_err(|e| format!("audio queue send failed: {e}"))
}

#[tauri::command]
fn audio_set_runtime_policy(
    policy: AudioRuntimePolicyConfig,
    state: tauri::State<AppState>,
) -> Result<(), String> {
    let mode = parse_voice_stealing_mode(&policy.voice_stealing_mode);
    state
        .trigger_tx
        .send(QueuedAudioEvent::SetVoiceStealingMode(mode))
        .map_err(|e| format!("audio queue send failed: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let (trigger_tx, trigger_rx) = mpsc::channel::<QueuedAudioEvent>();

    thread::spawn(move || {
        let (engine_tx, engine_rx) = mpsc::channel::<EngineEvent>();
        let audio = match AudioRuntime::new() {
            Ok(audio) => audio,
            Err(error) => {
                eprintln!("{error}");
                return;
            }
        };

        if let Err(error) = audio.start_engine(engine_rx) {
            eprintln!("audio engine start failed: {error}");
            return;
        }

        while let Ok(event) = trigger_rx.recv() {
            match event {
                QueuedAudioEvent::Note(note) => {
                    let _ = engine_tx.send(EngineEvent::NoteOn {
                        instrument_slot: note.instrument_slot,
                        note: note.note,
                        velocity: note.velocity,
                        duration_ms: note.duration_ms,
                    });
                }
                QueuedAudioEvent::Cc {
                    instrument_slot,
                    controller,
                    value,
                } => {
                    let _ = engine_tx.send(EngineEvent::Cc {
                        instrument_slot,
                        controller,
                        value,
                    });
                }
                QueuedAudioEvent::NoteOff {
                    instrument_slot,
                    note,
                } => {
                    let _ = engine_tx.send(EngineEvent::NoteOff {
                        instrument_slot,
                        note,
                    });
                }
                QueuedAudioEvent::Sample { path, gain, rate } => {
                    if let Ok(file) = std::fs::File::open(&path) {
                        let reader = std::io::BufReader::new(file);
                        if let Ok(decoder) = rodio::Decoder::new(reader) {
                            if let Ok(sink) = Sink::try_new(&audio.handle) {
                                use rodio::Source;
                                sink.append(decoder.speed(rate).amplify(gain));
                                sink.detach();
                            }
                        }
                    }
                }
                QueuedAudioEvent::SetInstruments(config) => {
                    let _ = engine_tx.send(EngineEvent::SetInstruments(config));
                }
                QueuedAudioEvent::SetVoiceStealingMode(mode) => {
                    let _ = engine_tx.send(EngineEvent::SetVoiceStealingMode(mode));
                }
            }
        }
    });

    tauri::Builder::default()
        .manage(AppState {
            trigger_tx,
            synth_slots: Mutex::new([true; INSTRUMENT_SLOT_COUNT]),
            sample_cfgs: Mutex::new(std::array::from_fn(|_| SampleSlotConfig::default())),
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
            midi_send,
            sample_list,
            sample_preview,
            audio_set_runtime_policy
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
