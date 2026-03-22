@echo off
REM WASM Build Script (Windows)
REM Phase 20: Compiles Rust manufacturing module to WebAssembly
REM Usage: build-wasm.bat [release^|debug]

setlocal enabledelayedexpansion

REM Colors using ANSI escape codes (Windows 10+)
set GREEN=[92m
set YELLOW=[93m
set RED=[91m
set RESET=[0m

REM Parse arguments
set BUILD_TYPE=release
if not "%1"=="" set BUILD_TYPE=%1

set OPTIMIZE=true
if "%BUILD_TYPE%"=="debug" set OPTIMIZE=false

echo %YELLOW%=== Tupan Manufacturing WASM Build ===%RESET%
echo Build Type: %BUILD_TYPE%
echo Profile: %OPTIMIZE%
echo.

REM Check if wasm-pack is installed
where wasm-pack >nul 2>nul
if errorlevel 1 (
    echo %RED%Error: wasm-pack not found. Install with:%RESET%
    echo   curl https://rustwasm.org/wasm-pack/installer/init.sh -sSf ^| sh
    echo   OR use: cargo install wasm-pack
    exit /b 1
)

REM Check if we're in the right directory
if not exist "packages\core-rust\Cargo.toml" (
    echo %RED%Error: Cargo.toml not found. Run from project root.%RESET%
    exit /b 1
)

cd packages\core-rust

REM Clean previous builds if requested
if "%2"=="--clean" (
    echo %YELLOW%Cleaning previous builds...%RESET%
    if exist pkg\ rmdir /s /q pkg
    if exist target\wasm32-unknown-unknown\ rmdir /s /q target\wasm32-unknown-unknown
)

REM Build WASM module
echo %YELLOW%Building WASM module...%RESET%
echo.

if "%BUILD_TYPE%"=="release" (
    REM Release build (optimized)
    wasm-pack build ^
        --target web ^
        --release ^
        --out-dir pkg ^
        --features wasm

    if errorlevel 1 (
        echo %RED%Build failed!%RESET%
        exit /b 1
    )

    echo %GREEN%✅ Release build complete%RESET%
) else (
    REM Debug build (faster compilation)
    wasm-pack build ^
        --target web ^
        --dev ^
        --out-dir pkg ^
        --features wasm

    if errorlevel 1 (
        echo %RED%Build failed!%RESET%
        exit /b 1
    )

    echo %GREEN%✅ Debug build complete%RESET%
)

echo.
echo %YELLOW%Build Artifacts:%RESET%
dir /s pkg\

echo.
echo %GREEN%=== Build Successful ===%RESET%
echo.
echo Next steps:
echo 1. Add to TypeScript imports: import * as Tupan from './tupan_core.js';
echo 2. Initialize in app: ManufacturingBridge.setWasmModule(Tupan);
echo 3. WASM module ready at: packages\core-rust\pkg\
echo.

REM Calculate binary size
for %%A in (pkg\tupan_core_bg.wasm) do (
    set "WASM_SIZE=%%~zA"
    echo WASM Binary Size: !WASM_SIZE! bytes
)

cd ../..
endlocal
