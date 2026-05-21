mod engine;
mod fx;
mod fx_params;
#[cfg(test)]
mod tests;
mod types;

pub use engine::SynthEngine;
pub use types::{
    default_synth_config, BusConfig, BusSlotConfig, EnvConfig, FilterConfig, FilterType,
    InstrumentMixerConfig, InstrumentSlotConfig, InstrumentsConfig, MixerConfig, OscConfig,
    SynthConfig, VoiceStealingMode, BUS_SLOTS_PER_BUS, DEFAULT_PAN_POSITIONS,
    INSTRUMENT_SLOT_COUNT, VOICES_PER_SLOT,
};
