# Pi Zero 2W Deployment Guide

## Building & Deploying Cell Symphony to Pi Zero 2W

### Option 1: Native Compilation on Pi (Recommended)

Since cross-compiling with audio libraries (rodio → alsa-sys) from Windows is complex, native compilation on the Pi is simpler.

#### 1. Set up the Pi

```bash
# Install system dependencies
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

### Option 2: Cross-Compilation from Windows (Advanced)

If you must cross-compile from Windows:

#### 1. Install ARM GNU Toolchain
- Download: `arm-gnu-toolchain-*-mingw-w64-i686-arm-none-linux-gnueabihf.zip`
- Extract to: `F:\Tools\arm-gnu-toolchain...\`
- Add `...\bin` to PATH

#### 2. Set up ALSA Sysroot
The issue: `rodio` → `alsa-sys` needs ALSA libraries during build.

```bash
# Download Raspberry Pi OS sysroot (contains /usr/lib/arm-linux-gnueabihf/libasound.so)
# Or use Docker:
docker run --rm -v "$(pwd):/src" -t arm32v7/rust cargo build --target armv7-unknown-linux-gnueabihf -p cellsymphony-pi
```

#### 3. Configure Cargo
Create `.cargo/config.toml`:
```toml
[target.armv7-unknown-linux-gnueabihf]
linker = "F:\\Tools\\arm-gnu-toolchain-...\\bin\\arm-none-linux-gnueabihf-gcc.exe"
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
⚠️ Audio output: Needs native compilation on Pi (rodio + ALSA)
⚠️ MIDI input: Needs native compilation on Pi (midir + ALSA)

---

### 5. Quick Deploy Script

Use `tools/deploy-pi.sh` (run on Pi after copying repo):

```bash
# On Pi:
bash deploy-pi.sh
# Installs deps, builds, creates systemd service, reboots
```
