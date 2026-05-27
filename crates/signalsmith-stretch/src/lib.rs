mod sys {
    #[repr(C)]
    pub struct signalsmith_stretch_t {
        _private: [u8; 0],
    }

    extern "C" {
        pub fn signalsmith_stretch_create(
            channel_count: i32,
            block_length: usize,
            interval: usize,
        ) -> *mut signalsmith_stretch_t;

        pub fn signalsmith_stretch_create_preset_default(
            channel_count: i32,
            sample_rate: f32,
        ) -> *mut signalsmith_stretch_t;

        pub fn signalsmith_stretch_create_preset_cheaper(
            channel_count: i32,
            sample_rate: f32,
        ) -> *mut signalsmith_stretch_t;

        pub fn signalsmith_stretch_destroy(handle: *mut signalsmith_stretch_t);

        pub fn signalsmith_stretch_reset(handle: *mut signalsmith_stretch_t);

        pub fn signalsmith_stretch_input_latency(handle: *mut signalsmith_stretch_t) -> usize;

        pub fn signalsmith_stretch_output_latency(handle: *mut signalsmith_stretch_t) -> usize;

        pub fn signalsmith_stretch_seek(
            handle: *mut signalsmith_stretch_t,
            input: *mut f32,
            input_length: usize,
            playback_rate: f64,
        );

        pub fn signalsmith_stretch_set_transpose_factor(
            handle: *mut signalsmith_stretch_t,
            multiplier: f32,
            tonality_limit: f32,
        );

        pub fn signalsmith_stretch_set_transpose_factor_semitones(
            handle: *mut signalsmith_stretch_t,
            semitones: f32,
            tonality_limit: f32,
        );

        pub fn signalsmith_stretch_set_formant_factor(
            handle: *mut signalsmith_stretch_t,
            multiplier: f32,
            compensate_pitch: i32,
        );

        pub fn signalsmith_stretch_set_formant_factor_semitones(
            handle: *mut signalsmith_stretch_t,
            semitones: f32,
            compensate_pitch: i32,
        );

        pub fn signalsmith_stretch_set_formant_base(
            handle: *mut signalsmith_stretch_t,
            frequency: f32,
        );

        pub fn signalsmith_stretch_process(
            handle: *mut signalsmith_stretch_t,
            input: *mut f32,
            input_length: usize,
            output: *mut f32,
            output_length: usize,
        );

        pub fn signalsmith_stretch_exact(
            handle: *mut signalsmith_stretch_t,
            input: *mut f32,
            input_length: usize,
            output: *mut f32,
            output_length: usize,
        ) -> bool;

        pub fn signalsmith_stretch_flush(
            handle: *mut signalsmith_stretch_t,
            output: *mut f32,
            output_length: usize,
        );
    }
}

pub struct Stretch {
    inner: *mut sys::signalsmith_stretch_t,
    channel_count: usize,
}

unsafe impl Send for Stretch {}
unsafe impl Sync for Stretch {}

impl Stretch {
    pub fn new(channel_count: u32, block_length: usize, interval: usize) -> Self {
        let ptr =
            unsafe { sys::signalsmith_stretch_create(channel_count as _, block_length, interval) };

        Self {
            inner: ptr,
            channel_count: channel_count as usize,
        }
    }

    pub fn preset_default(channel_count: u32, sample_rate: u32) -> Self {
        let ptr = unsafe {
            sys::signalsmith_stretch_create_preset_default(channel_count as i32, sample_rate as f32)
        };

        Self {
            inner: ptr,
            channel_count: channel_count as usize,
        }
    }

    pub fn preset_cheaper(channel_count: u32, sample_rate: u32) -> Self {
        let ptr = unsafe {
            sys::signalsmith_stretch_create_preset_cheaper(channel_count as i32, sample_rate as f32)
        };

        Self {
            inner: ptr,
            channel_count: channel_count as usize,
        }
    }

    pub fn reset(&mut self) {
        unsafe { sys::signalsmith_stretch_reset(self.inner) }
    }

    pub fn input_latency(&self) -> usize {
        unsafe { sys::signalsmith_stretch_input_latency(self.inner) }
    }

    pub fn output_latency(&self) -> usize {
        unsafe { sys::signalsmith_stretch_output_latency(self.inner) }
    }

    pub fn set_transpose_factor(&mut self, multiplier: f32, tonality_limit: Option<f32>) {
        unsafe {
            sys::signalsmith_stretch_set_transpose_factor(
                self.inner,
                multiplier,
                tonality_limit.unwrap_or(0.0),
            )
        }
    }

    pub fn set_transpose_factor_semitones(
        &mut self,
        semitones: f32,
        tonality_limit: Option<f32>,
    ) {
        unsafe {
            sys::signalsmith_stretch_set_transpose_factor_semitones(
                self.inner,
                semitones,
                tonality_limit.unwrap_or(0.0),
            )
        }
    }

    pub fn set_formant_factor(&mut self, multiplier: f32, compensate_pitch: bool) {
        unsafe {
            sys::signalsmith_stretch_set_formant_factor(
                self.inner,
                multiplier,
                if compensate_pitch { 1 } else { 0 },
            )
        }
    }

    pub fn set_formant_factor_semitones(&mut self, semitones: f32, compensate_pitch: bool) {
        unsafe {
            sys::signalsmith_stretch_set_formant_factor_semitones(
                self.inner,
                semitones,
                if compensate_pitch { 1 } else { 0 },
            )
        }
    }

    pub fn signalsmith_stretch_set_formant_base(&self, frequency: f32) {
        unsafe { sys::signalsmith_stretch_set_formant_base(self.inner, frequency) }
    }

    pub fn seek(&mut self, input: impl AsRef<[f32]>, playback_rate: f64) {
        let input = input.as_ref();
        let ptr = input.as_ptr();

        debug_assert_eq!(0, input.len() % self.channel_count);

        unsafe {
            sys::signalsmith_stretch_seek(
                self.inner,
                ptr as _,
                input.len() / self.channel_count,
                playback_rate,
            );
        }
    }

    pub fn process(&mut self, input: impl AsRef<[f32]>, mut output: impl AsMut<[f32]>) {
        let input = input.as_ref();
        let output = output.as_mut();

        debug_assert_eq!(0, input.len() % self.channel_count);
        debug_assert_eq!(0, output.len() % self.channel_count);

        unsafe {
            sys::signalsmith_stretch_process(
                self.inner,
                input.as_ptr() as _,
                input.len() / self.channel_count,
                output.as_mut_ptr(),
                output.len() / self.channel_count,
            );
        }
    }

    pub fn exact(&mut self, input: impl AsRef<[f32]>, mut output: impl AsMut<[f32]>) -> bool {
        let input = input.as_ref();
        let output = output.as_mut();

        debug_assert_eq!(0, input.len() % self.channel_count);
        debug_assert_eq!(0, output.len() % self.channel_count);

        unsafe {
            sys::signalsmith_stretch_exact(
                self.inner,
                input.as_ptr() as _,
                input.len() / self.channel_count,
                output.as_mut_ptr(),
                output.len() / self.channel_count,
            )
        }
    }

    pub fn flush(&mut self, mut output: impl AsMut<[f32]>) {
        let output = output.as_mut();
        debug_assert_eq!(0, output.len() % self.channel_count);

        unsafe {
            sys::signalsmith_stretch_flush(
                self.inner,
                output.as_mut_ptr(),
                output.len() / self.channel_count,
            );
        }
    }
}

impl Drop for Stretch {
    fn drop(&mut self) {
        unsafe { sys::signalsmith_stretch_destroy(self.inner) }
    }
}
