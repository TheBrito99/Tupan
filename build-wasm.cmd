@echo off
REM Build script for compiling Rust to WASM (Windows)

setlocal enabledelayedexpansion

echo Building Tupan Core to WASM...

cd packages\core-rust

REM Check if wasm-pack is installed
where wasm-pack >nul 2>nul
if errorlevel 1 (
    echo wasm-pack not found. Installing...
    curl https://rustwasm.org/wasm-pack/installer/init.sh -sSf | sh
    if errorlevel 1 (
        echo Failed to install wasm-pack. Please install manually: https://rustwasm.org/wasm-pack/installer/
        exit /b 1
    )
)

REM Build for bundler target
echo Compiling Rust to WebAssembly...
wasm-pack build ^
    --target bundler ^
    --release ^
    --out-dir ..\..\packages\web-app\src\lib\wasm ^
    -- ^
    --features "default"

if errorlevel 1 (
    echo Build failed!
    cd ..\..
    exit /b 1
)

echo.
echo + WASM build complete!
echo + Output: packages\web-app\src\lib\wasm
echo.
echo Generated files:
dir /s ..\..\packages\web-app\src\lib\wasm

cd ..\..
