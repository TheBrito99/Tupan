# WASM Build and Integration Guide

**Status:** Phase 1b - WASM Build Pipeline Setup

## Overview

This document explains how to build the Rust code to WebAssembly (WASM) and integrate it with the TypeScript application.

## Prerequisites

1. **Rust toolchain** - Install from https://rustup.rs/
   ```bash
   rustup update
   rustup target add wasm32-unknown-unknown
   ```

2. **wasm-pack** - Install from https://rustwasm.org/wasm-pack/
   ```bash
   curl https://rustwasm.org/wasm-pack/installer/init.sh -sSf | sh
   ```

3. **Node.js & pnpm** - Already installed for TypeScript development

## Building WASM

### Windows

```bash
# From project root
pnpm build:wasm:windows

# Or manually:
.\build-wasm.cmd
```

### macOS / Linux

```bash
# From project root
pnpm build:wasm:unix

# Or manually:
bash ./build-wasm.sh
```

### What Happens

1. **wasm-pack** compiles Rust to WASM:
   - Target: `wasm32-unknown-unknown` (browser-compatible)
   - Optimization: Optimized for size (-z flag)
   - Output: `packages/web-app/src/lib/wasm/`

2. **Generated files:**
   ```
   packages/web-app/src/lib/wasm/
   ├── package.json           # WASM package metadata
   ├── tupan_core.js          # JavaScript wrapper
   ├── tupan_core.d.ts        # TypeScript definitions
   ├── tupan_core_bg.wasm     # Actual WASM binary
   └── tupan_core_bg.wasm.d.ts # Background module types
   ```

3. **Build output:** ~200-300 KB (gzipped ~60-80 KB)

## WASM Architecture

### Rust Side (Computation)

```rust
// packages/core-rust/src/wasm.rs

#[wasm_bindgen]
pub struct WasmGraph {
    inner: Graph,
}

#[wasm_bindgen]
impl WasmGraph {
    pub fn new() -> Self { ... }
    pub fn add_node(&mut self, node_json: &str) -> Result<String, JsValue> { ... }
    pub fn simulate(&mut self) -> Result<String, JsValue> { ... }
    // ... etc
}
```

**Key Points:**
- All WASM-exposed functions use `#[wasm_bindgen]` attribute
- All data serialized/deserialized as JSON (safe WASM boundary crossing)
- Return types are `Result<String, JsValue>` (JS-compatible)

### TypeScript Side (Integration)

```typescript
// packages/core-ts/src/wasm-bridge/GraphBridge.ts

export class GraphBridge {
  private wasmGraph: any;
  private graph: Graph;

  async initialize() {
    const wasmModule = await import('../../lib/wasm/tupan_core');
    this.wasmGraph = new wasmModule.WasmGraph();
  }

  addNode(nodeType: string): NodeId {
    this.graph.addNode(...);           // Local
    this.wasmGraph.add_node(...);      // WASM
  }
}
```

**Dual Sync:**
- Local TypeScript `Graph` always mirrors WASM state
- Any change syncs to both
- Can compute in WASM, display in TS

## Data Flow

```
User Input (React)
    ↓
GraphBridge.addNode()
    ↓
├─ this.graph.addNode()     (TypeScript)
└─ this.wasmGraph.add_node() (Rust/WASM)
    ↓
JSON Serialization ← WASM Boundary →
    ↓
Both in sync
```

## Compilation Flow

```
Rust Code (.rs files)
    ↓
rustc + LLVM (to wasm32 target)
    ↓
WASM Binary (.wasm)
    ↓
wasm-bindgen (JavaScript wrapper generation)
    ↓
WASM Module (.js, .d.ts, .wasm)
    ↓
Bundled by Vite/Webpack
    ↓
Browser loads at runtime
```

## Build Integration with Vite

The web app uses **Vite** for development and building.

### Development Workflow

```bash
# Terminal 1: Build WASM on changes
cargo watch -x 'build --target wasm32-unknown-unknown --release'

# Terminal 2: Run Vite dev server
cd packages/web-app
pnpm dev
```

### Production Build

```bash
# From root
pnpm build

# This runs:
# 1. build:wasm → Compiles Rust to WASM
# 2. turbo build → Builds all TS packages
```

## Common Issues

### Issue: "Cannot find module '@tupan/core-rust'"

**Cause:** WASM not built yet

**Solution:**
```bash
pnpm build:wasm:windows  # or :unix
```

### Issue: "WASM module initialization failed"

**Cause:** WASM module didn't load (network error, wrong path)

**Solution:**
```bash
# Check WASM files exist
ls packages/web-app/src/lib/wasm/

# Rebuild
pnpm build:wasm:windows
```

### Issue: "TypeError: Cannot read property 'WasmGraph' of undefined"

**Cause:** WASM module didn't initialize

**Solution:**
```typescript
// Always initialize first
await bridge.initialize();

// Then use
bridge.addNode(...);
```

## Performance Considerations

### WASM Load Time
- Initial load: ~200-500ms (one-time)
- Compiled to bytecode: Very fast execution
- No JIT compilation needed (deterministic perf)

### JSON Serialization Overhead
- Each function call serializes parameters to JSON
- For small graphs (<100 nodes): Negligible
- For large graphs (>10k nodes): Consider batch operations

### Optimization Strategies
- Batch operations to reduce JSON serialization overhead
- Keep hot paths in WASM (computation)
- Keep UI updates in TypeScript (rendering)

## Testing WASM Integration

### Unit Tests (TypeScript)

```bash
cd packages/core-ts
pnpm test
```

### Integration Tests

```typescript
// Test from core-ts/__tests__/GraphBridge.test.ts
import { GraphBridge } from '../wasm-bridge/GraphBridge';

it('should create nodes', async () => {
  const bridge = new GraphBridge();
  const nodeId = bridge.addNode('resistor');
  expect(nodeId).toBeDefined();
});
```

### Manual Testing (Browser)

```typescript
// In browser console (after pnpm dev)
const bridge = new GraphBridge();
await bridge.initialize();

const n1 = bridge.addNode('resistor');
const n2 = bridge.addNode('capacitor');
console.log(bridge.getGraph().nodeCount()); // 2
```

## Next Steps

1. **Build WASM:** Run `pnpm build:wasm:windows`
2. **Test Integration:** Run `pnpm test` in core-ts
3. **Start Dev Server:** `cd packages/web-app && pnpm dev`
4. **Verify in Browser:** Check browser console for errors
5. **Implement Simulation:** Add solver integration to WASM

## Useful Commands

```bash
# Quick rebuild (cargo only, no wasm-pack)
cd packages/core-rust
cargo build --target wasm32-unknown-unknown --release

# Watch for changes
cargo watch -x 'build --target wasm32-unknown-unknown --release'

# Check WASM output
ls -lah packages/web-app/src/lib/wasm/

# Inspect WASM module
wasm2wat packages/web-app/src/lib/wasm/tupan_core_bg.wasm > module.wat

# Profile WASM size
twiggy packages/web-app/src/lib/wasm/tupan_core_bg.wasm
```

## Architecture Diagram

```
TypeScript Layer
┌─────────────────────────┐
│  React UI               │
│  (components)           │
└────────────┬────────────┘
             │
             ↓
┌─────────────────────────┐
│  GraphBridge            │
│  (WASM interop)         │
└────────────┬────────────┘
             │ JSON
             ↓
         WASM Boundary
             │
             ↓
┌─────────────────────────┐
│  Rust WASM Module       │
│  (computation)          │
│  - Graph engine         │
│  - Solvers              │
│  - Physics domains      │
└─────────────────────────┘
```

## References

- [wasm-bindgen Book](https://rustwasm.org/docs/wasm-bindgen/)
- [wasm-pack Guide](https://rustwasm.org/docs/wasm-pack/)
- [Rust WASM Best Practices](https://rustwasm.org/docs/wasm/reference/optimized-builds/)
- [MDN WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly)

---

**Last Updated:** 2026-03-18
**Phase:** 1b - WASM Integration
