use realtime_engine::synth::SynthEngine;
use std::sync::{Arc, Mutex};
use std::time::Instant;

const DEFAULT_BLOCK_FRAMES: usize = 128;
const MIN_BLOCK_FRAMES: usize = 32;
const MAX_BLOCK_FRAMES: usize = 2048;

pub struct EngineSource {
    engine: Arc<Mutex<SynthEngine>>,
    sample_rate: u32,
    block_frames: usize,
    buf: Vec<f32>,
    idx: usize,
}

impl EngineSource {
    pub fn new(engine: Arc<Mutex<SynthEngine>>, sample_rate: u32) -> Self {
        let block_frames = audio_block_frames();
        Self {
            engine,
            sample_rate,
            block_frames,
            buf: Vec::with_capacity(block_frames * 2),
            idx: 0,
        }
    }

    fn refill(&mut self) {
        let t0 = Instant::now();
        self.buf.clear();
        if let Ok(mut eng) = self.engine.lock() {
            for _ in 0..self.block_frames {
                let (l, r) = eng.next_stereo_sample();
                self.buf.push(l);
                self.buf.push(r);
            }
        } else {
            self.buf.resize(self.block_frames * 2, 0.0);
        }
        self.idx = 0;
        let elapsed = t0.elapsed().as_secs_f32();
        let block_seconds = (self.block_frames as f32) / (self.sample_rate as f32);
        let ratio = if block_seconds > 0.0 {
            elapsed / block_seconds
        } else {
            0.0
        };
        if let Ok(mut eng) = self.engine.lock() {
            eng.set_runtime_load_ratio(ratio);
        }
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
        2
    }

    fn sample_rate(&self) -> u32 {
        self.sample_rate
    }

    fn total_duration(&self) -> Option<std::time::Duration> {
        None
    }
}

fn audio_block_frames() -> usize {
    std::env::var("CELLSYMPHONY_AUDIO_BLOCK_FRAMES")
        .ok()
        .and_then(|value| value.parse::<usize>().ok())
        .map(|frames| frames.clamp(MIN_BLOCK_FRAMES, MAX_BLOCK_FRAMES))
        .unwrap_or(DEFAULT_BLOCK_FRAMES)
}
