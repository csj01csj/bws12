#!/bin/bash
# Download x86-64 OS images for v86
# Run on server in /var/www/v86/

IMAGES_DIR="/var/www/v86/images"
BIOS_DIR="/var/www/v86/bios"
mkdir -p "$IMAGES_DIR" "$BIOS_DIR"

echo "=== Downloading SeaBIOS (supports 64-bit boot) ==="
# SeaBIOS - latest build from copy.sh (supports x86-64 long mode)
wget -nv -O "$BIOS_DIR/seabios.bin" \
    "https://github.com/copy/v86/raw/master/bios/seabios.bin"
wget -nv -O "$BIOS_DIR/vgabios.bin" \
    "https://github.com/copy/v86/raw/master/bios/vgabios.bin"

echo "=== Downloading Alpine Linux (x86-64, ~20MB) ==="
# Alpine Linux - minimal 64-bit distro, works well in v86
# Get latest Alpine mini root filesystem
ALPINE_VERSION="3.19.1"
wget -nv -O "$IMAGES_DIR/alpine-x86_64.iso" \
    "https://dl-cdn.alpinelinux.org/alpine/v3.19/releases/x86_64/alpine-virt-${ALPINE_VERSION}-x86_64.iso"

echo "=== Downloading buildroot x86-64 bzImage ==="
# Buildroot minimal Linux for x86-64
# Build one locally or use a prebuilt:
# See: https://buildroot.org/downloads/

echo ""
echo "=== Images downloaded to $IMAGES_DIR ==="
ls -lh "$IMAGES_DIR"
ls -lh "$BIOS_DIR"

echo ""
echo "=== Alternatively, build a minimal image: ==="
echo "1. Install buildroot: git clone https://github.com/buildroot/buildroot"
echo "2. make qemu_x86_64_defconfig"
echo "3. make -j\$(nproc)"
echo "4. Output: output/images/bzImage + output/images/rootfs.ext4"
