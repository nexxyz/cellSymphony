use super::{
    default_synth_config, BusConfig, BusSlotConfig, FilterType, InstrumentMixerConfig,
    InstrumentSlotConfig, InstrumentsConfig, MixerConfig, SampleBankConfig, SampleBuffer,
    SampleSlotConfig, SynthEngine, DEFAULT_PAN_POSITIONS, INSTRUMENT_SLOT_COUNT,
};
use std::collections::BTreeMap;

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
fn routes_through_dynamic_bus_count_without_allocating_bus_vec() {
    let mut engine = SynthEngine::new(48_000);
    let cfg = default_synth_config();
    engine.set_instruments(InstrumentsConfig {
        instruments: vec![InstrumentSlotConfig {
            kind: "synth".to_string(),
            synth: cfg,
            mixer: Some(InstrumentMixerConfig {
                route: "bus_2".to_string(),
                pan_pos: DEFAULT_PAN_POSITIONS / 2,
            }),
        }],
        mixer: Some(MixerConfig {
            buses: vec![
                BusConfig {
                    slots: vec![BusSlotConfig::Kind("none".to_string())],
                    pan_pos: DEFAULT_PAN_POSITIONS / 2,
                },
                BusConfig {
                    slots: vec![BusSlotConfig::Kind("saturator".to_string())],
                    pan_pos: DEFAULT_PAN_POSITIONS / 2,
                },
            ],
        }),
        pan_positions: DEFAULT_PAN_POSITIONS,
    });
    engine.note_on(0, 60, 100, 120);
    for _ in 0..1024 {
        let (left, right) = engine.next_stereo_sample();
        assert!(left.is_finite());
        assert!(right.is_finite());
    }
}

#[test]
fn sample_instrument_routes_through_bus_fx_delay_tail() {
    let mut engine = SynthEngine::new(48_000);
    engine.set_instruments(InstrumentsConfig {
        instruments: vec![InstrumentSlotConfig {
            kind: "sample".to_string(),
            synth: default_synth_config(),
            mixer: Some(InstrumentMixerConfig {
                route: "bus_1".to_string(),
                pan_pos: DEFAULT_PAN_POSITIONS / 2,
            }),
        }],
        mixer: Some(MixerConfig {
            buses: vec![BusConfig {
                slots: vec![BusSlotConfig::Config {
                    kind: "delay".to_string(),
                    params: BTreeMap::from([
                        ("timeMs".to_string(), serde_json::json!(1.0)),
                        ("feedback".to_string(), serde_json::json!(0.0)),
                        ("mixPct".to_string(), serde_json::json!(100.0)),
                    ]),
                }],
                pan_pos: DEFAULT_PAN_POSITIONS / 2,
            }],
        }),
        pan_positions: DEFAULT_PAN_POSITIONS,
    });
    engine.set_sample_banks(vec![sample_bank(vec![1.0, 0.0, 0.0, 0.0])]);
    engine.note_on(0, 36, 127, 1_000);

    for _ in 0..47 {
        let _ = engine.next_stereo_sample();
    }
    let before_tail = engine.next_sample().abs();
    let tail = engine.next_sample().abs();

    assert!(before_tail < 1.0e-6);
    assert!(
        tail > 0.1,
        "sample routed through delay bus should produce a delayed tail"
    );
}

#[test]
fn duck_reduces_target_bus_when_source_instrument_is_active() {
    let mut dry = duck_test_engine(false);
    let mut ducked = duck_test_engine(true);
    dry.note_on(0, 36, 127, 1_000);
    dry.note_on(1, 36, 127, 1_000);
    ducked.note_on(0, 36, 127, 1_000);
    ducked.note_on(1, 36, 127, 1_000);

    let mut dry_sum = 0.0;
    let mut ducked_sum = 0.0;
    for _ in 0..256 {
        dry_sum += dry.next_sample().abs();
        ducked_sum += ducked.next_sample().abs();
    }

    assert!(
        ducked_sum < dry_sum * 0.8,
        "duck FX should audibly attenuate the target bus"
    );
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

fn sample_bank(samples: Vec<f32>) -> SampleBankConfig {
    let mut bank = SampleBankConfig::default();
    bank.slots[0] = SampleSlotConfig {
        buffer: Some(SampleBuffer {
            samples: samples.into(),
            channels: 1,
            sample_rate: 48_000,
        }),
    };
    bank
}

fn duck_test_engine(with_duck: bool) -> SynthEngine {
    let mut engine = SynthEngine::new(48_000);
    let slot1 = if with_duck {
        BusSlotConfig::Config {
            kind: "duck".to_string(),
            params: BTreeMap::from([
                ("source".to_string(), serde_json::json!("I1")),
                ("threshold".to_string(), serde_json::json!(0.01)),
                ("amountPct".to_string(), serde_json::json!(100.0)),
                ("attackMs".to_string(), serde_json::json!(1.0)),
                ("releaseMs".to_string(), serde_json::json!(20.0)),
            ]),
        }
    } else {
        BusSlotConfig::Kind("none".to_string())
    };
    engine.set_instruments(InstrumentsConfig {
        instruments: vec![
            InstrumentSlotConfig {
                kind: "sample".to_string(),
                synth: default_synth_config(),
                mixer: Some(InstrumentMixerConfig {
                    route: "bus_2".to_string(),
                    pan_pos: DEFAULT_PAN_POSITIONS / 2,
                }),
            },
            InstrumentSlotConfig {
                kind: "sample".to_string(),
                synth: default_synth_config(),
                mixer: Some(InstrumentMixerConfig {
                    route: "bus_1".to_string(),
                    pan_pos: DEFAULT_PAN_POSITIONS / 2,
                }),
            },
        ],
        mixer: Some(MixerConfig {
            buses: vec![
                BusConfig {
                    slots: vec![slot1],
                    pan_pos: DEFAULT_PAN_POSITIONS / 2,
                },
                BusConfig {
                    slots: vec![BusSlotConfig::Kind("none".to_string())],
                    pan_pos: DEFAULT_PAN_POSITIONS / 2,
                },
            ],
        }),
        pan_positions: DEFAULT_PAN_POSITIONS,
    });
    engine.set_sample_banks(vec![
        sample_bank(vec![1.0; 512]),
        sample_bank(vec![0.5; 512]),
    ]);
    engine
}
