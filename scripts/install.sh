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

for dep in xz curl; do
    if ! command -v "$dep" >/dev/null 2>&1; then
        printf "\033[31merror:\033[0m '%s' is required but not installed.\n" "$dep"
        exit 1
    fi
done

PKG_URL="https://github.com/MugeTong/siimit/releases/latest/download/siimit-${OS_NAME}-${ARCH_NAME}.xz"
PKG_PATH="/tmp/siimit-${OS_NAME}-${ARCH_NAME}.xz"
INSTALL_DIR="$HOME/.local/bin"

# Version check
if command -v siimit >/dev/null 2>&1; then
    INSTALLED_VERSION="$(siimit --version | sed -E 's/^.*version[[:space:]]+//')"
    LATEST_VERSION="$(curl -sL https://api.github.com/repos/MugeTong/siimit/releases/latest | grep -oP '"tag_name": "\K(.*)(?=")')"

    # Git tags commonly use a leading "v", while the binary may not.
    INSTALLED_VERSION="${INSTALLED_VERSION#v}"
    LATEST_VERSION="${LATEST_VERSION#v}"

    if [[ "$INSTALLED_VERSION" == "$LATEST_VERSION" ]]; then
        printf "\033[1m\033[32m✔ Siimit is already up-to-date (version %s).\033[0m\n" "$INSTALLED_VERSION"
        exit 0
    else
        printf "\033[36m\nA newer version of Siimit is available (installed: %s, latest: %s).\033[0m\n\n" "$INSTALLED_VERSION" "$LATEST_VERSION"
    fi
fi

# Download and extract the package
printf "\033[1m\033[36m==>\033[0m\033[1m Downloading Siimit...\033[0m\n"
curl -fL --progress-bar -o "$PKG_PATH" "$PKG_URL"

# Extract the package
printf "\033[1m\033[36m==>\033[0m\033[1m Extracting Siimit...\033[0m\n"
mkdir -p "$INSTALL_DIR"
xz -d -c "$PKG_PATH" > "$INSTALL_DIR/siimit"
chmod +x "$INSTALL_DIR/siimit"
rm "$PKG_PATH"
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
