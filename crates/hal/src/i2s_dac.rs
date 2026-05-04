//! I2S PCM5102 DAC driver for Raspberry Pi Zero 2W
//! Uses rodio with ALSA backend (same as desktop)

#[cfg(feature = "pi-zero")]
use realtime_engine::synth::{render_note_preview, NoteTrigger, Waveform};
#[cfg(feature = "pi-zero")]
use rodio::{buffer::SamplesBuffer, OutputStream, OutputStreamHandle, Sink};

#[cfg(feature = "pi-zero")]
pub struct I2sDac {
    _stream: OutputStream,
    handle: OutputStreamHandle,
}

#[cfg(feature = "pi-zero")]
impl I2sDac {
    /// Initialize I2S DAC (uses rodio with ALSA backend)
    pub fn new() -> Result<Self, String> {
        let (stream, handle) =
            OutputStream::try_default().map_err(|e| format!("I2S DAC init failed: {}", e))?;
        Ok(Self {
            _stream: stream,
            handle,
        })
    }

    /// Trigger a note (for testing/playback)
    pub fn trigger_note(
        &self,
        channel: u8,
        note: u8,
        velocity: u8,
        duration_ms: u32,
    ) -> Result<(), String> {
        let waveform = match channel {
            1 => Waveform::Pulse { duty: 0.5 },
            _ => Waveform::Sine,
        };

        let data = render_note_preview(
            NoteTrigger {
                midi_note: note,
                velocity,
                duration_ms,
                waveform,
                lowpass_cutoff_hz: 8000.0,
                lowpass_resonance: 0.2,
            },
            48000,
        );

        let source = SamplesBuffer::new(1, 48000, data);
        let sink = Sink::try_new(&self.handle).map_err(|e| format!("Sink create failed: {}", e))?;
        sink.append(source);
        sink.detach();

        Ok(())
    }
}

/// Stub for non-Pi builds
#[cfg(not(feature = "pi-zero"))]
pub struct I2sDac {
    _private: (),
}

#[cfg(not(feature = "pi-zero"))]
impl I2sDac {
    pub fn new() -> Result<Self, String> {
        Ok(Self { _private: () })
    }

    pub fn trigger_note(
        &self,
        _channel: u8,
        _note: u8,
        _velocity: u8,
        _duration_ms: u32,
    ) -> Result<(), String> {
        Ok(())
    }
}
