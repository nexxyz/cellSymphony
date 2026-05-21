use super::fx::{bus_fx_state_from_cfg, process_bus_slot, BusFxState};
use super::types::*;
use std::f32::consts::PI;

pub struct SynthEngine {
    sample_rate: u32,
    sample_clock: u64,
    instruments: [SynthConfig; INSTRUMENT_SLOT_COUNT],
    mods: [InstrumentMod; INSTRUMENT_SLOT_COUNT],
    voices: [[Voice; VOICES_PER_SLOT]; INSTRUMENT_SLOT_COUNT],
    slot_route: [usize; INSTRUMENT_SLOT_COUNT],
    slot_pan_pos: [usize; INSTRUMENT_SLOT_COUNT],
    bus_pan_pos: Vec<usize>,
    bus_mono_scratch: Vec<f32>,
    bus_slot_cfgs: Vec<[BusSlotConfig; BUS_SLOTS_PER_BUS]>,
    bus_slot_state: Vec<[BusFxState; BUS_SLOTS_PER_BUS]>,
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
            bus_mono_scratch: Vec::new(),
            bus_slot_cfgs: Vec::new(),
            bus_slot_state: Vec::new(),
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
        self.bus_mono_scratch.clear();
        self.bus_slot_cfgs.clear();
        self.bus_slot_state.clear();
        if let Some(mixer) = cfg.mixer {
            for bus in mixer.buses.into_iter() {
                self.bus_pan_pos
                    .push(bus.pan_pos.min(self.pan_positions - 1));
                let mut cfgs: [BusSlotConfig; BUS_SLOTS_PER_BUS] =
                    std::array::from_fn(|_| BusSlotConfig::Kind("none".to_string()));
                for (j, slot) in bus.slots.into_iter().enumerate().take(BUS_SLOTS_PER_BUS) {
                    cfgs[j] = slot;
                }
                let states: [BusFxState; BUS_SLOTS_PER_BUS] =
                    std::array::from_fn(|j| bus_fx_state_from_cfg(&cfgs[j], self.sample_rate));
                self.bus_slot_cfgs.push(cfgs);
                self.bus_slot_state.push(states);
            }
        }
        self.bus_mono_scratch.resize(self.bus_pan_pos.len(), 0.0);
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

        if self.bus_mono_scratch.len() != self.bus_pan_pos.len() {
            self.bus_mono_scratch.resize(self.bus_pan_pos.len(), 0.0);
        } else {
            self.bus_mono_scratch.fill(0.0);
        }
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
                if bus < self.bus_mono_scratch.len() {
                    self.bus_mono_scratch[bus] += *sample;
                } else {
                    let (gl, gr) = pan_gains(self.slot_pan_pos[slot], self.pan_positions);
                    left += *sample * gl;
                    right += *sample * gr;
                }
            }
        }
        let bus_mono = &self.bus_mono_scratch;
        for (bus_idx, bus_sample) in bus_mono.iter().enumerate() {
            let mut processed = *bus_sample;
            let mut pan_override: Option<f32> = None;
            if let (Some(cfgs), Some(states)) = (
                self.bus_slot_cfgs.get(bus_idx),
                self.bus_slot_state.get_mut(bus_idx),
            ) {
                for j in 0..BUS_SLOTS_PER_BUS {
                    processed = process_bus_slot(
                        &cfgs[j],
                        &mut states[j],
                        processed,
                        bus_idx,
                        &slot_out,
                        &bus_mono,
                        self.sample_rate,
                        self.sample_clock,
                    );
                    if let BusFxState::AutoPan { pos, .. } = states[j] {
                        pan_override = Some(pos.clamp(0.0, 1.0));
                    }
                }
            }
            let (gl, gr) = if let Some(pos) = pan_override {
                pan_gains_float(pos)
            } else {
                let pan = self.bus_pan_pos.get(bus_idx).copied().unwrap_or(0);
                pan_gains(pan, self.pan_positions)
            };
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
    pub(super) fn active_voice_count_for_slot(&self, slot: usize) -> usize {
        self.voices[slot].iter().filter(|v| v.active).count()
    }

    #[cfg(test)]
    pub(super) fn mod_values_for_slot(&self, slot: usize) -> (f32, f32) {
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

fn pan_gains_float(pos: f32) -> (f32, f32) {
    let theta = pos.clamp(0.0, 1.0) * std::f32::consts::FRAC_PI_2;
    (theta.cos(), theta.sin())
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
