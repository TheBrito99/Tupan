# Tupan - Setup & Getting Started Guide

## Quick Start (5 Minutes)

### Step 1: Prerequisites

```bash
# Check Node.js version (need 18+)
node --version

# Check pnpm version (need 8+)
pnpm --version

# Check Rust version (need 1.70+)
rustup --version
rustc --version
```

If anything is missing, install it first:
- **Node.js:** https://nodejs.org/ (v18 or newer)
- **Rust:** https://rustup.rs/
- **pnpm:** `npm install -g pnpm`

### Step 2: Install Dependencies

```bash
cd tupan
pnpm install
```

This installs all dependencies across the monorepo (~3-5 minutes).

### Step 3: Build WASM

**Windows:**
```bash
.\build-wasm.cmd
```

**macOS / Linux:**
```bash
bash ./build-wasm.sh
```

This compiles Rust to WebAssembly (~2-5 minutes first time).

### Step 4: Run Development Server

```bash
cd packages/web-app
pnpm dev
```

Opens http://localhost:5173 automatically. You should see the Tupan UI.

## Detailed Setup Guide

### Step 1: Verify Prerequisites

```bash
# Verify Node.js
$ node --version
v20.10.0  ✓

# Verify pnpm
$ pnpm --version
8.14.0    ✓

# Verify Rust & wasm32 target
$ rustc --version
rustc 1.75.0

$ rustup target list | grep wasm32-unknown-unknown
wasm32-unknown-unknown (installed)  ✓

# Verify wasm-pack
$ wasm-pack --version
wasm-pack 1.3.4  ✓
```

If wasm32 target is not installed:
```bash
rustup target add wasm32-unknown-unknown
rustup update
```

If wasm-pack is not installed:
```bash
curl https://rustwasm.org/wasm-pack/installer/init.sh -sSf | sh
```

### Step 2: Clone Repository

```bash
git clone <repository-url> tupan
cd tupan
```

### Step 3: Install Dependencies

```bash
# Install root-level tools
pnpm install
```

**Output should look like:**
```
 ✓ 342 packages installed
 WARN  6 deprecated packages found
```

### Step 4: Build WASM Module

#### Windows:
```bash
.\build-wasm.cmd

# Output:
# Building Tupan Core to WASM...
# Compiling Rust to WebAssembly...
# ✓ WASM build complete!
# Output: packages\web-app\src\lib\wasm
```

#### macOS/Linux:
```bash
bash ./build-wasm.sh

# Output:
# Building Tupan Core to WASM...
# Compiling Rust to WebAssembly...
# ✓ WASM build complete!
# Output: packages/web-app/src/lib/wasm
```

**Verify build succeeded:**
```bash
# Windows
dir packages\web-app\src\lib\wasm

# macOS/Linux
ls -lah packages/web-app/src/lib/wasm

# You should see:
# - tupan_core.js
# - tupan_core.d.ts
# - tupan_core_bg.wasm
# - tupan_core_bg.wasm.d.ts
# - package.json
```

### Step 5: Start Development Server

```bash
# Enter web app directory
cd packages/web-app

# Start dev server
pnpm dev

# Should output:
#   VITE v5.0.0  ready in 234 ms
#   ➜  Local:   http://localhost:5173/
#   ➜  press h to show help
```

Browser should open automatically to http://localhost:5173.

### Step 6: Verify Application

In your browser at http://localhost:5173:
- ✓ Header shows "Tupan" with subtitle
- ✓ Purple gradient background
- ✓ Node editor canvas visible
- ✓ No console errors (press F12 to check)

If you see errors:
```javascript
// In browser console
// Check GraphBridge initialization
await window.bridge?.initialize?.()
```

## Troubleshooting

### Issue: "wasm-pack command not found"

**Windows:**
```bash
# Install wasm-pack
curl https://rustwasm.org/wasm-pack/installer/init.sh -sSf | sh
```

**macOS/Linux:**
```bash
# Install wasm-pack
curl https://rustwasm.org/wasm-pack/installer/init.sh -sSf | sh
```

### Issue: "wasm32-unknown-unknown target not found"

```bash
rustup target add wasm32-unknown-unknown
```

### Issue: "Cannot find module '@tupan/core-rust'"

The WASM module wasn't built.

```bash
# From project root
.\build-wasm.cmd  # Windows
bash ./build-wasm.sh  # macOS/Linux

# Then restart dev server
cd packages/web-app
pnpm dev
```

### Issue: "Port 5173 already in use"

```bash
# Use different port
pnpm dev -- --port 5174

# Or kill process using port 5173:
# Windows: netstat -ano | findstr :5173
# macOS/Linux: lsof -ti :5173 | xargs kill -9
```

### Issue: "Out of memory during build"

If you get OOM errors during WASM compilation:

```bash
# Use single-threaded build
cd packages/core-rust
cargo build --target wasm32-unknown-unknown --release -j 1
```

### Issue: WASM loads but graph operations fail

Check browser console (F12) for error details.

```javascript
// In browser console
const bridge = new GraphBridge();
await bridge.initialize();
// Check if initialized successfully
bridge.isInitialized()  // Should be true
```

## Project Structure

After successful setup, you have:

```
tupan/
├── packages/
│   ├── core-rust/          # Rust computation engine
│   │   └── src/graph/      # Core abstraction
│   ├── core-ts/            # TypeScript wrappers
│   ├── ui-framework/       # React components
│   ├── web-app/            # Main app (running on :5173)
│   └── simulators/         # Domain-specific apps
├── docs/
│   ├── CLAUDE_CONTEXT.md   # Quick reference
│   ├── ARCHITECTURE.md     # Design docs
│   └── WASM_BUILD.md       # WASM details
└── build-wasm.cmd/sh       # Build scripts
```

## Useful Development Commands

```bash
# From project root

# Build everything
pnpm build

# Build just WASM
pnpm build:wasm:windows    # or :unix

# Run tests
pnpm test

# Format code
pnpm format

# Generate documentation
pnpm docs:generate

# Watch and rebuild on changes
cargo watch -x 'build --target wasm32-unknown-unknown --release'
```

## Development Workflow

### Basic Workflow

```bash
# Terminal 1: Watch Rust changes
cd packages/core-rust
cargo watch -x 'build --target wasm32-unknown-unknown --release'

# Terminal 2: Run web app
cd packages/web-app
pnpm dev

# Now:
# 1. Edit Rust code in packages/core-rust/src/
# 2. Cargo rebuilds automatically
# 3. Refresh browser to load new WASM
# 4. Test changes
```

### Adding a New Node Type

1. **Edit Rust:**
   ```rust
   // packages/core-rust/src/domains/electrical/components.rs
   pub enum ElectricalComponent {
       Inductor { inductance: f64 },  // NEW
   }
   ```

2. **Rebuild WASM:**
   ```bash
   cargo build --target wasm32-unknown-unknown --release
   ```

3. **Update TypeScript:**
   ```typescript
   // packages/ui-framework/src/components/NodeEditor/NodeEditor.tsx
   nodeTypes.set('inductor', {
     name: 'Inductor',
     category: 'Electrical',
     color: '#FF5722'
   })
   ```

4. **Test in browser:**
   - Refresh page
   - New component appears in toolbar

## Next Steps

After successful setup:

1. **Explore the codebase:**
   - Read [CLAUDE_CONTEXT.md](docs/CLAUDE_CONTEXT.md) (5 min)
   - Read [ARCHITECTURE.md](docs/ARCHITECTURE.md) (15 min)

2. **Try adding a component:**
   - Add an `Inductor` to electrical domain
   - See it appear in the UI

3. **Run tests:**
   ```bash
   pnpm test
   ```

4. **Continue with Phase 2:**
   - Implement electrical circuit simulator
   - Create Modified Nodal Analysis solver
   - Add first circuit simulation

## Getting Help

- **Architecture questions:** See [ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **WASM build issues:** See [WASM_BUILD.md](docs/WASM_BUILD.md)
- **Quick reference:** See [CLAUDE_CONTEXT.md](docs/CLAUDE_CONTEXT.md)
- **Check browser console:** Press F12 for errors/warnings

## System Requirements Summary

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | 18+ | JavaScript runtime |
| pnpm | 8+ | Package manager |
| Rust | 1.70+ | Compilation |
| wasm-pack | Latest | WASM compilation |
| Disk Space | 2GB | Node modules + builds |
| RAM | 4GB+ | Compilation |

## Common Questions

**Q: Do I need to rebuild WASM every time?**
A: No, only when you modify Rust code. Use `cargo watch` for automatic rebuilds during development.

**Q: Can I use npm instead of pnpm?**
A: Not recommended. The project uses pnpm workspaces. Use pnpm.

**Q: What's the typical build time?**
A: First WASM build: 3-5 minutes. Subsequent: 30 seconds - 2 minutes depending on changes.

**Q: Can I develop just the UI without WASM?**
A: Yes, the local TypeScript Graph works without WASM. WASM is needed for simulation.

**Q: How do I update dependencies?**
A: `pnpm update` for all packages, or `pnpm -r add package@latest` for specific ones.

---

**Successfully set up?** Congratulations! You're ready to develop Tupan. Start with Phase 2: Electrical Circuit Simulator.

**Issues?** Check the Troubleshooting section or [WASM_BUILD.md](docs/WASM_BUILD.md) for detailed WASM debugging.
