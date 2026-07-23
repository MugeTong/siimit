#!/usr/bin/env bash
set -euo pipefail

# Check required dependencies
for dependency in xz sha256sum mktemp; do
    if ! command -v "$dependency" &>/dev/null; then
        printf "\033[31merror:\033[0m '%s' is required but not installed.\n" "$dependency"
        exit 1
    fi
done

SYSTEM=$(uname -s)
ARCH=$(uname -m)

PKG_PATH="./dist/siimit-${SYSTEM,,}-${ARCH}.xz"
CHECKSUM_PATH="$PKG_PATH.sha256"
INSTALL_DIR="$HOME/.local/bin"
TEMP_DIR=$(mktemp -d "${TMPDIR:-/tmp}/siimit-install.XXXXXXXX")
TEMP_BINARY="$TEMP_DIR/siimit"
trap 'rm -rf "$TEMP_DIR"' EXIT

# Check if the release files exist
if [ ! -f "$PKG_PATH" ] || [ ! -f "$CHECKSUM_PATH" ]; then
    printf "\033[1m\033[31mSiimit binary not found at\033[0m\n\n"
    printf "    \033[90m $PKG_PATH and $CHECKSUM_PATH\033[0m\n\n"
    printf "Please run \033[1m\033[36mbun run build && bun run package\033[0m first.\n"
    exit 1
fi

# Verify the local release file
printf "\033[1m\033[36m==>\033[0m\033[1m Verifying siimit...\033[0m\n"
(cd "$(dirname "$PKG_PATH")" && sha256sum -c "$(basename "$CHECKSUM_PATH")")

# Unzip the binary and move it to the install directory
printf "\033[1m\033[36m==>\033[0m\033[1m Extracting siimit...\033[0m\n"
xz -d -c "$PKG_PATH" > "$TEMP_BINARY"

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
