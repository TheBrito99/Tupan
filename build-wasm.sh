#!/bin/bash
# Build script for compiling Rust to WASM

set -e

echo "Building Tupan Core to WASM..."

cd packages/core-rust

# Install wasm-pack if not already installed
if ! command -v wasm-pack &> /dev/null; then
    echo "wasm-pack not found. Installing..."
    curl https://rustwasm.org/wasm-pack/installer/init.sh -sSf | sh
fi

# Build for bundler target (suitable for use with webpack, vite, etc.)
wasm-pack build \
    --target bundler \
    --release \
    --out-dir ../../packages/web-app/src/lib/wasm \
    -- \
    --features "default"

echo "✓ WASM build complete!"
echo "Output: packages/web-app/src/lib/wasm"
echo ""
echo "Generated files:"
ls -lah ../../packages/web-app/src/lib/wasm/

cd ../..
