#!/usr/bin/env bash
set -euo pipefail

OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
  Linux)
    OS_NAME="linux"
    ;;
  Darwin)
    OS_NAME="darwin"
    ;;
  *)
    echo "Unsupported OS: $OS" >&2
    exit 1
    ;;
esac

case "$ARCH" in
  x86_64|amd64)
    ARCH_NAME="x64"
    ;;
  aarch64|arm64)
    ARCH_NAME="arm64"
    ;;
  *)
    echo "Unsupported architecture: $ARCH" >&2
    exit 1
    ;;
esac

# Set the installation directory
BINARY_FILE="dist/siimit-${OS_NAME}-${ARCH_NAME}"
INSTALL_DIR="$HOME/.local/bin"

# Build the binary
printf "\033[1m\033[36m==>\033[0m\033[1m Building Siimit...\033[0m\n"
bun build --compile --minify --target "bun-${OS_NAME}-${ARCH_NAME}" src/index.ts --outfile "$BINARY_FILE" >/dev/null

# Install the binary
printf "\033[1m\033[36m==>\033[0m\033[1m Installing Siimit...\033[0m\n"
chmod +x "$BINARY_FILE"
mkdir -p "$INSTALL_DIR"
mv "$BINARY_FILE" "$INSTALL_DIR/siimit"
printf "\033[1m\033[32m\n✔ Siimit successfully installed!\033[0m\n\n"
printf "    Version: \033[36m$($INSTALL_DIR/siimit --version | sed -E 's/^.*version[[:space:]]+//')\033[0m\n\n"
printf "    Location: \033[36m$INSTALL_DIR/siimit\033[0m\n\n"
printf "Next: Run \033[1m\033[36msiimit --help\033[0m to get started.\n"

# Detect whether the local bin directory is in the user's PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    printf "\033[1m\033[33m\nWarning: $INSTALL_DIR is not in your PATH.\033[0m\n"
    printf "    You may want to add the following line to your shell configuration file (e.g., ~/.bashrc, ~/.zshrc):\n"
    printf "    \033[36mexport PATH=\"\$PATH:$INSTALL_DIR\"\033[0m\n"
fi
