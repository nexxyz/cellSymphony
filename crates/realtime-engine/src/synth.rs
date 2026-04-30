use std::f32::consts::PI;

#[derive(Clone, Copy, Debug)]
pub struct NoteTrigger {
    pub midi_note: u8,
    pub velocity: u8,
    pub duration_ms: u32,
}

pub fn render_note_preview(trigger: NoteTrigger, sample_rate: u32) -> Vec<f32> {
    let freq = midi_note_to_hz(trigger.midi_note);
    let samples = ((trigger.duration_ms as f32 / 1000.0) * sample_rate as f32).max(1.0) as usize;
    let amp = trigger.velocity as f32 / 127.0;
    let release = (samples / 6).max(8);

    let mut out = Vec::with_capacity(samples);
    for i in 0..samples {
        let t = i as f32 / sample_rate as f32;
        let wave = (2.0 * PI * freq * t).sin();
        let env = if i + release >= samples {
            let remain = (samples - i) as f32 / release as f32;
            remain.clamp(0.0, 1.0)
        } else {
            1.0
        };
        out.push(wave * amp * env * 0.2);
    }
    out
}

fn midi_note_to_hz(note: u8) -> f32 {
    440.0 * 2.0_f32.powf((note as f32 - 69.0) / 12.0)
}

#[cfg(test)]
mod tests {
    use super::{render_note_preview, NoteTrigger};

    #[test]
    fn generates_samples() {
        let pcm = render_note_preview(
            NoteTrigger {
                midi_note: 60,
                velocity: 100,
                duration_ms: 100,
            },
            48_000,
        );
        assert!(!pcm.is_empty());
        assert!(pcm.iter().any(|v| *v != 0.0));
    }
}
