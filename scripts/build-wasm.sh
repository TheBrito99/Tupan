#!/bin/bash

# WASM Build Script
# Phase 20: Compiles Rust manufacturing module to WebAssembly
# Usage: ./build-wasm.sh [release|debug]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Parse arguments
BUILD_TYPE=${1:-release}
OPTIMIZE=${2:-true}

echo -e "${YELLOW}=== Tupan Manufacturing WASM Build ===${NC}"
echo "Build Type: $BUILD_TYPE"
echo "Profile: $OPTIMIZE"
echo ""

# Check if wasm-pack is installed
if ! command -v wasm-pack &> /dev/null; then
    echo -e "${RED}Error: wasm-pack not found. Install with:${NC}"
    echo "  curl https://rustwasm.org/wasm-pack/installer/init.sh -sSf | sh"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "packages/core-rust/Cargo.toml" ]; then
    echo -e "${RED}Error: Cargo.toml not found. Run from project root.${NC}"
    exit 1
fi

cd packages/core-rust

# Clean previous builds if requested
if [ "$3" = "--clean" ]; then
    echo -e "${YELLOW}Cleaning previous builds...${NC}"
    rm -rf pkg/ target/wasm32-unknown-unknown/
fi

# Build WASM module
echo -e "${YELLOW}Building WASM module...${NC}"
echo ""

if [ "$BUILD_TYPE" = "release" ]; then
    # Release build (optimized)
    wasm-pack build \
        --target web \
        --release \
        --out-dir pkg \
        --features wasm

    echo -e "${GREEN}✅ Release build complete${NC}"
else
    # Debug build (faster compilation)
    wasm-pack build \
        --target web \
        --dev \
        --out-dir pkg \
        --features wasm

    echo -e "${GREEN}✅ Debug build complete${NC}"
fi

echo ""
echo -e "${YELLOW}Build Artifacts:${NC}"
ls -lh pkg/

echo ""
echo -e "${GREEN}=== Build Successful ===${NC}"
echo ""
echo "Next steps:"
echo "1. Add to TypeScript imports: import * as Tupan from './tupan_core.js';"
echo "2. Initialize in app: ManufacturingBridge.setWasmModule(Tupan);"
echo "3. WASM module ready at: packages/core-rust/pkg/"
echo ""

# Calculate binary size
WASM_SIZE=$(du -h pkg/tupan_core_bg.wasm | cut -f1)
echo "WASM Binary Size: $WASM_SIZE"
