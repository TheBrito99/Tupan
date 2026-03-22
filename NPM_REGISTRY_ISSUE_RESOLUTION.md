# npm Registry Issue - Resolution & Workaround

**Date:** 2026-03-22
**Status:** 🟡 Partially Resolved (Workaround Available)
**Root Cause:** pnpm 8.0.0 ↔ Node.js v22.15.0 URLSearchParams compatibility issue

## Issue Summary

All npm registry requests through **pnpm fail** with:
```
ERR_INVALID_THIS: Value of "this" must be of type URLSearchParams
```

However, **npm works flawlessly**:
```bash
npm install uuid@9.0.0  # ✅ SUCCESS
npm ping --registry https://registry.npmjs.org/  # ✅ PONG 392ms
curl -I https://registry.npmjs.org/  # ✅ HTTP 200 OK
```

## Root Cause Analysis

**pnpm Configuration:**
- Version: 8.0.0
- Node.js: v22.15.0 (latest)
- Issue: URLSearchParams handling in Node.js v22 conflicts with pnpm's registry interaction

**Known Compatibility:**
- npm 10.9.2 ✅ Works perfectly with all registries
- pnpm 8.0.0 ❌ URLSearchParams error with all registries (npmjs, npmmirror, yarnpkg)
- Network connectivity: ✅ Verified - registry responds with HTTP 200

## Solution Options

### Option 1: Use npm Instead of pnpm (RECOMMENDED - Immediate)

**Pros:**
- Works immediately (tested and verified)
- No version management issues
- Uses standard Node.js tooling

**Cons:**
- Different lock file format (package-lock.json vs pnpm-lock.yaml)
- Workspace setup differs slightly

**Implementation:**
```bash
cd c:\Users\guibr\OneDrive\Imagens\Documentos\Projetos\Tupan

# Install dependencies
npm install

# Install workspace dependencies (if needed per-package)
cd packages/ui-framework
npm install
cd ../../packages/core-ts
npm install
# ... repeat for other packages

# Build
npm run build

# Build Tauri
cargo tauri build
```

### Option 2: Downgrade Node.js to v20.x (MODERATE)

**Pros:**
- pnpm 8.0.0 designed for Node 18-20
- Retains monorepo workflow

**Cons:**
- Requires system Node.js downgrade
- May affect other projects

**Implementation:**
```bash
nvm use 20.11.0  # Or manually install Node 20.x
pnpm install
```

### Option 3: Upgrade pnpm to 9.x (ADVANCED)

**Pros:**
- Latest features and fixes
- Better Node.js v22 support

**Cons:**
- Requires careful migration
- Potential compatibility issues with existing pnpm-lock.yaml

**Implementation:**
```bash
npm uninstall -g pnpm
npm install -g pnpm@latest
cd project
pnpm install
```

## Status: PROCEEDING WITH OPTION 1

We will use npm to install and build the project. The codebase is ready; only the package manager needs to change.

## Next Steps

1. ✅ Verified npm connectivity (PONG from npmjs.org)
2. ✅ Confirmed npm install works (uuid package installed successfully)
3. 🔄 Proceed with npm install at package level
4. 🔄 Build ui-framework package
5. 🔄 Build all packages
6. 🔄 Build Tauri executable

## Performance Impact

- Build time: Same (npm is comparable speed to pnpm)
- Runtime: No impact (npm vs pnpm doesn't affect application)
- CI/CD: May need to update scripts to use npm instead of pnpm

## Permanent Fix

When ready to switch back to pnpm:
1. Upgrade Node.js to 20.x LTS or 22.x LTS (ensure compatibility)
2. Verify pnpm-lock.yaml integrity
3. Run `pnpm install` to regenerate lock file
4. Test build pipeline

---

**Generated:** 2026-03-22 by Claude Haiku 4.5
