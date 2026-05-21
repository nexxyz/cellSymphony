use serde::{Deserialize, Serialize};
use std::f32::consts::PI;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WaveformId {
    Sine,
    Triangle,
    Saw,
    Square,
    Pulse,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum FilterType {
    Lowpass,
    Highpass,
    Bandpass,
    Notch,
}

pub const INSTRUMENT_SLOT_COUNT: usize = 8;
pub const VOICES_PER_SLOT: usize = 8;
pub const BUS_SLOTS_PER_BUS: usize = 2;
pub const DEFAULT_PAN_POSITIONS: usize = 8;

#[derive(Clone, Copy, Debug, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum VoiceStealingMode {
    Off,
    Lenient,
    Balanced,
    Aggressive,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct EnvConfig {
    #[serde(rename = "attackMs")]
    pub attack_ms: f32,
    #[serde(rename = "decayMs")]
    pub decay_ms: f32,
    #[serde(rename = "sustainPct")]
    pub sustain_pct: f32,
    #[serde(rename = "releaseMs")]
    pub release_ms: f32,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct OscConfig {
    pub waveform: WaveformId,
    #[serde(rename = "levelPct")]
    pub level_pct: f32,
    pub octave: i32,
    #[serde(rename = "detuneCents")]
    pub detune_cents: f32,
    #[serde(rename = "pulseWidthPct")]
    pub pulse_width_pct: f32,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct FilterConfig {
    #[serde(rename = "type")]
    pub kind: FilterType,
    #[serde(rename = "cutoffHz")]
    pub cutoff_hz: f32,
    pub resonance: f32,
    #[serde(rename = "envAmountPct")]
    pub env_amount_pct: f32,
    #[serde(rename = "keyTrackingPct")]
    pub key_tracking_pct: f32,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct SynthConfig {
    pub osc1: OscConfig,
    pub osc2: OscConfig,
    pub amp: AmpConfig,
    #[serde(rename = "ampEnv")]
    pub amp_env: EnvConfig,
    pub filter: FilterConfig,
    #[serde(rename = "filterEnv")]
    pub filter_env: EnvConfig,
}

#[derive(Clone, Copy, Debug, Serialize, Deserialize)]
pub struct AmpConfig {
    #[serde(rename = "gainPct")]
    pub gain_pct: f32,
    #[serde(rename = "velocitySensitivityPct")]
    pub velocity_sensitivity_pct: f32,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstrumentSlotConfig {
    #[serde(rename = "type")]
    pub kind: String,
    pub synth: SynthConfig,
    #[serde(default)]
    pub mixer: Option<InstrumentMixerConfig>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstrumentMixerConfig {
    pub route: String,
    #[serde(rename = "panPos")]
    pub pan_pos: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BusSlotConfig {
    #[serde(default = "default_bus_slot_type")]
    pub kind: String,
}

fn default_bus_slot_type() -> String {
    "none".to_string()
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct BusConfig {
    #[serde(default)]
    pub slots: Vec<BusSlotConfig>,
    #[serde(rename = "panPos")]
    pub pan_pos: usize,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MixerConfig {
    #[serde(default)]
    pub buses: Vec<BusConfig>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct InstrumentsConfig {
    pub instruments: Vec<InstrumentSlotConfig>,
    #[serde(default)]
    pub mixer: Option<MixerConfig>,
    #[serde(default = "default_pan_positions", rename = "panPositions")]
    pub pan_positions: usize,
}

fn default_pan_positions() -> usize {
    DEFAULT_PAN_POSITIONS
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum EnvStage {
    Attack,
    Decay,
    Sustain,
    Release,
    Off,
}

#[derive(Clone, Copy, Debug)]
struct EnvState {
    stage: EnvStage,
    level: f32,
    stage_pos: u32,
    stage_len: u32,
    sustain: f32,
    release_start: f32,
}

impl EnvState {
    fn note_on(cfg: EnvConfig, sample_rate: u32) -> Self {
        let a = ms_to_samples(cfg.attack_ms, sample_rate);
        let d = ms_to_samples(cfg.decay_ms, sample_rate);
        let sustain = (cfg.sustain_pct / 100.0).clamp(0.0, 1.0);
        let stage = if a == 0 {
            EnvStage::Decay
        } else {
            EnvStage::Attack
        };
        let stage_len = if stage == EnvStage::Attack { a } else { d };
        Self {
            stage,
            level: if stage == EnvStage::Attack { 0.0 } else { 1.0 },
            stage_pos: 0,
            stage_len,
            sustain,
            release_start: 0.0,
        }
    }

    fn begin_release(&mut self, cfg: EnvConfig, sample_rate: u32) {
        if self.stage == EnvStage::Release || self.stage == EnvStage::Off {
            return;
        }
        self.stage = EnvStage::Release;
        self.stage_pos = 0;
        self.stage_len = ms_to_samples(cfg.release_ms, sample_rate).max(1);
        self.release_start = self.level;
    }

    fn next(&mut self) -> f32 {
        match self.stage {
            EnvStage::Attack => {
                if self.stage_len == 0 {
                    self.stage = EnvStage::Decay;
                    self.stage_pos = 0;
                    self.stage_len = 0;
                    self.level = 1.0;
                    return self.level;
                }
                let t = (self.stage_pos as f32) / (self.stage_len as f32);
                self.level = t.clamp(0.0, 1.0);
                self.stage_pos = self.stage_pos.saturating_add(1);
                if self.stage_pos >= self.stage_len {
                    self.stage = EnvStage::Decay;
                    self.stage_pos = 0;
                    self.stage_len = 0;
                    self.level = 1.0;
                }
                self.level
            }
            EnvStage::Decay => {
                if self.stage_len == 0 {
                    self.stage = EnvStage::Sustain;
                    self.level = self.sustain;
                    return self.level;
                }
                let t = (self.stage_pos as f32) / (self.stage_len as f32);
                self.level = (1.0 + (self.sustain - 1.0) * t).clamp(0.0, 1.0);
                self.stage_pos = self.stage_pos.saturating_add(1);
                if self.stage_pos >= self.stage_len {
                    self.stage = EnvStage::Sustain;
                    self.level = self.sustain;
                }
                self.level
            }
            EnvStage::Sustain => self.level,
            EnvStage::Release => {
                let t = (self.stage_pos as f32) / (self.stage_len as f32);
                self.level = (self.release_start * (1.0 - t)).clamp(0.0, 1.0);
                self.stage_pos = self.stage_pos.saturating_add(1);
                if self.stage_pos >= self.stage_len {
                    self.stage = EnvStage::Off;
                    self.level = 0.0;
                }
                self.level
            }
            EnvStage::Off => 0.0,
        }
    }

    fn is_off(&self) -> bool {
        self.stage == EnvStage::Off
    }

    fn is_releasing(&self) -> bool {
        self.stage == EnvStage::Release
    }
}

#[derive(Clone, Copy, Debug)]
struct BiquadState {
    x1: f32,
    x2: f32,
    y1: f32,
    y2: f32,
}

impl BiquadState {
    fn new() -> Self {
        Self {
            x1: 0.0,
            x2: 0.0,
            y1: 0.0,
            y2: 0.0,
        }
    }

    fn process(
        &mut self,
        x: f32,
        mode: FilterType,
        cutoff_hz: f32,
        q: f32,
        sample_rate: u32,
    ) -> f32 {
        let cutoff = cutoff_hz.clamp(20.0, 20_000.0);
        let qv = q.clamp(0.25, 20.0);
        let w0 = 2.0 * PI * cutoff / (sample_rate as f32);
        let cos_w0 = w0.cos();
        let sin_w0 = w0.sin();
        let alpha = sin_w0 / (2.0 * qv);

        let (b0, b1, b2, a0, a1, a2) = match mode {
            FilterType::Lowpass => (
                (1.0 - cos_w0) * 0.5,
                1.0 - cos_w0,
                (1.0 - cos_w0) * 0.5,
                1.0 + alpha,
                -2.0 * cos_w0,
                1.0 - alpha,
            ),
            FilterType::Highpass => (
                (1.0 + cos_w0) * 0.5,
                -(1.0 + cos_w0),
                (1.0 + cos_w0) * 0.5,
                1.0 + alpha,
                -2.0 * cos_w0,
                1.0 - alpha,
            ),
            FilterType::Bandpass => (alpha, 0.0, -alpha, 1.0 + alpha, -2.0 * cos_w0, 1.0 - alpha),
            FilterType::Notch => (
                1.0,
                -2.0 * cos_w0,
                1.0,
                1.0 + alpha,
                -2.0 * cos_w0,
                1.0 - alpha,
            ),
        };

        let nb0 = b0 / a0;
        let nb1 = b1 / a0;
        let nb2 = b2 / a0;
        let na1 = a1 / a0;
        let na2 = a2 / a0;
        let y = nb0 * x + nb1 * self.x1 + nb2 * self.x2 - na1 * self.y1 - na2 * self.y2;
        self.x2 = self.x1;
        self.x1 = x;
        self.y2 = self.y1;
        self.y1 = y;
        y
    }
}

#[derive(Clone, Copy, Debug)]
struct Voice {
    active: bool,
    instrument_slot: u8,
    midi_note: u8,
    velocity: u8,
    note_off_sample: u64,
    started_sample: u64,
    freq_hz: f32,
    phase1: f32,
    phase2: f32,
    amp_env: EnvState,
    filt_env: EnvState,
    filt: BiquadState,
}

impl Voice {
    fn off() -> Self {
        Self {
            active: false,
            instrument_slot: 0,
            midi_note: 0,
            velocity: 0,
            note_off_sample: 0,
            started_sample: 0,
            freq_hz: 440.0,
            phase1: 0.0,
            phase2: 0.0,
            amp_env: EnvState {
                stage: EnvStage::Off,
                level: 0.0,
                stage_pos: 0,
                stage_len: 0,
                sustain: 0.0,
                release_start: 0.0,
            },
            filt_env: EnvState {
                stage: EnvStage::Off,
                level: 0.0,
                stage_pos: 0,
                stage_len: 0,
                sustain: 0.0,
                release_start: 0.0,
            },
            filt: BiquadState::new(),
        }
    }
}

#[derive(Clone, Copy, Debug)]
struct InstrumentMod {
    cutoff_cc: f32,
    resonance_cc: f32,
}

impl InstrumentMod {
    fn new() -> Self {
        Self {
            cutoff_cc: 0.0,
            resonance_cc: 0.0,
        }
    }
}

pub struct SynthEngine {
    sample_rate: u32,
    sample_clock: u64,
    instruments: [SynthConfig; INSTRUMENT_SLOT_COUNT],
    mods: [InstrumentMod; INSTRUMENT_SLOT_COUNT],
    voices: [[Voice; VOICES_PER_SLOT]; INSTRUMENT_SLOT_COUNT],
    slot_route: [usize; INSTRUMENT_SLOT_COUNT],
    slot_pan_pos: [usize; INSTRUMENT_SLOT_COUNT],
    bus_pan_pos: Vec<usize>,
    bus_slot_kinds: Vec<[u8; BUS_SLOTS_PER_BUS]>,
    pan_positions: usize,
    voice_stealing_mode: VoiceStealingMode,
    smoothed_load_ratio: f32,
}

impl SynthEngine {
    pub fn new(sample_rate: u32) -> Self {
        let default = default_synth_config();
        Self {
            sample_rate,
            sample_clock: 0,
            instruments: [default; INSTRUMENT_SLOT_COUNT],
            mods: [InstrumentMod::new(); INSTRUMENT_SLOT_COUNT],
            voices: [[Voice::off(); VOICES_PER_SLOT]; INSTRUMENT_SLOT_COUNT],
            slot_route: [0; INSTRUMENT_SLOT_COUNT],
            slot_pan_pos: [DEFAULT_PAN_POSITIONS / 2; INSTRUMENT_SLOT_COUNT],
            bus_pan_pos: Vec::new(),
            bus_slot_kinds: Vec::new(),
            pan_positions: DEFAULT_PAN_POSITIONS,
            voice_stealing_mode: VoiceStealingMode::Balanced,
            smoothed_load_ratio: 0.0,
        }
    }

    pub fn set_voice_stealing_mode(&mut self, mode: VoiceStealingMode) {
        self.voice_stealing_mode = mode;
    }

    pub fn set_runtime_load_ratio(&mut self, ratio: f32) {
        let r = ratio.clamp(0.0, 2.0);
        self.smoothed_load_ratio = 0.9 * self.smoothed_load_ratio + 0.1 * r;
    }

    pub fn set_instruments(&mut self, cfg: InstrumentsConfig) {
        self.pan_positions = cfg.pan_positions.max(1);
        for (idx, slot) in cfg.instruments.into_iter().enumerate() {
            if idx >= INSTRUMENT_SLOT_COUNT {
                break;
            }
            if slot.kind != "synth" {
                if let Some(m) = slot.mixer {
                    self.slot_route[idx] = parse_route(&m.route);
                    self.slot_pan_pos[idx] = m.pan_pos.min(self.pan_positions - 1);
                }
                continue;
            }
            self.instruments[idx] = slot.synth;
            if let Some(m) = slot.mixer {
                self.slot_route[idx] = parse_route(&m.route);
                self.slot_pan_pos[idx] = m.pan_pos.min(self.pan_positions - 1);
            }
        }
        self.bus_pan_pos.clear();
        self.bus_slot_kinds.clear();
        if let Some(mixer) = cfg.mixer {
            for bus in mixer.buses.into_iter() {
                self.bus_pan_pos
                    .push(bus.pan_pos.min(self.pan_positions - 1));
                let mut kinds = [0_u8; BUS_SLOTS_PER_BUS];
                for (j, slot) in bus.slots.into_iter().enumerate().take(BUS_SLOTS_PER_BUS) {
                    kinds[j] = if slot.kind == "none" { 0 } else { 0 };
                }
                self.bus_slot_kinds.push(kinds);
            }
        }
    }

    pub fn note_on(&mut self, instrument_slot: u8, midi_note: u8, velocity: u8, duration_ms: u32) {
        let slot = (instrument_slot as usize).min(INSTRUMENT_SLOT_COUNT - 1);
        let v = velocity.max(1);
        let duration_samples = ms_to_samples(duration_ms as f32, self.sample_rate).max(1) as u64;
        let note_off_sample = self.sample_clock.saturating_add(duration_samples);
        let freq = midi_note_to_hz(midi_note);

        let pool = &mut self.voices[slot];
        let mut voice_index: Option<usize> = None;
        for (i, voice) in pool.iter().enumerate() {
            if !voice.active {
                voice_index = Some(i);
                break;
            }
        }
        let i = voice_index.unwrap_or_else(|| Self::steal_voice_index(pool));

        let cfg = self.instruments[slot];
        let amp_env = EnvState::note_on(cfg.amp_env, self.sample_rate);
        let filt_env = EnvState::note_on(cfg.filter_env, self.sample_rate);
        pool[i] = Voice {
            active: true,
            instrument_slot: slot as u8,
            midi_note,
            velocity: v,
            note_off_sample,
            started_sample: self.sample_clock,
            freq_hz: freq,
            phase1: 0.0,
            phase2: 0.0,
            amp_env,
            filt_env,
            filt: BiquadState::new(),
        };

        self.enforce_global_voice_budget();
    }

    pub fn cc(&mut self, instrument_slot: u8, controller: u8, value: u8) {
        let slot = (instrument_slot as usize).min(INSTRUMENT_SLOT_COUNT - 1);
        if controller == 74 {
            self.mods[slot].cutoff_cc = (value as f32 / 127.0).clamp(0.0, 1.0);
        } else if controller == 71 {
            self.mods[slot].resonance_cc = (value as f32 / 127.0).clamp(0.0, 1.0);
        } else if controller == 120 || controller == 123 {
            self.mods[slot] = InstrumentMod::new();
        }
    }

    pub fn note_off(&mut self, instrument_slot: u8, midi_note: u8) {
        let slot = (instrument_slot as usize).min(INSTRUMENT_SLOT_COUNT - 1);
        let cfg = self.instruments[slot];
        for voice in self.voices[slot].iter_mut() {
            if !voice.active {
                continue;
            }
            if voice.midi_note != midi_note {
                continue;
            }
            voice.amp_env.begin_release(cfg.amp_env, self.sample_rate);
            voice
                .filt_env
                .begin_release(cfg.filter_env, self.sample_rate);
            voice.note_off_sample = self.sample_clock;
        }
    }

    pub fn all_notes_off(&mut self) {
        for slot in 0..INSTRUMENT_SLOT_COUNT {
            let cfg = self.instruments[slot];
            for voice in self.voices[slot].iter_mut() {
                if !voice.active {
                    continue;
                }
                voice.amp_env.begin_release(cfg.amp_env, self.sample_rate);
                voice
                    .filt_env
                    .begin_release(cfg.filter_env, self.sample_rate);
                voice.note_off_sample = self.sample_clock;
            }
        }
    }

    pub fn next_sample(&mut self) -> f32 {
        let (l, r) = self.next_stereo_sample();
        (l + r) * 0.5
    }

    pub fn next_stereo_sample(&mut self) -> (f32, f32) {
        let mut slot_out = [0.0_f32; INSTRUMENT_SLOT_COUNT];
        for pool in self.voices.iter_mut() {
            for v in pool.iter_mut() {
                if !v.active {
                    continue;
                }
                let slot = (v.instrument_slot as usize).min(INSTRUMENT_SLOT_COUNT - 1);
                let cfg = self.instruments[slot];

                if self.sample_clock >= v.note_off_sample {
                    v.amp_env.begin_release(cfg.amp_env, self.sample_rate);
                    v.filt_env.begin_release(cfg.filter_env, self.sample_rate);
                }

                let amp_env = v.amp_env.next();
                let filt_env = v.filt_env.next();
                if v.amp_env.is_off() {
                    v.active = false;
                    continue;
                }

                let vel = (v.velocity as f32 / 127.0).clamp(0.0, 1.0);
                let vel_sens = (cfg.amp.velocity_sensitivity_pct / 100.0).clamp(0.0, 1.0);
                let vel_gain = (1.0 - vel_sens) + vel_sens * vel;
                let gain = (cfg.amp.gain_pct / 100.0).clamp(0.0, 1.0);

                let osc1 = osc_sample(cfg.osc1, v.freq_hz, &mut v.phase1, self.sample_rate);
                let osc2 = osc_sample(cfg.osc2, v.freq_hz, &mut v.phase2, self.sample_rate);
                let dry = (osc1 + osc2) * 0.5;

                let cutoff_base = cfg.filter.cutoff_hz;
                let env_amt = (cfg.filter.env_amount_pct / 100.0).clamp(-1.0, 1.0);
                let cutoff_env = cutoff_base * (1.0 + env_amt * filt_env).max(0.0);
                let cutoff_cc = self.mods[slot].cutoff_cc;
                let cutoff = if cutoff_cc > 0.0 {
                    120.0 + cutoff_cc * 15_880.0
                } else {
                    cutoff_env
                };
                let res_mod = self.mods[slot].resonance_cc;
                let resonance = if res_mod > 0.0 {
                    res_mod * 100.0
                } else {
                    cfg.filter.resonance
                };
                let q = 0.5 + (resonance.clamp(0.0, 100.0) / 100.0) * 11.5;
                let filtered = v
                    .filt
                    .process(dry, cfg.filter.kind, cutoff, q, self.sample_rate);

                let sample = filtered * amp_env * vel_gain * gain * 0.35;
                slot_out[slot] += sample;
            }
        }

        let mut bus_mono = vec![0.0_f32; self.bus_pan_pos.len()];
        let mut left = 0.0_f32;
        let mut right = 0.0_f32;
        for (slot, sample) in slot_out.iter().enumerate() {
            let route = self.slot_route[slot] as usize;
            if route == 0 {
                let (gl, gr) = pan_gains(self.slot_pan_pos[slot], self.pan_positions);
                left += *sample * gl;
                right += *sample * gr;
            } else {
                let bus = route - 1;
                if bus < bus_mono.len() {
                    bus_mono[bus] += *sample;
                } else {
                    let (gl, gr) = pan_gains(self.slot_pan_pos[slot], self.pan_positions);
                    left += *sample * gl;
                    right += *sample * gr;
                }
            }
        }
        for (bus_idx, bus_sample) in bus_mono.iter().enumerate() {
            let processed = *bus_sample;
            let pan = self.bus_pan_pos.get(bus_idx).copied().unwrap_or(0);
            let (gl, gr) = pan_gains(pan, self.pan_positions);
            left += processed * gl;
            right += processed * gr;
        }

        self.sample_clock = self.sample_clock.saturating_add(1);
        (left.clamp(-1.0, 1.0), right.clamp(-1.0, 1.0))
    }

    fn steal_voice_index(pool: &[Voice; VOICES_PER_SLOT]) -> usize {
        let mut best_i = 0;
        let mut best_score = f32::MAX;
        for (i, v) in pool.iter().enumerate() {
            if !v.active {
                return i;
            }
            let score = v.amp_env.level;
            if score < best_score {
                best_score = score;
                best_i = i;
            }
        }
        best_i
    }

    fn active_voice_total(&self) -> usize {
        self.voices
            .iter()
            .map(|pool| pool.iter().filter(|v| v.active).count())
            .sum()
    }

    fn global_voice_budget(&self) -> usize {
        let max_voices = INSTRUMENT_SLOT_COUNT * VOICES_PER_SLOT;
        let (target_load, min_budget_pct) = match self.voice_stealing_mode {
            VoiceStealingMode::Off => return max_voices,
            VoiceStealingMode::Lenient => (0.88_f32, 0.75_f32),
            VoiceStealingMode::Balanced => (0.78_f32, 0.60_f32),
            VoiceStealingMode::Aggressive => (0.68_f32, 0.45_f32),
        };
        if self.smoothed_load_ratio <= target_load {
            return max_voices;
        }
        let severity =
            ((self.smoothed_load_ratio - target_load) / (1.20_f32 - target_load)).clamp(0.0, 1.0);
        let min_budget = ((max_voices as f32) * min_budget_pct).round() as usize;
        let budget =
            (max_voices as f32 - severity * ((max_voices - min_budget) as f32)).round() as usize;
        budget.clamp(min_budget.max(1), max_voices)
    }

    fn enforce_global_voice_budget(&mut self) {
        if self.voice_stealing_mode == VoiceStealingMode::Off {
            return;
        }
        let budget = self.global_voice_budget();
        while self.active_voice_total() > budget {
            let Some((slot, idx)) = self.find_global_steal_candidate() else {
                break;
            };
            self.voices[slot][idx].active = false;
        }
    }

    fn find_global_steal_candidate(&self) -> Option<(usize, usize)> {
        let mut best: Option<(usize, usize, f32)> = None;
        for (slot_idx, pool) in self.voices.iter().enumerate() {
            for (voice_idx, voice) in pool.iter().enumerate() {
                if !voice.active {
                    continue;
                }
                let age_samples = self.sample_clock.saturating_sub(voice.started_sample);
                let age_ms = (age_samples as f32) * 1000.0 / (self.sample_rate as f32);
                let mut score = voice.amp_env.level;
                if voice.amp_env.is_releasing() {
                    score -= 0.5;
                }
                score += (voice.velocity as f32 / 127.0) * 0.2;
                if age_ms < 30.0 {
                    score += 1.0;
                }
                match best {
                    Some((_, _, best_score)) if score >= best_score => {}
                    _ => best = Some((slot_idx, voice_idx, score)),
                }
            }
        }
        best.map(|(s, i, _)| (s, i))
    }

    #[cfg(test)]
    fn active_voice_count_for_slot(&self, slot: usize) -> usize {
        self.voices[slot].iter().filter(|v| v.active).count()
    }

    #[cfg(test)]
    fn mod_values_for_slot(&self, slot: usize) -> (f32, f32) {
        let s = slot.min(INSTRUMENT_SLOT_COUNT - 1);
        (self.mods[s].cutoff_cc, self.mods[s].resonance_cc)
    }
}

fn parse_route(route: &str) -> usize {
    if route == "direct" {
        return 0;
    }
    if let Some(rest) = route.strip_prefix("bus_") {
        if let Ok(n) = rest.parse::<usize>() {
            if n >= 1 {
                return n;
            }
        }
    }
    0
}

fn pan_gains(pan_pos: usize, positions: usize) -> (f32, f32) {
    if positions <= 1 {
        return (0.70710677, 0.70710677);
    }
    let t = (pan_pos.min(positions - 1) as f32) / ((positions - 1) as f32);
    let theta = t * (std::f32::consts::FRAC_PI_2);
    (theta.cos(), theta.sin())
}

fn ms_to_samples(ms: f32, sample_rate: u32) -> u32 {
    if ms <= 0.0 {
        return 0;
    }
    ((ms / 1000.0) * (sample_rate as f32)).round().max(0.0) as u32
}

fn midi_note_to_hz(note: u8) -> f32 {
    440.0 * 2.0_f32.powf((note as f32 - 69.0) / 12.0)
}

fn osc_sample(cfg: OscConfig, base_freq: f32, phase: &mut f32, sample_rate: u32) -> f32 {
    let octave_mul = 2.0_f32.powi(cfg.octave.clamp(-2, 2));
    let detune_mul = 2.0_f32.powf(cfg.detune_cents.clamp(-1200.0, 1200.0) / 1200.0);
    let freq = base_freq * octave_mul * detune_mul;
    let inc = (freq / (sample_rate as f32)).clamp(0.0, 0.5);
    *phase = (*phase + inc).fract();

    let raw = match cfg.waveform {
        WaveformId::Sine => (2.0 * PI * *phase).sin(),
        WaveformId::Triangle => 4.0 * (*phase - 0.5).abs() - 1.0,
        WaveformId::Saw => 2.0 * *phase - 1.0,
        WaveformId::Square => {
            if *phase < 0.5 {
                1.0
            } else {
                -1.0
            }
        }
        WaveformId::Pulse => {
            let duty = (cfg.pulse_width_pct / 100.0).clamp(0.05, 0.95);
            if *phase < duty {
                1.0
            } else {
                -1.0
            }
        }
    };

    let level = (cfg.level_pct / 100.0).clamp(0.0, 1.0);
    raw * level
}

pub fn default_synth_config() -> SynthConfig {
    SynthConfig {
        osc1: OscConfig {
            waveform: WaveformId::Saw,
            level_pct: 80.0,
            octave: 0,
            detune_cents: 0.0,
            pulse_width_pct: 50.0,
        },
        osc2: OscConfig {
            waveform: WaveformId::Square,
            level_pct: 80.0,
            octave: 0,
            detune_cents: 0.0,
            pulse_width_pct: 50.0,
        },
        amp: AmpConfig {
            gain_pct: 80.0,
            velocity_sensitivity_pct: 100.0,
        },
        amp_env: EnvConfig {
            attack_ms: 5.0,
            decay_ms: 120.0,
            sustain_pct: 70.0,
            release_ms: 180.0,
        },
        filter: FilterConfig {
            kind: FilterType::Lowpass,
            cutoff_hz: 8000.0,
            resonance: 20.0,
            env_amount_pct: 0.0,
            key_tracking_pct: 0.0,
        },
        filter_env: EnvConfig {
            attack_ms: 5.0,
            decay_ms: 120.0,
            sustain_pct: 70.0,
            release_ms: 180.0,
        },
    }
}

#[cfg(test)]
mod tests {
    use super::{
        default_synth_config, FilterType, InstrumentSlotConfig, InstrumentsConfig, SynthEngine,
        DEFAULT_PAN_POSITIONS, INSTRUMENT_SLOT_COUNT,
    };

    #[test]
    fn generates_samples() {
        let mut engine = SynthEngine::new(48_000);
        engine.note_on(0, 60, 100, 120);
        let mut any = false;
        for _ in 0..1024 {
            let s = engine.next_sample();
            if s != 0.0 {
                any = true;
                break;
            }
        }
        assert!(any);
    }

    #[test]
    fn applies_instrument_config() {
        let mut engine = SynthEngine::new(48_000);
        let cfg = default_synth_config();
        engine.set_instruments(InstrumentsConfig {
            instruments: vec![InstrumentSlotConfig {
                kind: "synth".to_string(),
                synth: cfg,
                mixer: None,
            }],
            mixer: None,
            pan_positions: DEFAULT_PAN_POSITIONS,
        });
        engine.note_on(0, 60, 100, 120);
        let s = engine.next_sample();
        assert!(s.is_finite());
    }

    #[test]
    fn all_filter_types_generate_finite_non_silent_audio() {
        let modes = [
            FilterType::Lowpass,
            FilterType::Highpass,
            FilterType::Bandpass,
            FilterType::Notch,
        ];

        for mode in modes {
            let mut engine = SynthEngine::new(48_000);
            let mut cfg = default_synth_config();
            cfg.filter.kind = mode;
            cfg.filter.cutoff_hz = 2_000.0;
            cfg.filter.resonance = 45.0;

            engine.set_instruments(InstrumentsConfig {
                instruments: vec![InstrumentSlotConfig {
                    kind: "synth".to_string(),
                    synth: cfg,
                    mixer: None,
                }],
                mixer: None,
                pan_positions: DEFAULT_PAN_POSITIONS,
            });

            engine.note_on(0, 64, 110, 220);
            let mut had_nonzero = false;
            for _ in 0..4096 {
                let s = engine.next_sample();
                assert!(s.is_finite(), "sample must be finite for mode {mode:?}");
                if s.abs() > 1.0e-6 {
                    had_nonzero = true;
                }
            }

            assert!(
                had_nonzero,
                "expected non-silent output for filter mode {mode:?}"
            );
        }
    }

    #[test]
    fn maintains_eight_voices_per_instrument_slot() {
        let mut engine = SynthEngine::new(48_000);
        for i in 0..8 {
            engine.note_on(0, 60 + i, 100, 2_000);
            engine.note_on(1, 72 + i, 100, 2_000);
        }

        assert_eq!(engine.active_voice_count_for_slot(0), 8);
        assert_eq!(engine.active_voice_count_for_slot(1), 8);
    }

    #[test]
    fn voice_steal_is_scoped_to_instrument_slot() {
        let mut engine = SynthEngine::new(48_000);
        for i in 0..8 {
            engine.note_on(0, 60 + i, 100, 2_000);
            engine.note_on(1, 72 + i, 100, 2_000);
        }
        engine.note_on(0, 90, 100, 2_000);

        assert_eq!(engine.active_voice_count_for_slot(0), 8);
        assert_eq!(engine.active_voice_count_for_slot(1), 8);
    }

    #[test]
    fn note_off_releases_matching_slot_note() {
        let mut engine = SynthEngine::new(48_000);
        engine.note_on(0, 60, 100, 50_000);
        for _ in 0..64 {
            let _ = engine.next_sample();
        }
        engine.note_off(0, 60);
        for _ in 0..20_000 {
            let _ = engine.next_sample();
        }
        assert_eq!(engine.active_voice_count_for_slot(0), 0);
    }

    #[test]
    fn all_notes_off_releases_all_slots() {
        let mut engine = SynthEngine::new(48_000);
        for i in 0..4 {
            engine.note_on(0, 60 + i, 100, 50_000);
            engine.note_on(1, 72 + i, 100, 50_000);
        }
        engine.all_notes_off();
        for _ in 0..20_000 {
            let _ = engine.next_sample();
        }
        assert_eq!(engine.active_voice_count_for_slot(0), 0);
        assert_eq!(engine.active_voice_count_for_slot(1), 0);
    }

    #[test]
    fn cc_updates_mod_slots_and_reset_cc_clears_them() {
        let mut engine = SynthEngine::new(48_000);
        engine.cc(0, 74, 127);
        engine.cc(0, 71, 64);
        let (cutoff, resonance) = engine.mod_values_for_slot(0);
        assert!(cutoff > 0.99);
        assert!(resonance > 0.49 && resonance < 0.51);

        engine.cc(0, 123, 0);
        let (cutoff_after, resonance_after) = engine.mod_values_for_slot(0);
        assert_eq!(cutoff_after, 0.0);
        assert_eq!(resonance_after, 0.0);
    }

    #[test]
    fn note_on_clamps_slot_and_velocity() {
        let mut engine = SynthEngine::new(48_000);
        engine.note_on(200, 60, 0, 1_000);
        assert_eq!(
            engine.active_voice_count_for_slot(INSTRUMENT_SLOT_COUNT - 1),
            1
        );
        for _ in 0..100 {
            let s = engine.next_sample();
            assert!(s.is_finite());
        }
    }

    #[test]
    fn zero_duration_note_releases_after_minimum_samples() {
        let mut engine = SynthEngine::new(48_000);
        engine.note_on(0, 60, 100, 0);
        for _ in 0..20_000 {
            let _ = engine.next_sample();
        }
        assert_eq!(engine.active_voice_count_for_slot(0), 0);
    }

    #[test]
    fn long_running_event_stream_stays_finite() {
        let mut engine = SynthEngine::new(48_000);
        for i in 0..200 {
            let slot = (i % INSTRUMENT_SLOT_COUNT) as u8;
            let note = 36 + (i % 48) as u8;
            let vel = 1 + (i % 127) as u8;
            engine.note_on(slot, note, vel, 50 + (i % 200) as u32);
            engine.cc(slot, 74, (i % 128) as u8);
            engine.cc(slot, 71, ((i * 3) % 128) as u8);
            if i % 11 == 0 {
                engine.cc(slot, 120, 0);
            }
            for _ in 0..128 {
                let s = engine.next_sample();
                assert!(s.is_finite());
                assert!((-1.0..=1.0).contains(&s));
            }
        }
    }
}
