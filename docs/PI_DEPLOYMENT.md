# Pi Zero 2W Deployment Guide

## Building & Deploying Cell Symphony to Pi Zero 2W

### Option 1: Native Compilation on Pi (Recommended)

Cell Symphony targets Raspberry Pi OS 64-bit on Pi Zero 2W. Native compilation on the Pi remains the simplest way to validate ALSA, MIDI, I2C, SPI, and I2S together.

#### 1. Set up the Pi

```bash
# Install system dependencies on Raspberry Pi OS 64-bit
sudo apt update
sudo apt install -y \
    libasound2-dev \
    pkg-config \
    alsa-utils \
    git \
    curl \
    build-essential

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
source $HOME/.cargo/env

# Enable I2S audio (PCM5102 DAC)
echo "dtparam=i2s=on" | sudo tee -a /boot/config.txt
echo "dtoverlay=hifiberry-dac" | sudo tee -a /boot/config.txt

# Reboot to apply I2S
sudo reboot
```

#### 2. Clone & Build on Pi

```bash
git clone https://github.com/nexxyz/cellSymphony.git
cd cellSymphony
cargo build --release -p cellsymphony-pi
```

#### 3. Create systemd Service

Create `/etc/systemd/system/cellsymphony.service`:

```ini
[Unit]
Description=Cell Symphony Pi Zero 2W
After=sound.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/cellsymphony
ExecStartPre=/bin/sleep 2
ExecStart=/home/pi/cellsymphony/target/release/cellsymphony-pi
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable cellsymphony
sudo systemctl start cellsymphony
sudo systemctl status cellsymphony  # Verify

# View logs
journalctl -u cellsymphony -f
```

---

### Option 2: Cross-Compilation (Advanced)

The supported cross target for Pi Zero 2W is `aarch64-unknown-linux-gnu`.

#### 1. Install AArch64 GNU Toolchain
- Linux CI uses `gcc-aarch64-linux-gnu`.
- Windows development requires an AArch64 Linux GNU toolchain that provides `aarch64-linux-gnu-gcc`.

#### 2. Set up ALSA Sysroot
The issue: `rodio` → `alsa-sys` needs ALSA libraries during build.

```bash
# Docker/cross path used by CI:
cross build --target aarch64-unknown-linux-gnu -p cellsymphony-pi
```

#### 3. Configure Cargo
Create `.cargo/config.toml`:
```toml
[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
```

---

### 3. Hardware Verification

After deployment:

```bash
# Check I2S DAC is detected
aplay -l
# Should show PCM5102/PCM5102A device

# Check USB MIDI (if connected)
aconnect -l
# Should show USB MIDI device

# Test audio
speaker-test -c2 -t wav

# Test MIDI
aseqdump -p <client>:<port>
```

---

### 4. What Works Now

✅ Hardware initialization (I2C, OLED, NeoTrellis, NeoKey, Encoders)
✅ Main loop with 8ms ticks (125Hz)
✅ Grid press → triggers note (when audio is working)
✅ Encoder events logged
⚠️ Audio output: Requires on-device verification with the PCM5102/I2S DAC
⚠️ MIDI input: Requires on-device verification with the target USB MIDI hardware

---

### 5. Quick Deploy Script

Use `tools/deploy-pi.sh` (run on Pi after copying repo):

```bash
# On Pi:
bash deploy-pi.sh
# Installs deps, builds, creates systemd service, reboots
```
