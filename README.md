# Tupan - Mechatronics Engineering Platform

> A comprehensive web-based platform for simulating and visualizing complex mechatronic systems.

![Phase](https://img.shields.io/badge/Phase-Early%20Development%20(1a)-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Status-Foundation%20Layer-orange)

## Overview

Tupan is built on a **unified graph abstraction** where all types of engineering simulations (electrical circuits, thermal networks, mechanical systems, hydraulic systems, block diagrams, state machines, etc.) are represented as directed graphs with typed nodes and edges.

### Key Features (Planned)

- 🔌 **Multi-Domain Simulators**
  - Electrical circuits (DC, AC, transient)
  - Thermal networks (heat transfer, thermodynamics)
  - Mechanical systems (rigid body, FEA, stress analysis)
  - Hydraulic/Pneumatic systems (with thermodynamics)
  - Magnetic circuits
  - Chemical reactions (for P&ID)

- 🎨 **Visual Programming**
  - Simulink-like block diagrams
  - Bond graphs (unified physics)
  - State machines & Petri nets
  - Node-RED style flow-based programming
  - P&ID diagrams

- 🧮 **Advanced Mathematics**
  - Computer Algebra System (symbolic math)
  - Intelligent graph visualization
  - Automatic plot suggestions (Bode, phase portrait, etc.)
  - Transfer function analysis

- ⚡ **Performance**
  - Rust-based computation engine (compiled to WASM)
  - GPU-accelerated visualizations
  - 60 FPS UI, millisecond simulation steps
  - Support for 1000+ node networks

- 🏗️ **Clean Architecture**
  - DRY principle (reusable components)
  - SOLID design principles
  - Self-documenting code
  - Extensible via plugins (future)

## Architecture

```
User Interface (React)
        ↕ WASM
Application Layer (TypeScript)
        ↕ WASM Interop
Computation Core (Rust)
```

**Why this approach?**
- Rust handles heavy computation (safety + performance)
- TypeScript handles UI and coordination (development speed + type safety)
- Web-based means no installation, instant updates, easy collaboration

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm 8+
- Rust 1.70+ (for development)

### Installation

```bash
# Clone repository
git clone <repo>
cd tupan

# Install dependencies
pnpm install

# Start development server
cd packages/web-app
pnpm dev
```

Then open `http://localhost:5173` in your browser.

## Project Structure

```
tupan/
├── packages/
│   ├── core-rust/           # Rust computation engine
│   ├── core-ts/             # TypeScript wrappers
│   ├── ui-framework/        # Shared React components
│   ├── simulators/          # Domain-specific simulators
│   └── web-app/             # Main application
├── docs/
│   ├── CLAUDE_CONTEXT.md    # Quick reference
│   ├── ARCHITECTURE.md      # Detailed architecture
│   └── DOMAIN_MODELS.md     # Physics documentation
└── tools/                   # Build and utilities
```

For detailed project structure, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md).

## Development

### Building

```bash
# Build all packages
pnpm build

# Build specific package
cd packages/core-rust && cargo build --release
cd packages/web-app && pnpm build
```

### Testing

```bash
# Run all tests
pnpm test

# Run specific test suite
pnpm test:watch
```

### Code Quality

```bash
# Format code
pnpm format

# Lint
pnpm lint

# Generate documentation
pnpm docs:generate
```

## Key Concepts

### Unified Graph Abstraction

All simulators use the same underlying graph structure:
- **Nodes** = Components (resistors, blocks, states, etc.)
- **Edges** = Connections (wires, data flows, transitions)
- **Ports** = Typed inputs/outputs (electrical, thermal, mechanical, etc.)

This enables:
- Reusable solvers across domains
- Multi-domain coupling
- Generic visual editor for all simulator types

### Bond Graphs

All physical domains are converted to **bond graphs** for unified solving:
- Electrical circuits ← bonds with V/I variables
- Thermal networks ← bonds with T/Q variables
- Mechanical systems ← bonds with F/v variables
- Hydraulic systems ← bonds with P/Q variables

**Why?** Bond graphs unify these very different physical systems under one mathematical framework.

### Two-Layer Computation

1. **Rust Layer** (core-rust)
   - Graph engine
   - Numerical solvers
   - Domain physics
   - Symbolic mathematics

2. **TypeScript Layer** (core-ts, ui-framework, web-app)
   - Graph visualization
   - User interaction
   - WASM bridge
   - Visualization

## Documentation

- 📖 [CLAUDE_CONTEXT.md](./docs/CLAUDE_CONTEXT.md) - Quick reference for developers
- 🏗️ [ARCHITECTURE.md](./docs/ARCHITECTURE.md) - Detailed system design
- ⚗️ [DOMAIN_MODELS.md](./docs/DOMAIN_MODELS.md) - Physics and mathematical models

## Roadmap

### Phase 1: Foundation (Current)
- ✅ Graph abstraction
- ✅ Core UI framework
- ⏳ WASM compilation
- ⏳ End-to-end testing

### Phase 2: First Simulator
- Electrical circuit simulator
- Modified Nodal Analysis solver
- Circuit editor UI

### Phase 3: Bond Graph Unification
- Bond graph engine
- Thermal simulator
- Unified multi-domain solving

### Phase 4-5: Domain Expansion
- Hydraulic/pneumatic simulators
- Mechanical simulator
- Block diagrams

### Phase 6+: Advanced Features
- State machines & Petri nets
- Flow-based programming
- Symbolic math engine
- FEA and stress analysis
- P&ID diagrams

## Contributing

Contributions welcome! Please:

1. Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) to understand design
2. Follow SOLID principles and DRY architecture
3. Add tests for new code
4. Update documentation
5. Submit PR with clear description

## Design Principles

- **DRY** (Don't Repeat Yourself)
- **Clean Architecture** (clear separation of concerns)
- **SOLID** (Single Responsibility, Open/Closed, etc.)
- **Type Safety** (TypeScript + Rust)
- **Performance First** (60 FPS UI, millisecond simulations)
- **Self-Documenting** (code + auto-generated docs)

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript 5** - Type safety
- **Zustand** - State management
- **Vite** - Build tool

### Backend/Computation
- **Rust** - Computation engine
- **wasm-pack** - WASM compilation
- **nalgebra** - Linear algebra
- **petgraph** - Graph algorithms

### Development
- **pnpm** - Package manager
- **Turbo** - Monorepo orchestration
- **Vitest** - Testing framework

## Performance Targets

- Simulation step: < 1ms for 100-node circuit
- WASM load time: < 500ms
- UI frame rate: 60 FPS during navigation
- Memory usage: < 500MB for typical simulation

## License

MIT

## Contact & Support

- 📧 Email: (to be added)
- 💬 Discussions: (to be added)
- 🐛 Issues: Use GitHub issues

---

**Current Version:** 0.1.0 (Foundation Layer - Early Development)

**Last Updated:** 2026-03-18

For more information, see [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) and [docs/CLAUDE_CONTEXT.md](./docs/CLAUDE_CONTEXT.md).
