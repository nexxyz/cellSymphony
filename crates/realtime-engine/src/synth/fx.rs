use super::fx_params::{BusFxParams, DuckSource, FilterLfoKind};
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

pub(super) fn bus_fx_state_from_params(params: &BusFxParams, sample_rate: u32) -> BusFxState {
    match params {
        BusFxParams::Delay { time_ms, .. } => BusFxState::Delay {
            buf: vec![0.0; ((*time_ms / 1000.0) * sample_rate as f32).round().max(1.0) as usize],
            idx: 0,
        },
        BusFxParams::Tremolo { .. } => BusFxState::Tremolo { phase: 0.0 },
        BusFxParams::ModDelay {
            depth_ms, base_ms, ..
        } => BusFxState::ModDelay {
            buf: vec![
                0.0;
                (((*base_ms + *depth_ms + 5.0) / 1000.0) * sample_rate as f32)
                    .ceil()
                    .max(2.0) as usize
            ],
            idx: 0,
            phase: 0.0,
        },
        BusFxParams::FilterLfo { .. } => BusFxState::FilterLfo {
            filt: BiquadState::new(),
            phase: 0.0,
        },
        BusFxParams::Duck { .. } => BusFxState::Duck { env: 0.0 },
        BusFxParams::Bitcrusher { .. } => BusFxState::Bitcrusher {
            hold: 1,
            count: 0,
            last: 0.0,
        },
        BusFxParams::Reverb { .. } => BusFxState::Reverb {
            bufs: [1557, 1617, 1491, 1422]
                .map(|n| vec![0.0; (n * sample_rate as usize / 44_100).max(1)]),
            idxs: [0; 4],
            lp: [0.0; 4],
        },
        BusFxParams::Glitch { .. } => BusFxState::Glitch {
            buf: vec![0.0; ((sample_rate as f32) * 0.25) as usize],
            idx: 0,
            read: 0,
            remain: 0,
            rng: 0x1234_abcd,
        },
        BusFxParams::AutoPan { .. } => BusFxState::AutoPan {
            phase: 0.0,
            pos: 0.5,
        },
        _ => BusFxState::None,
    }
}

pub(super) fn process_bus_slot(
    params: &BusFxParams,
    state: &mut BusFxState,
    input: f32,
    slot_out: &[f32; INSTRUMENT_SLOT_COUNT],
    bus_in: &[f32],
    sample_rate: u32,
) -> f32 {
    match *params {
        BusFxParams::None => input,
        BusFxParams::Tremolo { rate_hz, depth } => {
            let BusFxState::Tremolo { phase } = state else {
                *state = BusFxState::Tremolo { phase: 0.0 };
                return input;
            };
            let gain = (1.0 - depth) + depth * ((phase.sin() + 1.0) * 0.5);
            *phase = wrap_phase(*phase + 2.0 * PI * rate_hz / sample_rate as f32);
            input * gain
        }
        BusFxParams::Delay {
            time_ms,
            feedback,
            mix,
        } => process_delay(state, input, time_ms, feedback, mix, sample_rate),
        BusFxParams::ModDelay {
            rate_hz,
            depth_ms,
            base_ms,
            feedback,
            mix,
        } => process_mod_delay(
            state,
            input,
            ModDelayParams {
                rate_hz,
                depth_ms,
                base_ms,
                feedback,
                mix,
            },
            sample_rate,
        ),
        BusFxParams::FilterLfo {
            kind,
            rate_hz,
            depth,
            center_hz,
            q,
        } => process_filter_lfo(
            state,
            input,
            kind,
            rate_hz,
            depth,
            center_hz,
            q,
            sample_rate,
        ),
        BusFxParams::Reverb { mix, decay, damp } => {
            let BusFxState::Reverb { bufs, idxs, lp } = state else {
                *state = bus_fx_state_from_params(params, sample_rate);
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
            (input * (1.0 - mix) + wet * 0.25 * mix).clamp(-1.5, 1.5)
        }
        BusFxParams::Glitch {
            chance,
            slice_ms,
            mix,
        } => process_glitch(state, input, chance, slice_ms, mix, sample_rate),
        BusFxParams::AutoPan { rate_hz, depth } => {
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
        BusFxParams::Duck {
            source,
            threshold,
            amount,
            attack_ms,
            release_ms,
        } => process_duck(
            state,
            input,
            source,
            threshold,
            amount,
            attack_ms,
            release_ms,
            slot_out,
            bus_in,
            sample_rate,
        ),
        BusFxParams::Saturator { drive, mix } => {
            let y = (input * drive).tanh();
            input * (1.0 - mix) + y * mix
        }
        BusFxParams::Distortion { drive, clip, mix } => {
            let y = (input * drive).clamp(-clip, clip) / clip;
            input * (1.0 - mix) + y * mix
        }
        BusFxParams::Bitcrusher {
            rate_div,
            bits,
            mix,
        } => process_bitcrusher(state, input, rate_div, bits, mix),
    }
}

fn process_delay(
    state: &mut BusFxState,
    input: f32,
    time_ms: f32,
    feedback: f32,
    mix: f32,
    sample_rate: u32,
) -> f32 {
    let desired_len = ((time_ms / 1000.0) * sample_rate as f32).round() as usize;
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
    *idx = (*idx + 1) % buf.len();
    (input * (1.0 - mix) + delayed * mix).clamp(-1.5, 1.5)
}

struct ModDelayParams {
    rate_hz: f32,
    depth_ms: f32,
    base_ms: f32,
    feedback: f32,
    mix: f32,
}

fn process_mod_delay(
    state: &mut BusFxState,
    input: f32,
    params: ModDelayParams,
    sample_rate: u32,
) -> f32 {
    let BusFxState::ModDelay { buf, idx, phase } = state else {
        *state = BusFxState::ModDelay {
            buf: vec![0.0; ((sample_rate as f32) * 0.08) as usize],
            idx: 0,
            phase: 0.0,
        };
        return input;
    };
    let need =
        (((params.base_ms + params.depth_ms + 5.0) / 1000.0) * sample_rate as f32).ceil() as usize;
    if buf.len() != need.max(2) {
        *buf = vec![0.0; need.max(2)];
        *idx = 0;
    }
    let delay_ms =
        (params.base_ms + params.depth_ms * ((*phase).sin() + 1.0) * 0.5).clamp(0.1, 100.0);
    let delayed = read_delay(buf, *idx, delay_ms * sample_rate as f32 / 1000.0);
    buf[*idx] = (input + delayed * params.feedback).clamp(-2.0, 2.0);
    *idx = (*idx + 1) % buf.len();
    *phase = wrap_phase(*phase + 2.0 * PI * params.rate_hz / sample_rate as f32);
    (input * (1.0 - params.mix) + delayed * params.mix).clamp(-1.5, 1.5)
}

fn process_filter_lfo(
    state: &mut BusFxState,
    input: f32,
    kind: FilterLfoKind,
    rate_hz: f32,
    depth: f32,
    center_hz: f32,
    q: f32,
    sample_rate: u32,
) -> f32 {
    let BusFxState::FilterLfo { filt, phase } = state else {
        *state = BusFxState::FilterLfo {
            filt: BiquadState::new(),
            phase: 0.0,
        };
        return input;
    };
    let sweep = ((*phase).sin() + 1.0) * 0.5;
    let semis = (sweep - 0.5) * 48.0 * depth;
    let cutoff = (center_hz * 2.0_f32.powf(semis / 12.0)).clamp(40.0, 18_000.0);
    *phase = wrap_phase(*phase + 2.0 * PI * rate_hz / sample_rate as f32);
    let mode = match kind {
        FilterLfoKind::Wah => FilterType::Bandpass,
        FilterLfoKind::FilterLfo => FilterType::Lowpass,
    };
    filt.process(input, mode, cutoff, q, sample_rate)
        .clamp(-1.5, 1.5)
}

fn process_glitch(
    state: &mut BusFxState,
    input: f32,
    chance: f32,
    slice_ms: f32,
    mix: f32,
    sample_rate: u32,
) -> f32 {
    let BusFxState::Glitch {
        buf,
        idx,
        read,
        remain,
        rng,
    } = state
    else {
        *state = BusFxState::Glitch {
            buf: vec![0.0; ((sample_rate as f32) * 0.25) as usize],
            idx: 0,
            read: 0,
            remain: 0,
            rng: 0x1234_abcd,
        };
        return input;
    };
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

fn process_duck(
    state: &mut BusFxState,
    input: f32,
    source: DuckSource,
    threshold: f32,
    amount: f32,
    attack_ms: f32,
    release_ms: f32,
    slot_out: &[f32; INSTRUMENT_SLOT_COUNT],
    bus_in: &[f32],
    sample_rate: u32,
) -> f32 {
    let sc = match source {
        DuckSource::Instrument(idx) => slot_out.get(idx).copied().unwrap_or(0.0),
        DuckSource::Bus(idx) => bus_in.get(idx).copied().unwrap_or(0.0),
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
    input * (1.0 - amount * over)
}

fn process_bitcrusher(
    state: &mut BusFxState,
    input: f32,
    rate_div: u32,
    bits: u32,
    mix: f32,
) -> f32 {
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
    let len = buf.len() as f32;
    let pos = (write_idx as f32 - delay_samples).rem_euclid(len);
    let i0 = pos.floor() as usize % buf.len();
    let i1 = (i0 + 1) % buf.len();
    let frac = pos - pos.floor();
    buf[i0] * (1.0 - frac) + buf[i1] * frac
}
