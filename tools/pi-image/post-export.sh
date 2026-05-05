#!/bin/bash
set -e

# Post-export script for pi-gen
# Runs in pi-gen root directory after image is built

IMG_PATH="deploy/${IMG_NAME}.img"

if [ ! -f "$IMG_PATH" ]; then
    echo "Error: Image not found at $IMG_PATH"
    exit 1
fi

echo "Modifying boot partition in ${IMG_PATH}..."

# Map image partitions
LOOP_DEV=$(kpartx -av "$IMG_PATH" | grep -oP 'loop\d+' | head -1)
sleep 2

# Mount boot partition (FAT32, usually p1)
mkdir -p /mnt/boot
mount "/dev/mapper/${LOOP_DEV}p1" /mnt/boot

# Append our config lines to config.txt
# Stage files are in stage4-cellsymphony/files/ relative to pi-gen dir
if [ -f "stage4-cellsymphony/files/boot/config.txt.append" ]; then
    echo "" >> /mnt/boot/config.txt
    echo "# --- Cell Symphony additions ---" >> /mnt/boot/config.txt
    cat "stage4-cellsymphony/files/boot/config.txt.append" >> /mnt/boot/config.txt
    echo "Updated /boot/config.txt"
fi

# Enable SSH by creating ssh file
touch /mnt/boot/ssh
echo "Enabled SSH"

# Unmount boot partition
umount /mnt/boot
rmdir /mnt/boot

# Unmap image
kpartx -dv "$IMG_PATH"

echo "Post-export modifications complete."
