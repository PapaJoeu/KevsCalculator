# Kev's Calculator — Script Specifications

A print-imposition calculator that determines how many documents fit on a sheet,
computes margins, generates a guillotine-cutting program sequence, and outputs
finishing positions (cuts, slits, scores, perforations, holes).

---

## 0. Platform & Design Requirements

### 0.1 Tech Stack
- **HTML + CSS + JavaScript** — no framework required; vanilla JS is fine
- Static file delivery (no build step needed, though a bundler is acceptable)

### 0.2 Responsive Layout
- **Desktop-first priority** — show as much information simultaneously as possible
  (e.g., inputs panel + visualizer + results tables side-by-side)
- **Mobile supported** — panels stack vertically; tabs or accordion collapse for
  space; visualizer scales down proportionally
- Breakpoint strategy: single column below ~768 px, multi-column above

### 0.3 Presets System
- Presets exist for: sheet sizes, document sizes, gutters, score types
- User can **add custom presets** for complete configurations (all inputs saved as
  a named slot)
- Presets are filterable by unit system (imperial vs. metric)
- Preset data should be stored in a simple JS object or JSON so it is easy to
  extend

### 0.4 Unit Handling
- Global unit toggle: **Imperial (in)** ↔ **Metric (mm)**
- **Per-field unit suffix override**: while in imperial mode a user can type
  `540 mm` (or `540mm`) into any measurement field and the value is
  automatically converted to inches on blur/enter. Likewise `2.5 in` while in
  metric mode converts to mm.
- Internally all values are stored as canonical inches; display-only conversion
  happens at render time to avoid compounding rounding errors.
- Precision: inches → 4 decimal places; mm → 2 decimal places

---

## 13. JS Architecture — Three Approaches

The core challenge: inputs, presets, unit conversion, layout calculations, the
visualizer, the cutting program, and the results tables all share the same data.
A change to any input must propagate consistently to every consumer. The three
approaches below differ in *how that shared state flows*.

---

### Approach A — Single State Object + Recalculate-on-Change

**What it is:** One plain JS object (`state`) holds every canonical value
(always in inches). Every input change calls `setState(patch)`, which merges
the patch, runs the full calculation pipeline, then calls `render()`. Render
functions read from `state` and write directly to the DOM.

```js
// state.js
const state = {
  unit: 'imperial',
  sheet:    { w: 12, h: 18 },
  doc:      { w: 3.5, h: 2 },
  gutter:   { h: 0.125, v: 0.125 },
  margins:  { auto: true, t: 0, r: 0, b: 0, l: 0 },
  nonPrint: { t: 0.0625, r: 0.0625, b: 0.0625, l: 0.0625 },
  // ... results populated by calculate()
};

function setState(patch) {
  Object.assign(state, patch);   // shallow merge (use deep for nested)
  calculate(state);              // mutates state.results.*
  renderAll(state);              // pushes values into DOM
}
```

```
Input event → setState() → calculate() → renderAll()
                                │
                     ┌──────────┼──────────┐
                  renderVisualizer  renderTable  renderProgram
```

**Pros:**
- Dead simple to trace a bug: one function call chain, no indirection
- Easy to serialize the whole app state (for presets / undo)
- Calculation is a pure function: `calculate(state)` → predictable, testable
- No dependencies — 100% vanilla JS

**Cons:**
- `renderAll()` re-renders every panel even when only one changed — fine for
  this tool's scale, but worth noting
- As inputs grow, `setState` callers must know the correct nested key path
- No automatic dependency tracking; you manually decide what to re-render

**Best for:** Straightforward single-page tools, solo devs, when debuggability
and simplicity are the priority.

---

### Approach B — Event Bus (Publish / Subscribe)

**What it is:** A tiny event bus sits at the centre. Input modules *publish*
change events. The calculation engine *subscribes* to input events, computes,
and *publishes* result events. The visualizer, cutting program, and result
tables each *subscribe* only to the result events they care about. Modules
never import each other directly.

```js
// bus.js
const bus = {
  _listeners: {},
  on(event, fn) { (this._listeners[event] ??= []).push(fn); },
  emit(event, data) { (this._listeners[event] ?? []).forEach(fn => fn(data)); }
};

// inputs.js
sheetWidthInput.addEventListener('input', e => {
  bus.emit('input:sheet', { w: parseInches(e.target.value) });
});

// calculator.js
bus.on('input:sheet', ({ w }) => {
  store.sheet.w = w;
  const results = calculate(store);
  bus.emit('results:layout', results.layout);
  bus.emit('results:program', results.program);
});

// visualizer.js
bus.on('results:layout', layout => drawVisualizer(layout));

// cuttingProgram.js
bus.on('results:program', program => renderTable(program));
```

```
[Input module] --emit('input:sheet')--> [Calculator]
                                             │
                          ┌──────────────────┤
                   emit('results:layout')  emit('results:program')
                          │                  │
                    [Visualizer]       [CuttingProgram]
```

**Pros:**
- Modules are fully decoupled — easy to add a new output panel without
  touching any existing code
- Clear ownership: each module handles exactly one concern
- Easy to log every event for debugging (`bus.on('*', console.log)`)
- Scales well if the tool gains more independent panels

**Cons:**
- Data flow is implicit — you must trace events to understand what triggers what
- Shared mutable `store` inside the calculator module is still needed
- Risk of event naming drift if not documented (`input:sheet` vs `sheet:input`)
- Slightly more boilerplate per input field

**Best for:** Tools expected to grow significantly, when panels/modules are
likely to be added or swapped by different people.

---

### Approach C — Reactive Store with Derived State (Signal-like)

**What it is:** A lightweight reactive store where *derived values*
(calculations) automatically recompute when their upstream inputs change.
Consumers subscribe to specific slices. Similar in spirit to Vue's `computed`
or a hand-rolled signal system — no framework needed.

```js
// store.js
function createStore(initial) {
  const subs = {};
  const state = new Proxy({ ...initial }, {
    set(obj, key, val) {
      obj[key] = val;
      (subs[key] ?? []).forEach(fn => fn(val, obj));
      return true;
    }
  });
  return {
    state,
    on(key, fn) { (subs[key] ??= []).push(fn); }
  };
}

const { state, on } = createStore({
  sheetW: 12, sheetH: 18,
  docW: 3.5,  docH: 2,
  gutterH: 0.125, gutterV: 0.125,
  // derived — recalculated automatically:
  layout: null, program: null
});

// calculator.js — subscribe to any raw input and push derived results
['sheetW','sheetH','docW','docH','gutterH','gutterV'].forEach(key => {
  on(key, () => {
    state.layout  = calcLayout(state);   // triggers layout subscribers
    state.program = calcProgram(state);  // triggers program subscribers
  });
});

// visualizer.js
on('layout',  layout  => drawVisualizer(layout));
on('program', program => renderTable(program));

// Input binding
sheetWidthInput.addEventListener('input', e => {
  state.sheetW = parseInches(e.target.value);  // triggers chain automatically
});
```

```
state.sheetW = x
      │  (Proxy setter fires)
      ▼
  calculator subscriber
      ├── state.layout  = calcLayout(state)   → visualizer subscriber
      └── state.program = calcProgram(state)  → program subscriber
```

**Pros:**
- Input → derived result flow is automatic and explicit in one place
- Adding a new derived value is one function + one `on()` call
- Fine-grained: only subscribers to changed keys re-run (efficient)
- Clean separation: raw inputs vs. derived results are clearly distinct
- Serializing the store for presets is straightforward (filter out derived keys)

**Cons:**
- Proxy-based reactivity can surprise developers unfamiliar with it
- Circular dependencies (derived A depending on derived B and vice versa)
  must be avoided manually
- Slightly harder to step through in a debugger than a direct function call

**Best for:** Tools where multiple derived values depend on overlapping input
subsets and you want dependency tracking without pulling in a framework.

---

### Recommendation

**Approach A** is the right starting point. The calculation chain is linear
(`inputs → layout → program → render`), the state is small, and simplicity
wins. Serialize `state` directly to JSON for preset save/load.

Upgrade to **Approach C** if the tool gains several independent derived outputs
that depend on different input subsets — the automatic propagation pays off.
**Approach B** is best reserved for cases where multiple developers own
separate panels and need hard module boundaries.

---

## 1. Inputs

### 1.1 Sheet
| Field | Description | Default (Imperial) | Default (Metric) |
|-------|-------------|-------------------|-----------------|
| Sheet Width | Total stock width | 12 in | 297 mm |
| Sheet Height | Total stock height | 18 in | 420 mm |
| Preset | Quick-select: 12×18, 13×19, A3, SRA3 | 12×18 | A3 |

### 1.2 Document
| Field | Description | Default (Imperial) | Default (Metric) |
|-------|-------------|-------------------|-----------------|
| Doc Width | Finished piece width | 3.5 in | 85 mm |
| Doc Height | Finished piece height | 2 in | 55 mm |
| Preset | Business Card, Postcard, Invitation, Letter, A5, A6, DL, etc. | Business Card | Business Card |

### 1.3 Gutters (spacing between documents)
| Field | Description | Default |
|-------|-------------|---------|
| Horizontal Gutter | Space between columns | 0.125 in / 3 mm |
| Vertical Gutter | Space between rows | 0.125 in / 3 mm |
| Preset | None, 1/8 in, 3 mm, 5 mm, 10 mm, custom | 1/8 in / 3 mm |

### 1.4 Non-Printable Area (printer grip / bleed edges)
Per-side inset where the printer cannot place ink:
- Top, Right, Bottom, Left (default 0.0625 in / 3 mm each)

### 1.5 Margins (layout offset from sheet edges)
- Top, Right, Bottom, Left
- **Auto mode** (default): margins are calculated automatically to center the
  imposed area within the printable area.
- **Manual mode**: activated as soon as any margin field is edited by the user.

### 1.6 Count Overrides (optional)
- Force Across — cap the number of columns (leave blank = auto)
- Force Down — cap the number of rows (leave blank = auto)

### 1.7 Unit System
- Imperial (inches) or Metric (mm), toggled via a button
- Switching systems resets inputs to system defaults; inputs are internally
  stored as canonical inches and converted for display only.

---

## 2. Core Layout Calculations

### 2.1 Effective Sheet Area
```
effectiveWidth  = sheetWidth  − nonPrintable.left − nonPrintable.right
effectiveHeight = sheetHeight − nonPrintable.top  − nonPrintable.bottom
```

### 2.2 Layout Area (where documents are placed)
```
originX = max(margin.left, nonPrintable.left)
originY = max(margin.top,  nonPrintable.top)
extentX = sheetWidth  − max(margin.right,  nonPrintable.right)
extentY = sheetHeight − max(margin.bottom, nonPrintable.bottom)
layoutWidth  = extentX − originX
layoutHeight = extentY − originY
```

### 2.3 Document Count per Axis
```
countAcross = floor((layoutWidth  + gutterH) / (docWidth  + gutterH))
countDown   = floor((layoutHeight + gutterV) / (docHeight + gutterV))
```
A floating-point tolerance corrects near-integer rounding errors.

### 2.4 Auto-Margin Centering
When auto mode is on, after calculating an initial layout the margins are
re-derived so the imposed block is visually centered:
```
leftover_x = (effectiveWidth  − usedWidth)  / 2
leftover_y = (effectiveHeight − usedHeight) / 2
margin.left = margin.right  = nonPrintable.left  + leftover_x
margin.top  = margin.bottom = nonPrintable.top   + leftover_y
```

### 2.5 Realized Margins
The actual distances from sheet edge to the nearest document edge:
- Left / Top = layout origin
- Right  = sheetWidth  − (originX + usedWidth)
- Bottom = sheetHeight − (originY + usedHeight)

---

## 3. Program Sequence (Guillotine Cutting)

The program sequence is an ordered list of cutter settings for separating
documents off the sheet.

### 3.1 Sequence Logic
1. **Step 1** — `sheetLength − topMargin` (pull back from back edge to top of
   imposed block)
2. **Step 2** — `sheetWidth − leftMargin` (pull back from side fence to left of
   imposed block)
3. **Step 3** — `imposedSpaceLength` (height of the entire imposed block)
4. **Step 4** — `imposedSpaceWidth` (width of the entire imposed block)
5. **Interior horizontal cuts** (across axis) — walking backward through the
   block: `imposedWidth − i × (docWidth + gutterH)` for i = 1…(countAcross−1)
6. **Back cuts for horizontal gutters** — `docWidth` repeated for each gutter
7. **Interior vertical cuts** (down axis) — `imposedHeight − i × (docHeight + gutterV)`
8. **Back cuts for vertical gutters** — `docHeight` repeated for each gutter

All values are output in both **inches** (4 decimal places) and **millimeters**
(2 decimal places), labeled Step 1, Step 2, …

### 3.2 Example

**Inputs:** 12×18 in sheet, 3.5×2 in business card, 0.125 in gutters, auto margins

**Derived layout:**
- Columns: 3 (3×3.5 + 2×0.125 = 10.75 in), rows: 8 (8×2 + 7×0.125 = 16.875 in)
- Left margin: (12 − 10.75) / 2 = 0.625 in
- Top margin: (18 − 16.875) / 2 = 0.5625 in

**Program sequence:**
| Step | Inches | mm |
|------|--------|----|
| 1 | 17.4375 | 442.91 |
| 2 | 11.375 | 288.93 |
| 3 | 16.875 | 428.63 |
| 4 | 10.75 | 273.05 |
| 5 | 7.25 | 184.15 |
| 6 | 3.625 | 92.08 |
| 7 | 3.5 | 88.90 |
| 8 | 3.5 | 88.90 |
| 9 | 14 | 355.60 |
| 10 | 12 | 304.80 |
| 11 | 2 | 50.80 |
| 12 | 2 | 50.80 |

---

## 4. Finishing Calculations

All finishing operations use the layout's `originX`/`originY` and step sizes
(`docDimension + gutter`) to generate absolute positions on the sheet.

### 4.1 Cuts (horizontal knife, across full sheet width)
Edge positions of each document row boundary (top and bottom of every row,
including gutter edges if present). Output as a table with label, inches, mm.

### 4.2 Slits (vertical knife, full sheet height)
Edge positions of each document column boundary (left and right of every
column, including gutter edges). Output as a table with label, inches, mm.

### 4.3 Scores
Fold-score lines positioned at fractional offsets within each document:
- **Vertical scores** — offsets along the doc width (e.g., 0.5 = center = bifold)
- **Horizontal scores** — offsets along the doc height
- Input format: comma-separated fractions `0, 1` (0 = leading edge, 1 = trailing edge)
- **Bifold preset** — `0.5` (one score at center)
- **Trifold preset** — `0.3333, 0.6667`
- Swap button swaps vertical ↔ horizontal offsets

### 4.4 Perforations
Same structure as scores but rendered as dashed lines. Bifold/trifold presets
available for both axes.

### 4.5 Drilling (Hole Punch)
| Option | Description |
|--------|-------------|
| None | No holes |
| 3-hole | Standard binder pattern — left edge, 5/16 in in, at top/center/bottom with 1/2 in axis offsets |
| Custom | User-defined holes: edge, alignment (start/center/end), along-edge offset (in), edge offset (in) |

Hole sizes: 1/4 in (default), 3/16 in, 5/16 in, 3/8 in.

Holes are generated for every document on the sheet.

### 4.6 Rounded Corners
Per-corner radius (top-left, top-right, bottom-right, bottom-left):
- Global input applies the same radius to all four corners
- Individual corner overrides
- Presets (typically 1/8 in, 1/4 in, etc.)
- Rendered in the SVG visualizer as rounded rectangles
- Summary table shows status (Rounded / Square) for each corner

---

## 5. SVG Visualizer

A live, proportionally scaled vector diagram of the sheet with toggleable
layers.

### 5.1 Layers
| Layer | What it shows |
|-------|---------------|
| Sheet | Full sheet outline |
| Non-printable | Shaded bands on edges where printing is restricted |
| Printable outline | Dashed boundary of the printable area |
| Layout area | Boundary of the imposed block |
| Documents | Individual document rectangles (with rounded corners if set) |
| Cuts | Horizontal red lines spanning the full sheet |
| Slits | Vertical red lines spanning the full sheet |
| Scores | Shorter colored lines inside the layout area |
| Perforations | Dashed lines inside the layout area |
| Holes | Circles at each drilled hole position |

Each layer can be individually shown/hidden via checkboxes on the Summary tab.
Layers for scores, perforations, and holes are auto-activated when those
features contain data.

### 5.2 Interactive Measurement Display
Clicking a line or circle in the SVG shows its measurement annotation
(inches + mm). The visualizer re-renders on every calculation update.

---

## 6. Summary / Stats Panel

Shown prominently after calculation:
- **N-up** count (across × down, e.g., "3 × 8 = 24")
- Layout area dimensions (W × H)
- Layout origin (x, y)
- Realized margins (L, T, R, B)
- Used span (W × H of imposed block)
- Trailing margin (unused space on right and bottom)

---

## 7. Summary Calculators (Production Math)

Three sub-calculators that auto-populate the N-up value from the layout:

### 7.1 Pad Calculator
Converts pads into total pieces and required sheets.
- Inputs: Pad count, Sheets per pad, N-up
- Outputs: Total pieces, Total sheets, Overage pieces

**Example:** 100 pads × 50 sheets / pad ÷ 24 up = 5,000 pieces on 209 sheets (8 overage pieces)

### 7.2 Run Planner
Calculates sheets needed for a desired quantity with overs.
- Inputs: Desired pieces, N-up, Overs %
- Outputs: Total pieces, Total sheets, Overs breakdown

**Example:** 10,000 pieces, 24 up, 5% overs → 10,500 pieces, 438 sheets (21 overs sheets)

### 7.3 Sheet Converter
Converts a sheet count into pieces and pads.
- Inputs: Sheets to run, N-up, Pieces per pad
- Outputs: Total pieces, Complete pads, Remainder pieces

**Example:** 500 sheets × 24 up = 12,000 pieces → 240 complete pads of 50

---

## 8. Presets Tab

Saved configurations that set all inputs at once (sheet, document, gutters,
scores, perforations, margins, drilling, rounded corners). Applied from a
dropdown and take effect immediately.

---

## 9. Warnings Tab

Displays validation alerts when inputs produce invalid or unusual results
(e.g., documents larger than the sheet, zero document count, margins exceeding
the usable area). No action required — informational only.

---

## 10. Print / Export

A print-optimized view that re-renders the SVG and the program sequence table
for use as a physical job ticket. Includes:
- Sheet/document dimensions summary
- Program sequence table (inches + mm columns)
- Finishing tables (cuts, slits, scores, perforations, holes)

---

## 11. Program Flow (Execution Order)

```
User edits any input
        ↓
update() triggered (button click, Enter key, or live input change)
        ↓
currentInputs() — reads all DOM fields → canonical inches
        ↓
createCalculationContext() — normalizes margins/nonPrintable/gutters
        ↓
calculateLayout() — counts, usedSpan, realizedMargins
        ↓
applyCountOverrides() — clamp counts if forceAcross/forceDown set
        ↓
[Auto-margin] recalculate context + layout with derived centered margins
        ↓
calculateFinishing() — cuts, slits, scores, perforations, holes
        ↓
calculateProgramSequence() — ordered guillotine steps
        ↓
Update DOM:
  • N-up display, margins, origin, used/trailing span
  • Fill all finishing tables
  • drawSVG() — rebuild SVG layers
  • updatePrintableVisualizer() — print tab
  • updateSummaryCalculators() — inject N-up into production math
  • Status bar → "Updated"
```

---

## 12. Example Inputs & Outputs

### Example A — Standard Business Card Imposition (Imperial)
| Input | Value |
|-------|-------|
| Sheet | 12 × 18 in |
| Document | 3.5 × 2 in |
| Gutters | 0.125 × 0.125 in |
| Margins | Auto |
| Non-printable | 0.0625 in all sides |

| Output | Value |
|--------|-------|
| Columns × Rows | 3 × 8 = **24 up** |
| Layout origin | x 0.625, y 0.5625 |
| Used span | 10.75 × 16.875 in |
| Realized margins | L 0.625, T 0.5625, R 0.625, B 0.5625 |
| Cuts | 0.5625, 2.5625, 2.6875, 4.6875 … (8 rows × 2 edges + gutters) |
| Slits | 0.625, 4.125, 4.25, 7.75, 7.875, 11.375 |
| Program steps | 14 steps (4 outer + 5 across cuts + 5 down cuts) |

---

### Example B — Metric Postcard (A3 Sheet)
| Input | Value |
|-------|-------|
| Sheet | 297 × 420 mm (A3) |
| Document | 148 × 105 mm (A6) |
| Gutters | 3 × 3 mm |
| Margins | Auto |

| Output | Value |
|--------|-------|
| Columns × Rows | 2 × 3 = **6 up** |
| Used span | 299 × 321 mm *(exceeds sheet — margin auto-clamps to 0)* |
| Columns × Rows (corrected) | 1 × 3 = **3 up** |

---

### Example C — Bifold Brochure with Scores
| Input | Value |
|-------|-------|
| Sheet | 12 × 18 in |
| Document | 8.5 × 11 in |
| Gutters | 0 in |
| Scores (vertical) | `0.5` (bifold at center) |

| Output | Value |
|--------|-------|
| Columns × Rows | 1 × 1 = **1 up** |
| Vertical score | 4.25 in from left |
| Program steps | 4 steps (sheet perimeter only, 1 doc = no internal cuts) |

---

### Example D — Business Card with 3-Hole Drilling
| Input | Value |
|-------|-------|
| Sheet | 12 × 18 in |
| Document | 3.5 × 2 in |
| Drilling | 3-hole, 5/16 in diameter |

| Output | Value |
|--------|-------|
| N-up | 24 |
| Holes per sheet | 72 (3 holes × 24 documents) |
| Hole 1 (Doc 1,1) | x 0.9375, y 0.5625 + 0.5 = 1.0625 in |

---

### Example E — Rounded Corner Business Cards
| Input | Value |
|-------|-------|
| Sheet | 12 × 18 in |
| Document | 3.5 × 2 in |
| Corner radius | 0.125 in (all corners) |

| Output | Value |
|--------|-------|
| N-up | 24 |
| Visualizer | All 24 doc rectangles rendered with rounded corners |
| Summary | Top-left: 0.125 in (Rounded), … |
