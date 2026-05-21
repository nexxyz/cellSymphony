use crate::SampleSlotConfig;
use realtime_engine::synth::{
    BusConfig, BusSlotConfig, InstrumentMixerConfig, InstrumentSlotConfig, InstrumentsConfig,
    MixerConfig, SynthConfig, VoiceStealingMode, INSTRUMENT_SLOT_COUNT,
};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct AudioInstrumentsConfig {
    pub instruments: Vec<AudioInstrumentSlotConfig>,
    #[serde(default)]
    mixer: Option<AudioMixerConfig>,
    #[serde(default, rename = "panPositions")]
    pan_positions: Option<usize>,
}

#[derive(Deserialize)]
struct AudioMixerConfig {
    #[serde(default)]
    buses: Vec<AudioBusConfig>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AudioBusConfig {
    #[serde(default)]
    slot1: Option<serde_json::Value>,
    #[serde(default)]
    slot2: Option<serde_json::Value>,
    #[serde(default)]
    pan_pos: Option<usize>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioRuntimePolicyConfig {
    pub voice_stealing_mode: String,
}

#[derive(Deserialize)]
pub struct AudioInstrumentSlotConfig {
    #[serde(rename = "type")]
    kind: String,
    #[serde(default)]
    synth: Option<SynthConfig>,
    #[serde(default)]
    sample: Option<AudioSampleConfig>,
    #[serde(default)]
    mixer: Option<AudioInstrumentMixerConfig>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AudioInstrumentMixerConfig {
    #[serde(default)]
    route: Option<String>,
    #[serde(default)]
    pan_pos: Option<usize>,
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

pub fn synth_payload(config: &AudioInstrumentsConfig) -> InstrumentsConfig {
    InstrumentsConfig {
        instruments: config
            .instruments
            .iter()
            .map(|slot| InstrumentSlotConfig {
                kind: slot.kind.clone(),
                synth: slot
                    .synth
                    .unwrap_or_else(realtime_engine::synth::default_synth_config),
                mixer: Some(InstrumentMixerConfig {
                    route: slot
                        .mixer
                        .as_ref()
                        .and_then(|m| m.route.clone())
                        .unwrap_or_else(|| "direct".to_string()),
                    pan_pos: slot.mixer.as_ref().and_then(|m| m.pan_pos).unwrap_or(4),
                }),
            })
            .collect(),
        mixer: Some(MixerConfig {
            buses: mixer_buses(config),
        }),
        pan_positions: config.pan_positions.unwrap_or(8),
    }
}

pub fn parse_voice_stealing_mode(raw: &str) -> VoiceStealingMode {
    match raw {
        "off" => VoiceStealingMode::Off,
        "lenient" => VoiceStealingMode::Lenient,
        "aggressive" => VoiceStealingMode::Aggressive,
        _ => VoiceStealingMode::Balanced,
    }
}

pub fn build_audio_slot_configs(
    instruments: &[AudioInstrumentSlotConfig],
) -> (
    [bool; INSTRUMENT_SLOT_COUNT],
    [SampleSlotConfig; INSTRUMENT_SLOT_COUNT],
) {
    let mut synth_slots = [false; INSTRUMENT_SLOT_COUNT];
    let mut sample_cfgs = std::array::from_fn(|_| SampleSlotConfig::default());
    for (idx, slot) in instruments.iter().enumerate() {
        if idx >= INSTRUMENT_SLOT_COUNT {
            break;
        }
        synth_slots[idx] = slot.kind == "synth";
        if slot.kind != "sample" {
            continue;
        }
        sample_cfgs[idx] = sample_slot_config(slot);
    }
    (synth_slots, sample_cfgs)
}

fn mixer_buses(config: &AudioInstrumentsConfig) -> Vec<BusConfig> {
    config
        .mixer
        .as_ref()
        .map(|m| {
            m.buses
                .iter()
                .map(|b| BusConfig {
                    slots: vec![bus_slot(&b.slot1), bus_slot(&b.slot2)],
                    pan_pos: b.pan_pos.unwrap_or(4),
                })
                .collect::<Vec<_>>()
        })
        .unwrap_or_default()
}

fn bus_slot(value: &Option<serde_json::Value>) -> BusSlotConfig {
    value
        .clone()
        .and_then(|v| serde_json::from_value::<BusSlotConfig>(v).ok())
        .unwrap_or_else(|| BusSlotConfig::Kind("none".to_string()))
}

fn sample_slot_config(slot: &AudioInstrumentSlotConfig) -> SampleSlotConfig {
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
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_audio_slot_configs_applies_defaults_and_limits() {
        let mut many: Vec<AudioInstrumentSlotConfig> = Vec::new();
        many.push(AudioInstrumentSlotConfig {
            kind: "sample".to_string(),
            synth: None,
            sample: Some(AudioSampleConfig {
                slots: vec![
                    AudioSampleSlotEntry {
                        path: Some("a.wav".to_string()),
                    },
                    AudioSampleSlotEntry {
                        path: Some("b.wav".to_string()),
                    },
                ],
                tune_semis: Some(7.0),
                amp: Some(AudioAmpConfig {
                    gain_pct: Some(80.0),
                    velocity_sensitivity_pct: Some(50.0),
                }),
            }),
            mixer: None,
        });
        many.push(AudioInstrumentSlotConfig {
            kind: "synth".to_string(),
            synth: None,
            sample: None,
            mixer: None,
        });
        for _ in 0..20 {
            many.push(AudioInstrumentSlotConfig {
                kind: "sample".to_string(),
                synth: None,
                sample: None,
                mixer: None,
            });
        }

        let (slots, cfgs) = build_audio_slot_configs(&many);
        assert!(!slots[0]);
        assert!(slots[1]);
        assert_eq!(cfgs[0].tune_semis, 7.0);
        assert_eq!(cfgs[0].gain_pct, 80.0);
        assert_eq!(cfgs[0].vel_sens_pct, 50.0);
        assert_eq!(cfgs[0].slots[0], Some("a.wav".to_string()));
        assert_eq!(cfgs[0].slots[1], Some("b.wav".to_string()));
        assert_eq!(slots.len(), INSTRUMENT_SLOT_COUNT);
    }
}
