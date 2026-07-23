#!/usr/bin/env bash
set -euo pipefail

# Check required dependencies
if ! command -v xz &>/dev/null; then
    printf "\033[31merror:\033[0m 'xz' is required but not installed.\n"
    exit 1
fi
if ! command -v curl &>/dev/null; then
    printf "\033[31merror:\033[0m 'curl' is required but not installed.\n"
    exit 1
fi

SYSTEM=$(uname -s)
ARCH=$(uname -m)

PKG_URL="https://github.com/MugeTong/siimit/releases/latest/download/siimit-${SYSTEM,,}-${ARCH}.xz"
PKG_PATH="/tmp/siimit-${SYSTEM,,}-${ARCH}.xz"
INSTALL_DIR="$HOME/.local/bin"
TEMP_BINARY="/tmp/siimit-${SYSTEM,,}-${ARCH}"

# Download the binary from github releases
printf "\033[1m\033[36m==>\033[0m\033[1m Downloading siimit...\033[0m\n"
curl -fsSLo "$PKG_PATH" "$PKG_URL"

# Unzip the binary and move it to the install directory
printf "\033[1m\033[36m==>\033[0m\033[1m Extracting siimit...\033[0m\n"
xz -d -c "$PKG_PATH" > "$TEMP_BINARY"
rm -f "$PKG_PATH"

# Install the binary
printf "\033[1m\033[36m==>\033[0m\033[1m Installing siimit...\033[0m\n"
chmod +x "$TEMP_BINARY"
mkdir -p "$INSTALL_DIR"
mv "$TEMP_BINARY" "$INSTALL_DIR/siimit"
printf "\033[1m\033[32m\n✔ Siimit successfully installed!\033[0m\n\n"
printf "    \033[90mVersion: $($INSTALL_DIR/siimit --version)\033[0m\n\n"
printf "    \033[90mLocation: $INSTALL_DIR/siimit\033[0m\n\n"
printf "    \033[90mNext: Run \033[1m\033[36msiimit --help\033[0m to get started.\033[0m\n"

# Detect whether the local bin directory is in the user's PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    printf "\033[1m\033[33m\n⚠ Warning: $INSTALL_DIR is not in your PATH.\033[0m\n"
    printf "    \033[90mYou may want to add the following line to your shell configuration file (e.g., ~/.bashrc, ~/.zshrc):\033[0m\n"
    printf "    \033[90mexport PATH=\"\$PATH:$INSTALL_DIR\"\033[0m\n"
fi
