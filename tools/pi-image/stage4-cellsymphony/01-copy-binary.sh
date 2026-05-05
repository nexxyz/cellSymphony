#!/bin/bash
set -e

# Copy pre-built binary from files directory to /usr/local/bin
cp /files/cellsymphony-pi /usr/local/bin/
chmod +x /usr/local/bin/cellsymphony-pi
