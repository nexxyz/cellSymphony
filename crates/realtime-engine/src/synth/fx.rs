use super::types::*;
use std::f32::consts::PI;

#[derive(Clone, Debug)]
pub(super) enum BusFxState {
    None,
    Tremolo {
        phase: f32,
    },
    Delay {
        buf: Vec<f32>,
        idx: usize,
    },
    ModDelay {
        buf: Vec<f32>,
        idx: usize,
        phase: f32,
    },
    FilterLfo {
        filt: BiquadState,
        phase: f32,
    },
    Duck {
        env: f32,
    },
    Bitcrusher {
        hold: u32,
        count: u32,
        last: f32,
    },
    Reverb {
        bufs: [Vec<f32>; 4],
        idxs: [usize; 4],
        lp: [f32; 4],
    },
    Glitch {
        buf: Vec<f32>,
        idx: usize,
        read: usize,
        remain: usize,
        rng: u32,
    },
    AutoPan {
        phase: f32,
        pos: f32,
    },
}

pub(super) fn bus_fx_state_from_cfg(cfg: &BusSlotConfig, sample_rate: u32) -> BusFxState {
    match cfg.kind_str() {
        "delay" => {
            // Default 250ms delay line.
            let len = ((sample_rate as f32) * 0.25) as usize;
            BusFxState::Delay {
                buf: vec![0.0; len.max(1)],
                idx: 0,
            }
        }
        "tremolo" => BusFxState::Tremolo { phase: 0.0 },
        "vibrato" | "chorus" | "flanger" => BusFxState::ModDelay {
            buf: vec![0.0; ((sample_rate as f32) * 0.08) as usize],
            idx: 0,
            phase: 0.0,
        },
        "filter_lfo" | "wah" => BusFxState::FilterLfo {
            filt: BiquadState::new(),
            phase: 0.0,
        },
        "duck" => BusFxState::Duck { env: 0.0 },
        "bitcrusher" => BusFxState::Bitcrusher {
            hold: 1,
            count: 0,
            last: 0.0,
        },
        "reverb" => BusFxState::Reverb {
            bufs: [1557, 1617, 1491, 1422]
                .map(|n| vec![0.0; (n * sample_rate as usize / 44_100).max(1)]),
            idxs: [0; 4],
            lp: [0.0; 4],
        },
        "glitch" => BusFxState::Glitch {
            buf: vec![0.0; ((sample_rate as f32) * 0.25) as usize],
            idx: 0,
            read: 0,
            remain: 0,
            rng: 0x1234_abcd,
        },
        "auto_pan" => BusFxState::AutoPan {
            phase: 0.0,
            pos: 0.5,
        },
        _ => BusFxState::None,
    }
}

fn get_param_f32(
    params: Option<&std::collections::BTreeMap<String, serde_json::Value>>,
    key: &str,
    fallback: f32,
) -> f32 {
    let Some(p) = params else {
        return fallback;
    };
    let Some(v) = p.get(key) else {
        return fallback;
    };
    v.as_f64().map(|x| x as f32).unwrap_or(fallback)
}

fn get_param_str<'a>(
    params: Option<&'a std::collections::BTreeMap<String, serde_json::Value>>,
    key: &str,
    fallback: &'a str,
) -> String {
    let Some(p) = params else {
        return fallback.to_string();
    };
    let Some(v) = p.get(key) else {
        return fallback.to_string();
    };
    v.as_str().unwrap_or(fallback).to_string()
}

pub(super) fn process_bus_slot(
    cfg: &BusSlotConfig,
    state: &mut BusFxState,
    input: f32,
    bus_idx: usize,
    slot_out: &[f32; INSTRUMENT_SLOT_COUNT],
    bus_in: &[f32],
    sample_rate: u32,
    sample_clock: u64,
) -> f32 {
    let kind = cfg.kind_str();
    match kind {
        "none" => input,
        "tremolo" => {
            let rate_hz = get_param_f32(cfg.params(), "rateHz", 4.0).clamp(0.05, 40.0);
            let depth = (get_param_f32(cfg.params(), "depthPct", 60.0) / 100.0).clamp(0.0, 1.0);
            let BusFxState::Tremolo { phase } = state else {
                *state = BusFxState::Tremolo { phase: 0.0 };
                return input;
            };
            let gain = (1.0 - depth) + depth * ((phase.sin() + 1.0) * 0.5);
            *phase += 2.0 * PI * rate_hz / (sample_rate as f32);
            if *phase > 2.0 * PI {
                *phase -= 2.0 * PI;
            }
            input * gain
        }
        "delay" => {
            let time_ms = get_param_f32(cfg.params(), "timeMs", 250.0).clamp(1.0, 2000.0);
            let feedback = get_param_f32(cfg.params(), "feedback", 0.35).clamp(0.0, 0.98);
            let mix = (get_param_f32(cfg.params(), "mixPct", 35.0) / 100.0).clamp(0.0, 1.0);
            let desired_len = ((time_ms / 1000.0) * (sample_rate as f32)).round() as usize;
            let BusFxState::Delay { buf, idx } = state else {
                *state = BusFxState::Delay {
                    buf: vec![0.0; desired_len.max(1)],
                    idx: 0,
                };
                return input;
            };
            if buf.len() != desired_len.max(1) {
                *buf = vec![0.0; desired_len.max(1)];
                *idx = 0;
            }
            let delayed = buf[*idx];
            buf[*idx] = input + delayed * feedback;
            *idx += 1;
            if *idx >= buf.len() {
                *idx = 0;
            }
            (input * (1.0 - mix) + delayed * mix).clamp(-1.5, 1.5)
        }
        "vibrato" | "chorus" | "flanger" => {
            let default_depth = if kind == "flanger" {
                2.0
            } else if kind == "vibrato" {
                6.0
            } else {
                14.0
            };
            let default_base = if kind == "flanger" {
                3.0
            } else if kind == "vibrato" {
                8.0
            } else {
                22.0
            };
            let rate_hz = get_param_f32(cfg.params(), "rateHz", 0.8).clamp(0.02, 20.0);
            let depth_ms = get_param_f32(cfg.params(), "depthMs", default_depth).clamp(0.0, 40.0);
            let base_ms = get_param_f32(cfg.params(), "baseMs", default_base).clamp(0.1, 80.0);
            let feedback = get_param_f32(
                cfg.params(),
                "feedback",
                if kind == "flanger" { 0.35 } else { 0.0 },
            )
            .clamp(-0.95, 0.95);
            let mix = (get_param_f32(
                cfg.params(),
                "mixPct",
                if kind == "vibrato" { 100.0 } else { 45.0 },
            ) / 100.0)
                .clamp(0.0, 1.0);
            let BusFxState::ModDelay { buf, idx, phase } = state else {
                *state = BusFxState::ModDelay {
                    buf: vec![0.0; ((sample_rate as f32) * 0.08) as usize],
                    idx: 0,
                    phase: 0.0,
                };
                return input;
            };
            let need = (((base_ms + depth_ms + 5.0) / 1000.0) * sample_rate as f32).ceil() as usize;
            if buf.len() != need.max(2) {
                *buf = vec![0.0; need.max(2)];
                *idx = 0;
            }
            let delay_ms = (base_ms + depth_ms * ((*phase).sin() + 1.0) * 0.5).clamp(0.1, 100.0);
            let delayed = read_delay(buf, *idx, delay_ms * sample_rate as f32 / 1000.0);
            buf[*idx] = (input + delayed * feedback).clamp(-2.0, 2.0);
            *idx = (*idx + 1) % buf.len();
            *phase = wrap_phase(*phase + 2.0 * PI * rate_hz / sample_rate as f32);
            (input * (1.0 - mix) + delayed * mix).clamp(-1.5, 1.5)
        }
        "filter_lfo" | "wah" => {
            let rate_hz = get_param_f32(
                cfg.params(),
                "rateHz",
                if kind == "wah" { 1.2 } else { 0.5 },
            )
            .clamp(0.02, 20.0);
            let depth = (get_param_f32(cfg.params(), "depthPct", 70.0) / 100.0).clamp(0.0, 1.0);
            let center = get_param_f32(
                cfg.params(),
                "centerHz",
                if kind == "wah" { 900.0 } else { 1600.0 },
            )
            .clamp(40.0, 12_000.0);
            let q = get_param_f32(cfg.params(), "q", if kind == "wah" { 6.0 } else { 1.0 })
                .clamp(0.25, 20.0);
            let BusFxState::FilterLfo { filt, phase } = state else {
                *state = BusFxState::FilterLfo {
                    filt: BiquadState::new(),
                    phase: 0.0,
                };
                return input;
            };
            let sweep = ((*phase).sin() + 1.0) * 0.5;
            let semis = (sweep - 0.5) * 48.0 * depth;
            let cutoff = (center * 2.0_f32.powf(semis / 12.0)).clamp(40.0, 18_000.0);
            *phase = wrap_phase(*phase + 2.0 * PI * rate_hz / sample_rate as f32);
            let mode = if kind == "wah" {
                FilterType::Bandpass
            } else {
                FilterType::Lowpass
            };
            filt.process(input, mode, cutoff, q, sample_rate)
                .clamp(-1.5, 1.5)
        }
        "reverb" => {
            let mix = (get_param_f32(cfg.params(), "mixPct", 30.0) / 100.0).clamp(0.0, 1.0);
            let decay = get_param_f32(cfg.params(), "decay", 0.72).clamp(0.0, 0.95);
            let damp = get_param_f32(cfg.params(), "damp", 0.35).clamp(0.0, 0.98);
            let BusFxState::Reverb { bufs, idxs, lp } = state else {
                *state = bus_fx_state_from_cfg(cfg, sample_rate);
                return input;
            };
            let mut wet = 0.0;
            for i in 0..4 {
                let delayed = bufs[i][idxs[i]];
                lp[i] = delayed * (1.0 - damp) + lp[i] * damp;
                bufs[i][idxs[i]] = input + lp[i] * decay;
                idxs[i] = (idxs[i] + 1) % bufs[i].len();
                wet += delayed;
            }
            wet *= 0.25;
            (input * (1.0 - mix) + wet * mix).clamp(-1.5, 1.5)
        }
        "glitch" => {
            let chance = (get_param_f32(cfg.params(), "chancePct", 8.0) / 100.0).clamp(0.0, 1.0);
            let slice_ms = get_param_f32(cfg.params(), "sliceMs", 80.0).clamp(5.0, 500.0);
            let mix = (get_param_f32(cfg.params(), "mixPct", 100.0) / 100.0).clamp(0.0, 1.0);
            let BusFxState::Glitch {
                buf,
                idx,
                read,
                remain,
                rng,
            } = state
            else {
                *state = bus_fx_state_from_cfg(cfg, sample_rate);
                return input;
            };
            if buf.is_empty() {
                *buf = vec![0.0; ((sample_rate as f32) * 0.25) as usize];
            }
            buf[*idx] = input;
            let block = (slice_ms * sample_rate as f32 / 1000.0).round().max(1.0) as usize;
            if *remain == 0 {
                *rng = rng.wrapping_mul(1664525).wrapping_add(1013904223);
                let roll = ((*rng >> 8) as f32) / ((u32::MAX >> 8) as f32);
                if roll < chance {
                    *read = (*idx + buf.len()).saturating_sub(block.min(buf.len())) % buf.len();
                    *remain = block;
                }
            }
            let wet = if *remain > 0 {
                let out = buf[*read];
                *read = (*read + 1) % buf.len();
                *remain -= 1;
                out
            } else {
                input
            };
            *idx = (*idx + 1) % buf.len();
            input * (1.0 - mix) + wet * mix
        }
        "auto_pan" => {
            let rate_hz = get_param_f32(cfg.params(), "rateHz", 0.5).clamp(0.02, 20.0);
            let depth = (get_param_f32(cfg.params(), "depthPct", 100.0) / 100.0).clamp(0.0, 1.0);
            let BusFxState::AutoPan { phase, pos } = state else {
                *state = BusFxState::AutoPan {
                    phase: 0.0,
                    pos: 0.5,
                };
                return input;
            };
            *pos = 0.5 + ((*phase).sin() * 0.5 * depth);
            *phase = wrap_phase(*phase + 2.0 * PI * rate_hz / sample_rate as f32);
            input
        }
        "duck" => {
            let source = get_param_str(cfg.params(), "source", "I1");
            let threshold = get_param_f32(cfg.params(), "threshold", 0.08).clamp(0.0, 1.0);
            let amount = (get_param_f32(cfg.params(), "amountPct", 60.0) / 100.0).clamp(0.0, 1.0);
            let attack_ms = get_param_f32(cfg.params(), "attackMs", 8.0).clamp(0.1, 200.0);
            let release_ms = get_param_f32(cfg.params(), "releaseMs", 160.0).clamp(1.0, 2000.0);

            let sc = if let Some(rest) = source.strip_prefix('I') {
                rest.parse::<usize>()
                    .ok()
                    .and_then(|n| n.checked_sub(1))
                    .and_then(|i| slot_out.get(i).copied())
                    .unwrap_or(0.0)
            } else if let Some(rest) = source.strip_prefix('B') {
                rest.parse::<usize>()
                    .ok()
                    .and_then(|n| n.checked_sub(1))
                    .and_then(|i| bus_in.get(i).copied())
                    .unwrap_or(0.0)
            } else {
                0.0
            };

            let BusFxState::Duck { env } = state else {
                *state = BusFxState::Duck { env: 0.0 };
                return input;
            };

            let x = sc.abs().min(1.0);
            let atk = (attack_ms / 1000.0 * sample_rate as f32).max(1.0);
            let rel = (release_ms / 1000.0 * sample_rate as f32).max(1.0);
            let coef = if x > *env { 1.0 / atk } else { 1.0 / rel };
            *env += (x - *env) * coef;

            let over = ((*env - threshold) / (1.0 - threshold).max(1.0e-6)).clamp(0.0, 1.0);
            let gain = 1.0 - amount * over;
            let _ = (bus_idx, sample_clock); // reserved for future transport-aware ducking
            input * gain
        }
        "saturator" => {
            let drive = get_param_f32(cfg.params(), "drive", 1.8).clamp(0.0, 20.0);
            let mix = (get_param_f32(cfg.params(), "mixPct", 100.0) / 100.0).clamp(0.0, 1.0);
            let y = (input * drive).tanh();
            input * (1.0 - mix) + y * mix
        }
        "distortion" => {
            let drive = get_param_f32(cfg.params(), "drive", 2.5).clamp(0.0, 50.0);
            let clip = get_param_f32(cfg.params(), "clip", 0.6).clamp(0.05, 2.0);
            let mix = (get_param_f32(cfg.params(), "mixPct", 100.0) / 100.0).clamp(0.0, 1.0);
            let y = (input * drive).clamp(-clip, clip) / clip;
            input * (1.0 - mix) + y * mix
        }
        "bitcrusher" => {
            let rate_div = get_param_f32(cfg.params(), "rateDiv", 4.0)
                .round()
                .clamp(1.0, 128.0) as u32;
            let bits = get_param_f32(cfg.params(), "bits", 6.0)
                .round()
                .clamp(1.0, 16.0) as u32;
            let mix = (get_param_f32(cfg.params(), "mixPct", 100.0) / 100.0).clamp(0.0, 1.0);
            let BusFxState::Bitcrusher { hold, count, last } = state else {
                *state = BusFxState::Bitcrusher {
                    hold: rate_div,
                    count: 0,
                    last: input,
                };
                return input;
            };
            *hold = rate_div;
            if *count == 0 {
                *last = input;
            }
            *count = (*count + 1) % (*hold).max(1);

            let levels = (1_u32 << bits.min(16)).max(2) as f32;
            let q = ((*last + 1.0) * 0.5 * (levels - 1.0)).round();
            let crushed = (q / (levels - 1.0)) * 2.0 - 1.0;
            input * (1.0 - mix) + crushed * mix
        }
        _ => input,
    }
}

fn wrap_phase(mut phase: f32) -> f32 {
    while phase >= 2.0 * PI {
        phase -= 2.0 * PI;
    }
    while phase < 0.0 {
        phase += 2.0 * PI;
    }
    phase
}

fn read_delay(buf: &[f32], write_idx: usize, delay_samples: f32) -> f32 {
    if buf.is_empty() {
        return 0.0;
    }
    let len = buf.len() as f32;
    let pos = (write_idx as f32 - delay_samples).rem_euclid(len);
    let i0 = pos.floor() as usize % buf.len();
    let i1 = (i0 + 1) % buf.len();
    let frac = pos - pos.floor();
    buf[i0] * (1.0 - frac) + buf[i1] * frac
}
