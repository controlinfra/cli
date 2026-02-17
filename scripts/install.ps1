# Controlinfra CLI installer for Windows
# Usage: iwr -useb https://controlinfra.com/install.ps1 | iex

$ErrorActionPreference = "Stop"

$REPO = "controlinfra/cli"
$INSTALL_DIR = "$env:LOCALAPPDATA\controlinfra"
$BINARY_NAME = "controlinfra.exe"

Write-Host ""
Write-Host "  =======================================" -ForegroundColor Cyan
Write-Host "       Controlinfra CLI Installer        " -ForegroundColor Cyan
Write-Host "       Infrastructure Drift Detection    " -ForegroundColor Cyan
Write-Host "  =======================================" -ForegroundColor Cyan
Write-Host ""

function Get-LatestVersion {
    try {
        $release = Invoke-RestMethod -Uri "https://api.github.com/repos/$REPO/releases/latest"
        return $release.tag_name
    } catch {
        return "v0.1.0"  # Fallback version
    }
}

function Download-Binary {
    param([string]$Version)

    $downloadUrl = "https://github.com/$REPO/releases/download/$Version/controlinfra-win.exe"
    $tempFile = [System.IO.Path]::GetTempFileName() + ".exe"

    Write-Host "Downloading from: $downloadUrl" -ForegroundColor Gray

    try {
        Invoke-WebRequest -Uri $downloadUrl -OutFile $tempFile -UseBasicParsing
        return $tempFile
    } catch {
        Write-Host "Binary download failed: $_" -ForegroundColor Yellow
        return $null
    }
}

function Install-Binary {
    param([string]$TempFile)

    # Create install directory if it doesn't exist
    if (-not (Test-Path $INSTALL_DIR)) {
        New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    }

    $targetPath = Join-Path $INSTALL_DIR $BINARY_NAME

    # Copy binary
    Copy-Item $TempFile $targetPath -Force
    Remove-Item $TempFile -Force

    # Add to PATH if not already there
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
    if ($currentPath -notlike "*$INSTALL_DIR*") {
        Write-Host "Adding $INSTALL_DIR to PATH..." -ForegroundColor Yellow
        [Environment]::SetEnvironmentVariable(
            "Path",
            "$currentPath;$INSTALL_DIR",
            "User"
        )
        $env:Path = "$env:Path;$INSTALL_DIR"
    }

    return $targetPath
}

function Install-ViaNpm {
    Write-Host "Trying npm install as fallback..." -ForegroundColor Yellow

    try {
        $npmPath = Get-Command npm -ErrorAction SilentlyContinue
        if ($npmPath) {
            npm install -g @controlinfra/cli
            return $true
        }
    } catch {
        # npm not available
    }

    Write-Host "npm not found. Please install Node.js or download the binary manually." -ForegroundColor Red
    Write-Host "Download from: https://github.com/$REPO/releases" -ForegroundColor Gray
    return $false
}

function Verify-Installation {
    # Refresh PATH
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                [System.Environment]::GetEnvironmentVariable("Path", "User")

    try {
        $version = & controlinfra --version 2>$null
        Write-Host ""
        Write-Host "Successfully installed controlinfra $version" -ForegroundColor Green
        Write-Host ""
        Write-Host "Get started:" -ForegroundColor White
        Write-Host "  controlinfra login     " -NoNewline -ForegroundColor Cyan
        Write-Host "# Authenticate" -ForegroundColor Gray
        Write-Host "  controlinfra --help   " -NoNewline -ForegroundColor Cyan
        Write-Host "# View all commands" -ForegroundColor Gray
        Write-Host ""
        Write-Host "Note: You may need to restart your terminal for PATH changes to take effect." -ForegroundColor Yellow
        return $true
    } catch {
        Write-Host "Installation verification failed. Please restart your terminal and try 'controlinfra --version'" -ForegroundColor Yellow
        return $true  # Still might be installed, just needs terminal restart
    }
}

# Main installation flow
function Main {
    Write-Host "Detected platform: Windows (x64)" -ForegroundColor Green

    $version = Get-LatestVersion
    Write-Host "Latest version: $version" -ForegroundColor Green
    Write-Host ""
    Write-Host "Installing controlinfra CLI..." -ForegroundColor Cyan

    # Try binary download first
    $tempFile = Download-Binary -Version $version

    if ($tempFile -and (Test-Path $tempFile)) {
        $installedPath = Install-Binary -TempFile $tempFile
        Write-Host "Installed to: $installedPath" -ForegroundColor Gray
        Verify-Installation
    } else {
        # Fallback to npm
        if (Install-ViaNpm) {
            Verify-Installation
        } else {
            exit 1
        }
    }
}

Main