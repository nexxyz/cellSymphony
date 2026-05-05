#!/bin/bash
set -e

# Install systemd service for auto-start
cp /files/root/etc/systemd/system/cellsymphony.service /etc/systemd/system/
systemctl enable cellsymphony.service

# Create log directory
mkdir -p /var/log/cellsymphony
