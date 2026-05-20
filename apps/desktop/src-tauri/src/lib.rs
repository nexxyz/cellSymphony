use std::sync::mpsc::{self, Sender};
use std::sync::{Arc, Mutex};
use std::thread;

use midir::{Ignore, MidiInput, MidiInputConnection, MidiOutput};
use realtime_engine::synth::{InstrumentSlotConfig, InstrumentsConfig, SynthConfig, SynthEngine};
use rodio::{OutputStream, OutputStreamHandle, Sink};
use serde::Deserialize;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
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

#[derive(Clone)]
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
    Sample {
        path: String,
        gain: f32,
        rate: f32,
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
    synth_slots: Mutex<[bool; 16]>,
    sample_cfgs: Mutex<[SampleSlotConfig; 16]>,
    midi_out: Mutex<Option<midir::MidiOutputConnection>>,
    midi_in: Mutex<Option<MidiInputConnection<()>>>,
}

#[derive(Clone, Debug)]
struct SampleSlotConfig {
    slots: [Option<String>; 8],
    tune_semis: f32,
    gain_pct: f32,
    vel_sens_pct: f32,
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

#[derive(Deserialize)]
struct AudioInstrumentsConfig {
    instruments: Vec<AudioInstrumentSlotConfig>,
}

#[derive(Deserialize)]
struct AudioInstrumentSlotConfig {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    synth: Option<SynthConfig>,
    #[serde(default)]
    sample: Option<AudioSampleConfig>,
}

#[derive(Deserialize)]
struct AudioSampleConfig {
    #[serde(default)]
    slots: Vec<AudioSampleSlotEntry>,
    #[serde(default, rename = "tuneSemis")]
    tune_semis: Option<f32>,
    #[serde(default)]
    amp: Option<AudioAmpConfig>,
}

#[derive(Deserialize)]
struct AudioSampleSlotEntry {
    #[serde(default)]
    path: Option<String>,
}

#[derive(Deserialize)]
struct AudioAmpConfig {
    #[serde(default, rename = "gainPct")]
    gain_pct: Option<f32>,
    #[serde(default, rename = "velocitySensitivityPct")]
    velocity_sensitivity_pct: Option<f32>,
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

#[derive(Serialize)]
struct SampleEntry {
    name: String,
    path: String,
    #[serde(rename = "isDir")]
    is_dir: bool,
}

#[tauri::command]
fn sample_list(dir: String) -> Result<Vec<SampleEntry>, String> {
    let root = resolve_samples_root()?;
    sample_list_from_root(&root, &dir)
}

fn sample_list_from_root(root: &PathBuf, dir: &str) -> Result<Vec<SampleEntry>, String> {
    let rel = sanitize_relative_dir(&dir)?;
    let target = root.join(&rel);
    let canon_root =
        fs::canonicalize(&root).map_err(|e| format!("samples root resolve failed: {e}"))?;
    let canon_target =
        fs::canonicalize(&target).map_err(|e| format!("directory not found: {e}"))?;
    if !canon_target.starts_with(&canon_root) {
        return Err("path outside samples root".to_string());
    }
    let mut out: Vec<SampleEntry> = Vec::new();
    for entry in fs::read_dir(&canon_target).map_err(|e| format!("read dir failed: {e}"))? {
        let e = entry.map_err(|err| format!("read dir entry failed: {err}"))?;
        let meta = e
            .metadata()
            .map_err(|err| format!("read metadata failed: {err}"))?;
        let is_dir = meta.is_dir();
        let file_name = e.file_name().to_string_lossy().to_string();
        if !is_dir {
            let ext = e
                .path()
                .extension()
                .map(|x| x.to_string_lossy().to_ascii_lowercase())
                .unwrap_or_default();
            if ext != "wav" {
                continue;
            }
        }
        let rel_path = rel_join(&rel, &file_name);
        out.push(SampleEntry {
            name: file_name,
            path: rel_path,
            is_dir,
        });
    }
    out.sort_by(|a, b| {
        if a.is_dir != b.is_dir {
            return b.is_dir.cmp(&a.is_dir);
        }
        a.name.to_lowercase().cmp(&b.name.to_lowercase())
    });
    Ok(out)
}

#[tauri::command]
fn sample_preview(path: String, state: tauri::State<AppState>) -> Result<(), String> {
    let full_path = resolve_sample_file(&path).ok_or_else(|| "invalid sample path".to_string())?;
    state
        .trigger_tx
        .send(QueuedAudioEvent::Sample {
            path: full_path,
            gain: 1.0,
            rate: 1.0,
        })
        .map_err(|e| format!("audio queue send failed: {e}"))
}

fn resolve_samples_root() -> Result<PathBuf, String> {
    let cwd = std::env::current_dir().map_err(|e| format!("cwd failed: {e}"))?;
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    let repo_root_samples = manifest_dir
        .parent()
        .and_then(|p| p.parent())
        .and_then(|p| p.parent())
        .map(|p| p.join("samples"));
    if let Some(path) = repo_root_samples {
        if path.exists() {
            return Ok(path);
        }
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    candidates.push(cwd.join("samples"));
    if let Some(p1) = cwd.parent() {
        candidates.push(p1.join("samples"));
        if let Some(p2) = p1.parent() {
            candidates.push(p2.join("samples"));
            if let Some(p3) = p2.parent() {
                candidates.push(p3.join("samples"));
            }
        }
    }

    candidates.push(manifest_dir.join("samples"));
    if let Some(p1) = manifest_dir.parent() {
        candidates.push(p1.join("samples"));
        if let Some(p2) = p1.parent() {
            candidates.push(p2.join("samples"));
            if let Some(p3) = p2.parent() {
                candidates.push(p3.join("samples"));
            }
        }
    }

    for candidate in candidates {
        if candidate.exists() {
            return Ok(candidate);
        }
    }

    let create_at = cwd.join("samples");
    fs::create_dir_all(&create_at).map_err(|e| format!("create samples dir failed: {e}"))?;
    Ok(create_at)
}

fn sanitize_relative_dir(input: &str) -> Result<String, String> {
    let trimmed = input.trim().replace('\\', "/");
    if trimmed.is_empty() {
        return Ok(String::new());
    }
    if trimmed.starts_with('/') {
        return Err("absolute path is not allowed".to_string());
    }
    let mut parts: Vec<String> = Vec::new();
    for p in trimmed.split('/') {
        if p.is_empty() || p == "." {
            continue;
        }
        if p == ".." {
            return Err("parent traversal is not allowed".to_string());
        }
        parts.push(p.to_string());
    }
    Ok(parts.join("/"))
}

fn rel_join(base: &str, name: &str) -> String {
    if base.is_empty() {
        name.to_string()
    } else {
        format!("{base}/{name}")
    }
}

fn resolve_sample_file(path: &str) -> Option<String> {
    let root = resolve_samples_root().ok()?;
    resolve_sample_file_from_root(&root, path)
}

fn resolve_sample_file_from_root(root: &PathBuf, path: &str) -> Option<String> {
    let rel = sanitize_relative_dir(path).ok()?;
    if rel.is_empty() {
        return None;
    }
    let target = root.join(&rel);
    let canon_root = fs::canonicalize(&root).ok()?;
    let canon_target = fs::canonicalize(&target).ok()?;
    if !canon_target.starts_with(&canon_root) {
        return None;
    }
    if !canon_target.is_file() {
        return None;
    }
    let ext = canon_target
        .extension()
        .map(|x| x.to_string_lossy().to_ascii_lowercase())
        .unwrap_or_default();
    if ext != "wav" {
        return None;
    }
    canon_target.to_str().map(|s| s.to_string())
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
    let is_synth_slot = |slot: u8| -> bool {
        if let Ok(guard) = state.synth_slots.lock() {
            return guard[(slot as usize).min(15)];
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
            let slot = channel.clamp(0, 15);
            if !is_synth_slot(slot) {
                if let Ok(cfgs) = state.sample_cfgs.lock() {
                    let cfg = &cfgs[(slot as usize).min(15)];
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
            let slot = channel.clamp(0, 15);
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
            let slot = channel.clamp(0, 15);
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
    let synth_payload = InstrumentsConfig {
        instruments: config
            .instruments
            .iter()
            .map(|slot| InstrumentSlotConfig {
                kind: slot.kind.clone(),
                synth: slot
                    .synth
                    .unwrap_or_else(realtime_engine::synth::default_synth_config),
            })
            .collect(),
    };
    let mut eng = state
        .engine
        .lock()
        .map_err(|_| "audio engine mutex poisoned".to_string())?;
    eng.set_instruments(synth_payload);
    Ok(())
}

fn build_audio_slot_configs(instruments: &[AudioInstrumentSlotConfig]) -> ([bool; 16], [SampleSlotConfig; 16]) {
    let mut synth_slots = [false; 16];
    let mut sample_cfgs = std::array::from_fn(|_| SampleSlotConfig::default());
    for (idx, slot) in instruments.iter().enumerate() {
        if idx >= 16 {
            break;
        }
        synth_slots[idx] = slot.kind == "synth";
        if slot.kind != "sample" {
            continue;
        }
        let mut out = SampleSlotConfig::default();
        if let Some(s) = &slot.sample {
            out.tune_semis = s.tune_semis.unwrap_or(0.0);
            if let Some(amp) = &s.amp {
                out.gain_pct = amp.gain_pct.unwrap_or(100.0);
                out.vel_sens_pct = amp.velocity_sensitivity_pct.unwrap_or(100.0);
            }
            for (i, entry) in s.slots.iter().enumerate().take(8) {
                out.slots[i] = entry.path.clone();
            }
        }
        sample_cfgs[idx] = out;
    }
    (synth_slots, sample_cfgs)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::Path;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn unique_temp_dir(prefix: &str) -> PathBuf {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock")
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("{prefix}_{nonce}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    fn touch(path: &Path) {
        fs::write(path, b"x").expect("write file");
    }

    #[test]
    fn sanitize_relative_dir_rejects_absolute_and_parent_traversal() {
        assert!(sanitize_relative_dir("../x").is_err());
        assert!(sanitize_relative_dir("a/../x").is_err());
        assert!(sanitize_relative_dir("/abs").is_err());
        assert!(sanitize_relative_dir("\\abs").is_err());
    }

    #[test]
    fn sanitize_relative_dir_normalizes_separator_and_dots() {
        assert_eq!(sanitize_relative_dir("a\\b//c").expect("sanitize"), "a/b/c");
        assert_eq!(sanitize_relative_dir(" ./a//b/ ").expect("sanitize"), "a/b");
    }

    #[test]
    fn resolve_sample_file_from_root_accepts_only_wav_inside_root() {
        let root = unique_temp_dir("cellsymphony_samples_resolve");
        let sub = root.join("drums");
        fs::create_dir_all(&sub).expect("subdir");
        let wav = sub.join("kick.wav");
        let txt = sub.join("readme.txt");
        touch(&wav);
        touch(&txt);

        let resolved = resolve_sample_file_from_root(&root, "drums/kick.wav");
        assert!(resolved.is_some());
        assert!(resolve_sample_file_from_root(&root, "drums/readme.txt").is_none());
        assert!(resolve_sample_file_from_root(&root, "drums").is_none());
        assert!(resolve_sample_file_from_root(&root, "../outside.wav").is_none());

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn sample_list_from_root_sorts_dirs_first_and_filters_wav() {
        let root = unique_temp_dir("cellsymphony_samples_list");
        let drums = root.join("Drums");
        fs::create_dir_all(&drums).expect("drums dir");
        touch(&root.join("b.wav"));
        touch(&root.join("A.WAV"));
        touch(&root.join("ignore.mp3"));

        let entries = sample_list_from_root(&root, "").expect("list");
        assert!(!entries.is_empty());
        assert_eq!(entries[0].is_dir, true);
        assert_eq!(entries[0].name, "Drums");
        let file_names: Vec<String> = entries
            .iter()
            .filter(|e| !e.is_dir)
            .map(|e| e.name.clone())
            .collect();
        assert_eq!(file_names, vec!["A.WAV".to_string(), "b.wav".to_string()]);

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn build_audio_slot_configs_applies_defaults_and_limits() {
        let mut many: Vec<AudioInstrumentSlotConfig> = Vec::new();
        many.push(AudioInstrumentSlotConfig {
            kind: "sample".to_string(),
            synth: None,
            sample: Some(AudioSampleConfig {
                slots: vec![
                    AudioSampleSlotEntry { path: Some("a.wav".to_string()) },
                    AudioSampleSlotEntry { path: Some("b.wav".to_string()) },
                ],
                tune_semis: Some(7.0),
                amp: Some(AudioAmpConfig {
                    gain_pct: Some(80.0),
                    velocity_sensitivity_pct: Some(50.0),
                }),
            }),
        });
        many.push(AudioInstrumentSlotConfig {
            kind: "synth".to_string(),
            synth: None,
            sample: None,
        });
        for _ in 0..20 {
            many.push(AudioInstrumentSlotConfig {
                kind: "sample".to_string(),
                synth: None,
                sample: None,
            });
        }

        let (slots, cfgs) = build_audio_slot_configs(&many);
        assert_eq!(slots[0], false);
        assert_eq!(slots[1], true);
        assert_eq!(cfgs[0].tune_semis, 7.0);
        assert_eq!(cfgs[0].gain_pct, 80.0);
        assert_eq!(cfgs[0].vel_sens_pct, 50.0);
        assert_eq!(cfgs[0].slots[0], Some("a.wav".to_string()));
        assert_eq!(cfgs[0].slots[1], Some("b.wav".to_string()));
        assert_eq!(slots.len(), 16);
    }
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
            }
        }
    });

    tauri::Builder::default()
        .manage(AppState {
            trigger_tx,
            engine,
            synth_slots: Mutex::new([true; 16]),
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
            sample_preview
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
