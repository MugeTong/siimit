#!/usr/bin/env bash
set -euo pipefail

# Set the installation directory
BINARY_FILE="dist/siimit-linux-x64"
INSTALL_DIR="$HOME/.local/bin"

# Build the binary
printf "\033[1m\033[36m==>\033[0m\033[1m Building siimit...\033[0m\n"
bun run build > /dev/null 2>&1 &

# Install the binary
printf "\033[1m\033[36m==>\033[0m\033[1m Installing siimit...\033[0m\n"
chmod +x "$BINARY_FILE"
mkdir -p "$INSTALL_DIR"
mv "$BINARY_FILE" "$INSTALL_DIR/siimit"
printf "\033[1m\033[32m\n✔ Siimit successfully installed!\033[0m\n\n"
printf "    \033[90mVersion: $($INSTALL_DIR/siimit --version)\033[0m\n\n"
printf "    \033[90mLocation: $INSTALL_DIR/siimit\033[0m\n\n"
printf "\033[90mNext: Run \033[1m\033[36msiimit --help\033[0m to get started.\033[0m\n"

# Detect whether the local bin directory is in the user's PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    printf "\033[1m\033[33m\n⚠ Warning: $INSTALL_DIR is not in your PATH.\033[0m\n"
    printf "    \033[90mYou may want to add the following line to your shell configuration file (e.g., ~/.bashrc, ~/.zshrc):\033[0m\n"
    printf "    \033[90mexport PATH=\"\$PATH:$INSTALL_DIR\"\033[0m\n"
fi
