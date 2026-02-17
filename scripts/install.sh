#!/bin/bash
# Controlinfra CLI installer for Linux/macOS
# Usage: curl -fsSL https://controlinfra.com/cli/install.sh | bash

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

REPO="controlinfra/cli"
INSTALL_DIR="/usr/local/bin"
BINARY_NAME="controlinfra"

echo -e "${CYAN}"
echo "  ╔═══════════════════════════════════════════╗"
echo "  ║     Controlinfra CLI Installer            ║"
echo "  ║     Infrastructure Drift Detection        ║"
echo "  ╚═══════════════════════════════════════════╝"
echo -e "${NC}"

# Detect OS and Architecture
detect_platform() {
    OS="$(uname -s)"
    ARCH="$(uname -m)"

    case "$OS" in
        Linux*)
            OS="linux"
            ;;
        Darwin*)
            OS="macos"
            ;;
        CYGWIN*|MINGW*|MSYS*)
            echo -e "${RED}For Windows, please use the PowerShell installer:${NC}"
            echo "  iwr -useb https://controlinfra.com/install.ps1 | iex"
            exit 1
            ;;
        *)
            echo -e "${RED}Unsupported operating system: $OS${NC}"
            exit 1
            ;;
    esac

    case "$ARCH" in
        x86_64|amd64)
            ARCH="x64"
            ;;
        arm64|aarch64)
            ARCH="arm64"
            ;;
        *)
            echo -e "${RED}Unsupported architecture: $ARCH${NC}"
            exit 1
            ;;
    esac

    PLATFORM="${OS}"
    if [ "$ARCH" = "arm64" ]; then
        PLATFORM="${OS}-arm64"
    fi

    echo -e "${GREEN}Detected platform: ${OS} (${ARCH})${NC}"
}

# Get latest release version (returns empty if no releases exist)
get_latest_version() {
    VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
    if [ -n "$VERSION" ]; then
        echo -e "${GREEN}Latest version: ${VERSION}${NC}"
    fi
}

# Download binary
download_binary() {
    DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/controlinfra-${PLATFORM}"
    TMP_FILE=$(mktemp)

    echo -e "${CYAN}Downloading from: ${DOWNLOAD_URL}${NC}" >&2

    local download_exit=0
    if command -v curl &> /dev/null; then
        curl -fsSL "$DOWNLOAD_URL" -o "$TMP_FILE" || download_exit=$?
    elif command -v wget &> /dev/null; then
        wget -q "$DOWNLOAD_URL" -O "$TMP_FILE" || download_exit=$?
    else
        echo -e "${RED}Error: curl or wget is required${NC}" >&2
        rm -f "$TMP_FILE"
        return 1
    fi

    if [ "$download_exit" -ne 0 ] || [ ! -s "$TMP_FILE" ]; then
        echo -e "${RED}Binary download failed (exit code: ${download_exit})${NC}" >&2
        rm -f "$TMP_FILE"
        return 1
    fi

    echo "$TMP_FILE"
}

# Install binary
install_binary() {
    TMP_FILE=$1

    # Check if we need sudo
    if [ -w "$INSTALL_DIR" ]; then
        mv "$TMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"
        chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    else
        echo -e "${YELLOW}Installing to ${INSTALL_DIR} requires sudo access${NC}"
        if ! sudo mv "$TMP_FILE" "${INSTALL_DIR}/${BINARY_NAME}"; then
            echo -e "${RED}Failed to install binary to ${INSTALL_DIR}. Try running with sudo.${NC}"
            rm -f "$TMP_FILE"
            return 1
        fi
        sudo chmod +x "${INSTALL_DIR}/${BINARY_NAME}"
    fi
}

# Verify installation
verify_installation() {
    if command -v "$BINARY_NAME" &> /dev/null; then
        INSTALLED_VERSION=$("$BINARY_NAME" --version 2>/dev/null || echo "unknown")
        echo ""
        echo -e "${GREEN}Successfully installed controlinfra ${INSTALLED_VERSION}${NC}"
        echo ""
        echo -e "Get started:"
        echo -e "  ${CYAN}controlinfra login${NC}     # Authenticate"
        echo -e "  ${CYAN}controlinfra --help${NC}   # View all commands"
        echo ""
    else
        echo -e "${RED}Installation failed. Please check the error messages above.${NC}"
        exit 1
    fi
}

# Main installation flow
main() {
    detect_platform
    get_latest_version

    if [ -z "$VERSION" ]; then
        echo -e "${RED}No releases found. Please check https://github.com/${REPO}/releases${NC}"
        exit 1
    fi

    echo ""
    echo -e "${CYAN}Installing controlinfra CLI...${NC}"

    TMP_FILE=""
    if ! TMP_FILE=$(download_binary); then
        echo -e "${RED}Installation failed. Download the binary manually from:${NC}"
        echo -e "  https://github.com/${REPO}/releases"
        exit 1
    fi

    if ! install_binary "$TMP_FILE"; then
        echo -e "${RED}Installation failed. Try running the script with sudo:${NC}"
        echo -e "  curl -fsSL https://controlinfra.com/cli/install.sh | sudo bash"
        exit 1
    fi

    verify_installation
}

main
