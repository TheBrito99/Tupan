# Quick Start Guide - Phase 45 Testing

## 🚀 Build & Test in 5 Steps

### Step 1: Install Dependencies
```bash
cd packages/web-app
pnpm install
```
⏱️ Takes ~2 minutes

### Step 2: Verify TypeScript
```bash
pnpm build
```
✓ Should complete with "dist/" folder created
❌ If errors: Check console output, likely missing type definitions

### Step 3: Start Dev Server
```bash
pnpm dev
```
✓ Should print "Local: http://localhost:5173"

### Step 4: Open in Browser
Navigate to: **http://localhost:5173**

### Step 5: Run Through Test Checklist
See TEST_PLAN_PHASE45.md for detailed tests

---

## ⚡ Pre-Flight Checks

Run these before building:

### Check 1: Files Exist
```bash
# Should all return file paths (not "No such file")
ls packages/web-app/src/App.tsx
ls packages/web-app/src/App.css
ls packages/web-app/src/components/ResultsPlot.tsx
ls packages/web-app/src/pages/StateMachinePage.tsx
ls packages/web-app/src/pages/PetriNetPage.tsx
ls packages/ui-framework/src/components/StateMachineEditor
ls packages/ui-framework/src/components/PetriNetEditor
```

### Check 2: Package.json Has Plotly
```bash
# Should show plotly packages
grep -i plotly packages/web-app/package.json
```

Expected output:
```
"plotly.js-dist-min": "^2.26.0",
"react-plotly.js": "^2.6.0",
```

### Check 3: UI Framework Exports Editors
```bash
# Should show StateMachineEditor and PetriNetEditor
grep -i "statemaachine\|petri" packages/ui-framework/src/index.ts
```

---

## 🧪 Quick Visual Test

Once dev server is running:

1. **Dashboard** - Should load with 5 cards
2. **State Machine** - Click "Simulate" should show plot
3. **Petri Net** - Click "Simulate" should show plot
4. **Theme** - Click 🌙 button, should toggle dark mode
5. **Mobile** - Press F12, click device toolbar, resize to 480px

---

## 🛠️ Troubleshooting

| Issue | Solution |
|-------|----------|
| `Module not found: @tupan/ui-framework` | Run `pnpm install` in root, then web-app |
| `Plotly is not defined` | `pnpm install plotly.js-dist-min react-plotly.js` |
| Port 5173 already in use | `pnpm dev -- --port 3000` |
| TypeScript errors | Run `pnpm build` to see full output |
| Blank page | Check browser console (F12) for errors |
| Theme toggle doesn't work | Check if App.tsx imports App.css correctly |

---

## 📊 Expected Build Sizes

After `pnpm build`:

- **index.html** - ~2KB
- **main.*.js** - ~150-200KB (gzipped ~40-50KB)
- **css files** - ~50KB (gzipped ~10KB)

Total: ~200KB uncompressed, ~60KB gzipped

---

## ✅ Success Indicators

✓ No red errors in console
✓ All pages load
✓ Theme toggle works
✓ Editors render (even with placeholders)
✓ Plots display with sample data
✓ Mobile responsive

---

## 📝 After Successful Build

1. **Commit changes:**
   ```bash
   git add .
   git commit -m "Phase 45: Component integration & visualization complete"
   ```

2. **Next phase:** Phase 46 - WASM Backend Integration
   - Connect to Rust simulator
   - Stream results from WASM
   - Replace sample data with real simulation results

---

**Estimated time to first working build: 10-15 minutes** ⏱️

Good luck! 🚀
