# Phase 44-45 Test Plan

## Pre-Build Verification

### ✅ Dependency Check
Verify all required packages are installed:

```bash
cd packages/web-app
pnpm install
```

Expected packages to install:
- `plotly.js-dist-min@^2.26.0` ✓
- `react-plotly.js@^2.6.0` ✓
- All other workspace dependencies ✓

### ✅ TypeScript Compilation

```bash
# From web-app root
pnpm build
```

Expected output:
- ✓ `src/**/*.tsx` compiles without errors
- ✓ Type checking passes
- ✓ No unused imports or variables
- ✓ Vite bundle generation completes

## Build & Run Tests

### Step 1: Clean Install

```bash
# From project root
pnpm install
```

**Expected:** All dependencies resolve, no conflicts

---

### Step 2: Build Web App

```bash
# From web-app package
cd packages/web-app
pnpm build
```

**Expected:**
- ✓ TypeScript compilation succeeds
- ✓ Vite bundling completes
- ✓ Output directory created (`dist/`)
- ✓ No build warnings about missing imports

---

### Step 3: Dev Server

```bash
# From web-app package
pnpm dev
```

**Expected:**
- ✓ Dev server starts on `http://localhost:5173` (or similar)
- ✓ No console errors
- ✓ HMR (Hot Module Reload) working

---

## UI/UX Tests

### Test 1: Navigation & Routing ✓

**Steps:**
1. Open `http://localhost:5173`
2. Check that Dashboard loads
3. Verify navbar renders with:
   - ✓ Tupan logo
   - ✓ 6 menu items (Dashboard, Block Diagram, State Machine, Petri Net, Circuits, Thermal)
   - ✓ Theme toggle button (☀️/🌙)
   - ✓ Mobile hamburger menu (resize to < 768px)

**Expected:**
- ✓ All menu items are clickable
- ✓ Active link highlights correctly
- ✓ No console errors

---

### Test 2: Theme System ✓

**Steps:**
1. Click theme toggle button (☀️ or 🌙)
2. Verify theme changes:
   - Background colors
   - Text colors
   - Border colors
   - Scrollbar styling

**Expected:**
- ✓ Light mode: Light background, dark text
- ✓ Dark mode: Dark background, light text
- ✓ Smooth transition (no flashing)
- ✓ Theme persists on page refresh (if localStorage implemented)

---

### Test 3: Dashboard Page ✓

**Steps:**
1. Navigate to Dashboard (already at `/`)
2. Verify sections render:
   - ✓ Hero section with title
   - ✓ Simulator cards grid (5 cards)
   - ✓ Features grid (6 items)
   - ✓ CTA section
3. Click each simulator card
4. Verify navigation to correct page

**Expected:**
- ✓ All cards are clickable
- ✓ Correct routing (e.g., "Block Diagram" → `/block-diagram`)
- ✓ Responsive layout on mobile

---

### Test 4: State Machine Editor Page ✓

**Steps:**
1. Navigate to `/state-machine`
2. Verify page layout:
   - ✓ Header with title and controls
   - ✓ Left pane: StateMachineEditor component
   - ✓ Simulate and Export buttons
3. Try creating a state machine:
   - Click in editor area to add states
   - Shift+Click to add transitions
   - Observe state count updates in footer
4. Click "Simulate" button
5. Verify results pane appears with:
   - ✓ Active State display
   - ✓ State/Transition counts
   - ✓ Plotly chart rendering

**Expected:**
- ✓ Editor renders without errors
- ✓ State creation works
- ✓ Results pane shows with chart
- ✓ Chart displays time-series data
- ✓ No console warnings about Plotly

---

### Test 5: Petri Net Editor Page ✓

**Steps:**
1. Navigate to `/petri-net`
2. Verify page layout (similar to state machine)
3. Try creating a Petri net:
   - Click to add places
   - Shift+Click to add transitions
   - Alt+Click to draw arcs
4. Click "Simulate" button
5. Verify results pane with marking trace

**Expected:**
- ✓ Editor renders correctly
- ✓ Places and transitions visible
- ✓ Results pane shows marking trace chart
- ✓ Chart displays multiple data series (one per place)

---

### Test 6: Export Functionality ✓

**Steps:**
1. On any editor page (State Machine or Petri Net)
2. Create some elements
3. Click "Export" button
4. Verify JSON file downloads

**Expected:**
- ✓ File downloads with correct name:
  - `state-machine-{timestamp}.json`
  - `petri-net-{timestamp}.json`
- ✓ JSON is valid (open in editor to verify)
- ✓ Contains all diagram data

---

### Test 7: Block Diagram Page ✓

**Steps:**
1. Navigate to `/block-diagram`
2. Verify placeholder message appears

**Expected:**
- ✓ Page renders
- ✓ Placeholder explains component not yet integrated
- ✓ Controls available (Simulate, Export disabled until blocks added)

---

### Test 8: Circuit & Thermal Pages ✓

**Steps:**
1. Navigate to `/circuit-electrical`
2. Navigate to `/circuit-thermal`
3. Verify placeholder pages load

**Expected:**
- ✓ Both pages render
- ✓ Proper header and layout
- ✓ Ready for future integration

---

### Test 9: Responsive Design ✓

**Steps:**
1. Open DevTools (F12)
2. Toggle device toolbar
3. Test at breakpoints:
   - 480px (mobile)
   - 768px (tablet)
   - 1024px (laptop)
   - 1440px (desktop)

**Expected:**
- ✓ Hamburger menu appears at < 768px
- ✓ Layout adapts to screen width
- ✓ Text remains readable
- ✓ No horizontal scrolling (except small mobile)
- ✓ Editor and results panes stack vertically on mobile

---

### Test 10: Footer ✓

**Steps:**
1. Scroll to bottom of any page
2. Verify footer renders with:
   - ✓ About section
   - ✓ Features links
   - ✓ Resources links
   - ✓ Copyright and version

**Expected:**
- ✓ All links present
- ✓ Footer stays at bottom
- ✓ Proper spacing

---

## Performance Tests

### Test 11: Initial Load Time ✓

**Steps:**
1. Open DevTools → Network tab
2. Hard refresh (Ctrl+Shift+R)
3. Note metrics:
   - Page load time
   - Bundle size
   - Number of requests

**Expected:**
- ✓ Page loads in < 3 seconds
- ✓ Main bundle < 500KB (gzipped)
- ✓ < 10 network requests for main page

---

### Test 12: Editor Performance ✓

**Steps:**
1. Open State Machine or Petri Net page
2. Add 20+ states/places
3. Observe responsiveness
4. Toggle simulation on/off multiple times

**Expected:**
- ✓ Editor remains responsive
- ✓ No lag when adding elements
- ✓ No memory leaks (check DevTools Memory)

---

## Browser Compatibility

Test in:
- ✓ Chrome 90+ (default)
- ✓ Firefox 88+
- ✓ Safari 14+ (if available)
- ✓ Edge 90+

**Expected:**
- ✓ All tests pass in each browser
- ✓ No console errors or warnings

---

## Console Checks

**Steps:**
1. Open DevTools → Console tab
2. Perform all above tests
3. Check for:
   - ❌ Red errors
   - ⚠️ Warnings (investigate)
   - ℹ️ Infos (acceptable)

**Expected:**
- ✓ Zero errors
- ✓ No "undefined" or "null" warnings
- ✓ No missing component warnings

---

## Detailed Test Checklist

### Phase 44 - Web App Integration

- [ ] App renders without crashing
- [ ] Navigation component works
- [ ] Footer displays correctly
- [ ] All 6 routes accessible
- [ ] Theme toggle works
- [ ] Responsive design works on all breakpoints
- [ ] Dashboard page shows all cards
- [ ] Card navigation works

### Phase 45 - Component Integration & Visualization

- [ ] StateMachineEditor integrates into page
- [ ] StateMachineEditor receives props correctly
- [ ] PetriNetEditor integrates into page
- [ ] PetriNetEditor receives props correctly
- [ ] Plotly.js loads without errors
- [ ] ResultsPlot component renders
- [ ] Time-series plot displays correctly
- [ ] Multiple data series shown
- [ ] Plot is responsive

### Export/Import

- [ ] Export JSON works
- [ ] JSON contains correct structure
- [ ] Exported files are valid JSON

---

## Success Criteria

### Minimum (MVP)

- ✓ App builds without errors
- ✓ All pages render
- ✓ Editors integrate and work
- ✓ Navigation functions
- ✓ Theme toggle works
- ✓ Responsive design functional

### Ideal

- ✓ All above tests pass
- ✓ Console has no errors
- ✓ Page load < 2 seconds
- ✓ Smooth animations
- ✓ No browser-specific issues

---

## Known Issues & Workarounds

### Issue: Plotly.js Not Found
**Solution:** Run `pnpm install` in web-app directory

### Issue: Port 5173 Already In Use
**Solution:**
```bash
pnpm dev -- --port 3000
```

### Issue: CORS Errors
**Solution:** Only local development - not an issue for WASM later

---

## Build Instructions Summary

```bash
# 1. Install dependencies
cd packages/web-app
pnpm install

# 2. Build for production
pnpm build

# 3. Run dev server
pnpm dev

# 4. Open in browser
# Navigate to http://localhost:5173
```

---

## Next Steps After Testing

✅ **If all tests pass:**
1. Commit changes to git
2. Proceed with Phase 46 (WASM integration)
3. Add actual simulation backend

❌ **If tests fail:**
1. Check error messages in console
2. Verify dependencies installed
3. Check TypeScript compilation
4. Consult build output for clues

---

**Total Test Time:** ~30 minutes
**Difficulty:** Easy (mostly visual inspection)

Good luck! 🚀
