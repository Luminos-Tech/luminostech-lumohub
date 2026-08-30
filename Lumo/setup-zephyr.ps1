param(
    [string]$ZephyrVersion = "v4.2.0",
    [string]$SdkVersion = "0.17.0",
    [switch]$SkipSdk
)

$ErrorActionPreference = "Stop"
$lumoRoot = $PSScriptRoot
$venvDir = Join-Path $lumoRoot ".venv"
$workspaceDir = $lumoRoot
$zephyrSource = Join-Path $lumoRoot "zephyr-source"
$python = "C:\Espressif\python_env\idf5.5_py3.11_env\Scripts\python.exe"

if (-not (Test-Path $python)) {
    throw "Bootstrap Python not found at $python. Install a Python 3.11 runtime first."
}

if (-not (Test-Path (Join-Path $venvDir "Scripts\python.exe"))) {
    & $python -m venv $venvDir
}

$venvPython = Join-Path $venvDir "Scripts\python.exe"
$westExe = Join-Path $venvDir "Scripts\west.exe"

& $venvPython -m pip install --upgrade pip west py7zr

if (-not (Test-Path (Join-Path $zephyrSource "west.yml"))) {
    & git clone --depth 1 --branch $ZephyrVersion https://github.com/zephyrproject-rtos/zephyr.git $zephyrSource
}

Set-Location $workspaceDir
if (-not (Test-Path (Join-Path $workspaceDir ".west\config"))) {
    & $westExe init -l $zephyrSource
} else {
    Write-Host "West workspace already exists: $workspaceDir"
}

# Pull only modules required by the ESP32-C3 BLE application. Running the
# upstream manifest's full update would also download unrelated RTOS ports.
& $westExe update hal_espressif mbedtls mcuboot
& $westExe blobs fetch hal_espressif
# The aggregate requirements file includes test/compliance tooling. Firmware
# builds only need the base west/build dependencies.
& $venvPython -m pip install -r (Join-Path $zephyrSource "scripts\requirements-base.txt")

if (-not $SkipSdk) {
    $userRoot = [Environment]::GetFolderPath("UserProfile")
    $sdkDir = Join-Path $userRoot "zephyr-sdk-$SdkVersion"
    $sdkArchive = Join-Path $env:TEMP "zephyr-sdk-$SdkVersion`_windows-x86_64_minimal.7z"
    $riscvArchive = Join-Path $env:TEMP "toolchain_windows-x86_64_riscv64-zephyr-elf-$SdkVersion.7z"

    if (-not (Test-Path (Join-Path $sdkDir "setup.cmd"))) {
        if (-not (Test-Path $sdkArchive)) {
            Invoke-WebRequest `
                -Uri "https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v$SdkVersion/zephyr-sdk-$SdkVersion`_windows-x86_64_minimal.7z" `
                -OutFile $sdkArchive
        }
        # py7zr is installed in the project venv, so no machine-wide archive
        # utility or administrator prompt is needed.
        & $venvPython -m py7zr x $sdkArchive $userRoot
    }

    # The full SDK is over 1 GB. Only the RISC-V toolchain is needed by this
    # ESP32-C3 project, so download its standalone package instead.
    if (-not (Test-Path (Join-Path $sdkDir "riscv64-zephyr-elf\riscv64-zephyr-elf\bin\riscv64-zephyr-elf-gcc.exe"))) {
        if (-not (Test-Path $riscvArchive)) {
            Invoke-WebRequest `
                -Uri "https://github.com/zephyrproject-rtos/sdk-ng/releases/download/v$SdkVersion/toolchain_windows-x86_64_riscv64-zephyr-elf.7z" `
                -OutFile $riscvArchive
        }
        & $venvPython -m py7zr x $riscvArchive $sdkDir
    }

    $cmake = "C:\Espressif\tools\cmake\3.30.2\bin\cmake.exe"
    if (Test-Path $cmake) {
        & $cmake -P (Join-Path $sdkDir "cmake\zephyr_sdk_export.cmake")
    }
    [Environment]::SetEnvironmentVariable("ZEPHYR_SDK_INSTALL_DIR", $sdkDir, "User")
}

# Make west usable from a fresh terminal without another activation command.
$westScripts = Join-Path $venvDir "Scripts"
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($userPath -notlike "*$westScripts*") {
    $newUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) {
        $westScripts
    } else {
        "$westScripts;$userPath"
    }
    [Environment]::SetEnvironmentVariable("Path", $newUserPath, "User")
}
[Environment]::SetEnvironmentVariable("WEST_TOPDIR", $workspaceDir, "User")
[Environment]::SetEnvironmentVariable("ZEPHYR_BASE", $zephyrSource, "User")
[Environment]::SetEnvironmentVariable("ZEPHYR_TOOLCHAIN_VARIANT", "zephyr", "User")

$env:Path = "$westScripts;$env:Path"
$env:WEST_TOPDIR = $workspaceDir
$env:ZEPHYR_BASE = $zephyrSource
$env:ZEPHYR_TOOLCHAIN_VARIANT = "zephyr"

Write-Host ""
Write-Host "Zephyr setup complete." -ForegroundColor Green
Write-Host "Use: Set-Location '$lumoRoot\Lumo-Band'; west build -b esp32c3_supermini -d build" -ForegroundColor Cyan
