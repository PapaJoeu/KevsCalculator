# Kev's Calculator - Technical Documentation

## Overview

**Kev's Calculator** is a printable layout calculator web application designed for print production professionals. It calculates optimal document arrangements on printing sheets, including spacing, margins, finishing operations (cuts, scores, perforations), and hole drilling patterns.

**Technology Stack:**
- Vanilla JavaScript (ES modules)
- SVG rendering for visual preview
- Static deployment via GitHub Pages
- No external framework dependencies

---

## Terminology & Jargon

### Core Print Layout Terms

#### Sheet
The physical paper being printed on (e.g., 12×18 in, A3 297×420 mm). This is the "canvas" on which documents are arranged.

#### Document
The individual design being repeated on the sheet (e.g., 3.5×2 in business card, 85×55 mm document). Multiple copies of this document are placed on a single sheet for efficient printing.

#### Gutter
The space between documents, both horizontal and vertical. Gutters provide room for cutting operations and prevent ink bleed between adjacent documents.

#### Margins / Safety Margins
Buffer zones around the edges of the sheet:
- **Non-Printable Area** - Physical printer limitations that prevent printing near edges (top/right/bottom/left margins)
- **Safety Margins** - Additional buffer space to account for bleed and trim tolerances

#### Layout Area
The region where documents can be placed, calculated after excluding margins from the sheet. This is the effective printable region.

### Finishing Operations

#### Cuts
Full-bleed edge separations between documents that go completely through the paper. These are the primary operations for separating individual documents from the sheet.

#### Slits
Partial cuts within the gutter space that don't extend to full document separation. Used for internal cuts that are shorter than the full document span.

#### Scores
Fold lines (crease marks without cutting through). Scores create fold marks that guide paper folding operations:
- **Horizontal Scores** - Folds running left-to-right across documents
- **Vertical Scores** - Folds running top-to-bottom across documents

#### Perforations
Tear-line patterns between documents consisting of alternating cuts and spaces. Common patterns include:
- **Bifold Perforations** - Dividing sheet in half
- **Trifold Perforations** - Dividing sheet in thirds

#### Holes
Drilling holes for binding operations with preset patterns:
- **Three-Hole** - Standard 3-ring binder pattern
- **Custom** - User-defined hole positions and dimensions

### Measurement Terms

#### Across / Down
Document count horizontally (across) and vertically (down) on the sheet. For example, "6 across, 4 down" = 24 documents per sheet.

#### Used Span
Total space consumed by documents and gutters along an axis. This represents the actual occupied space on the sheet.

#### Trailing Margin
Leftover space after documents are placed. This is the remaining margin at the end of the layout area after fitting the maximum number of documents.

#### Realized Margins
The actual margins after document placement, which may differ from specified margins due to document fitting calculations.

---

## Calculations

### Layout Calculation Pipeline

The application uses a multi-stage calculation pipeline to determine optimal document placement:

#### 1. Document Count Calculation (`calculateDocumentCount`)

**Purpose:** Determines how many documents fit along an axis given available space and gutter spacing.

**Formula:**
```javascript
count = Math.floor((availableSpace + gutter) / (documentSpan + gutter))
```

**Key Features:**
- Uses tolerance-aware floating-point arithmetic (epsilon: 0.0001 inches)
- Handles metric/imperial precision edge cases
- Accounts for the fact that the last document doesn't need a trailing gutter

**Example:**
```
Sheet width: 12 inches
Document width: 3.5 inches
Horizontal gutter: 0.125 inches
Horizontal margins: 0.25 inches each side

Available space = 12 - 0.25 - 0.25 = 11.5 inches
Documents across = floor((11.5 + 0.125) / (3.5 + 0.125)) = 3
```

#### 2. Layout Context Creation (`createCalculationContext`)

**Purpose:** Normalizes input dimensions and calculates effective printable area.

**Operations:**
- Extracts sheet dimensions, document dimensions, gutters, and margins
- Calculates layout area boundaries (origin and extent)
- Determines available space after accounting for non-printable margins
- Returns normalized context object for downstream calculations

**Output Structure:**
```javascript
{
  sheet: { width, height },
  document: { width, height },
  gutter: { horizontal, vertical },
  margins: { top, right, bottom, left },
  layoutArea: { origin: {x, y}, extent: {x, y} },
  availableSpace: { horizontal, vertical }
}
```

#### 3. Axis Usage Calculation (`calculateAxisUsage`)

**Purpose:** Calculates actual space used by documents and trailing margins.

**Formula:**
```javascript
usedSpan = (documentSpan * count) + (gutter * (count - 1))
trailingMargin = availableSpace - usedSpan
```

**Returns:**
- `usedSpan` - Total occupied space by documents and gutters
- `trailingMargin` - Remaining space after document placement

#### 4. Final Layout Composition (`calculateLayout`)

**Purpose:** Computes the complete layout with all metrics.

**Outputs:**
- Maximum documents across/down the sheet
- Realized margins (actual margins after document placement)
- Usage metrics (horizontal and vertical spacing)
- Layout validation status

**Features:**
- Supports document count overrides (`forceAcross`, `forceDown`)
- Distributes trailing margins appropriately
- Validates layout constraints

### Finishing Calculations (`calculateFinishing`)

**Purpose:** Generates precise measurements for manufacturing operations.

#### Cut Calculations
- **Full Cuts** - Positioned between documents at gutter midpoints
- **Edge Cuts** - At sheet boundaries for full-bleed trimming
- Generates positions in both inches and millimeters

#### Slit Calculations
- Positioned within gutter space
- Span only the internal document area (not full sheet width/height)
- Used for partial separations

#### Score Calculations
- **Horizontal Scores** - Fold lines running across the sheet
- **Vertical Scores** - Fold lines running down the sheet
- Offset from document edges by user-defined distances
- Common patterns: bifold (50%), trifold (33%, 66%)

#### Perforation Calculations
- Similar positioning to cuts but marked as tear-lines
- Support for bifold/trifold patterns
- Generated at user-specified offsets within documents

#### Hole Calculations
- **Three-Hole Preset** - Standard 3-ring binder spacing
- **Custom Patterns** - User-defined hole positions
- Calculates X/Y coordinates for each hole
- Includes hole diameter specifications

**Output Format:**
```javascript
{
  cuts: [
    { position: 3.5, positionInches: "3.500 in", positionMM: "88.90 mm", label: "Cut 1" }
  ],
  slits: [...],
  scores: [...],
  perforations: [...],
  holes: [...]
}
```

### Precision Standards

**Floating-Point Tolerance:**
- Epsilon: 0.0001 inches for comparison operations
- Prevents rounding errors in metric/imperial conversions

**Display Precision:**
- **Inches**: 3 decimal places (0.001 in)
- **Millimeters**: 2 decimal places (0.01 mm)

**Conversion Constant:**
```javascript
MM_PER_INCH = 25.4
```

---

## Use Cases

### 1. Business Card Printing

**Scenario:** Print 3.5×2 inch business cards on 12×18 inch sheets.

**Configuration:**
- Sheet: 12×18 in
- Document: 3.5×2 in
- Gutter: 0.125 in (horizontal and vertical)
- Margins: 0.25 in (all sides)

**Result:**
- 3 cards across, 8 cards down = 24 cards per sheet
- Cut lines at gutter midpoints for separation
- Visualizer shows precise card placement

**Benefits:**
- Maximizes cards per sheet
- Provides exact cut line measurements for production
- Accounts for printer margins and safety zones

### 2. Brochure Production with Scores

**Scenario:** Create tri-fold brochures on A4 sheets.

**Configuration:**
- Sheet: 297×210 mm (A4)
- Document: 297×210 mm (full sheet)
- Scores: At 99 mm and 198 mm (trifold pattern)
- No gutters (single document)

**Result:**
- Score lines positioned for perfect thirds
- Visual preview of fold positions
- Measurements in millimeters for metric production environment

**Benefits:**
- Precise fold line positioning
- Compatible with automated scoring equipment
- Visual verification before production

### 3. Perforation Patterns

**Scenario:** Create tear-off forms with perforation lines.

**Configuration:**
- Sheet: 8.5×11 in (Letter)
- Document: 8.5×3.667 in (three forms per sheet)
- Perforations: At document boundaries
- Optional holes for binder filing

**Result:**
- Horizontal perforation lines between forms
- Optional 3-hole drilling pattern
- Clean tear-lines for form separation

**Benefits:**
- Professional tear-off forms
- Dual-purpose (bound or separated)
- Exact perforation positioning

### 4. Postcard Gang Printing

**Scenario:** Print 4×6 inch postcards on SRA3 sheets.

**Configuration:**
- Sheet: 320×450 mm (SRA3)
- Document: 101.6×152.4 mm (4×6 in)
- Gutter: 3 mm
- Rounded corners: 3 mm radius

**Result:**
- 3 postcards across, 2 down = 6 postcards per sheet
- Rounded corner visualization
- Cut lines for separation

**Benefits:**
- Efficient use of oversized sheets
- Rounded corners for professional finish
- Bleed accommodation in gutters

### 5. Custom Booklet Production

**Scenario:** Create saddle-stitched booklets with drilling.

**Configuration:**
- Sheet: 11×17 in (Tabloid)
- Document: 5.5×8.5 in (half-letter)
- Gutters: 0.25 in
- Holes: 2-hole pattern at spine edge
- Scores: At center for folding

**Result:**
- 2 documents across, 2 down = 4 pages per sheet
- Center score for booklet fold
- Hole positions for binding

**Benefits:**
- Complete booklet specifications
- Integrated drilling and scoring
- Ready for automated bindery equipment

### 6. Label Sheets

**Scenario:** Print address labels on letter-size sheets.

**Configuration:**
- Sheet: 8.5×11 in
- Document: 2×1 in (Avery-style label)
- Gutter: 0.125 in (for die-cutting tolerance)
- Margins: Adjusted for kiss-cutting

**Result:**
- 4 labels across, 10 down = 40 labels per sheet
- Precise die-cut line positions
- Layout compatible with label stock

**Benefits:**
- Standard label sheet layouts
- Compatible with laser/inkjet printers
- Die-cutting or kiss-cutting specifications

---

## The Visualizer

### Purpose

The visualizer provides a real-time SVG preview of the complete sheet layout, showing document placement, margins, and all finishing operations. This visual feedback is critical for verifying layouts before production.

### Architecture

**SVG Canvas:**
- **Dimensions:** 960×600 viewBox with responsive scaling
- **Auto-scaling:** Maintains aspect ratio while fitting container
- **Coordinate System:** Origin at top-left, measurements in user units

**Rendering Pipeline:**

```
User Input → Calculations → buildLayoutScene() → drawSVG() → SVG Elements
```

1. **`buildLayoutScene()`** - Converts calculation results into shape descriptors (data structures)
2. **`drawSVG()`** - Coordinates scaling, centering, and layer rendering
3. **Shape Factories** - Create SVG primitives (rectangles, lines, circles) with appropriate attributes

### Layer System

The visualizer uses 9 toggleable layers for clarity and customization:

| Layer | Color | Default | Description |
|-------|-------|---------|-------------|
| **Layout Area** | Cyan | Off | The region where documents can be placed |
| **Documents** | Teal | **On** | Individual repeating documents |
| **Non-Printable Area** | Pink | **On** | Unprintable margins (printer limitations) |
| **Cuts** | Orange | Off | Full separations between documents |
| **Slits** | Yellow | Off | Partial cuts within gutters |
| **Scores** | Green | Off | Fold lines |
| **Perforations** | Blue | Off | Tear lines |
| **Holes** | Red | Off | Drilling positions (circles) |
| **Sheet** | Black | On | Paper edge outline |

**Layer Controls:**
- Checkboxes in right sidebar (Summary tab)
- CSS class toggling (`is-visible`, `is-hidden`)
- Preserved across layout updates
- Print-specific layer visibility in Print tab

### Visual Elements

#### Document Rectangles
- **Shape:** SVG `<rect>` or `<path>` (for rounded corners)
- **Fill:** Teal with transparency
- **Stroke:** Dark teal border
- **Rounded Corners:** Supported via SVG path generation with arc commands

#### Lines (Cuts, Slits, Scores, Perforations)
- **Shape:** SVG `<line>` elements
- **Stroke:** Color-coded by operation type
- **Dash Patterns:**
  - Solid for cuts
  - Dashed for scores
  - Dotted for perforations

#### Holes
- **Shape:** SVG `<circle>` elements
- **Fill:** Red with transparency
- **Radius:** Scaled from actual hole diameter

#### Margins
- **Shape:** SVG `<rect>` overlay
- **Fill:** Semi-transparent pink for non-printable areas
- **Stroke:** Dashed for layout area boundaries

### Interactive Features

**Measurement Labels:**
- Hoverable measurement annotations
- Displayed in current unit system (inches or millimeters)
- Positioned near relevant features

**Layer Toggles:**
- Real-time show/hide without recalculation
- Customizable view for different production stages
- Export with selected layers only

**Responsive Scaling:**
- Automatically fits sheet within viewBox
- Maintains accurate proportions
- Adds padding for visual clarity

### Rendering Process

```javascript
// 1. Calculate layout
const layout = calculateLayout(inputs);

// 2. Build scene description
const scene = buildLayoutScene(layout);
// scene = {
//   sheet: { width, height },
//   documents: [{ x, y, width, height, cornerRadius }],
//   cuts: [{ x1, y1, x2, y2 }],
//   // ... other layers
// }

// 3. Determine scale
const scale = calculateOptimalScale(scene.sheet, viewBoxSize);

// 4. Render SVG
drawSVG(scene, scale);
// Creates <rect>, <line>, <circle> elements
// Applies layer attributes for visibility control
```

### Print-Specific Rendering

**Print Tab Features:**
- Separate layer controls for print output
- Black-and-white mode option
- Measurement callouts for production
- Page layout optimization

**Print CSS:**
- Hides UI controls
- Full-page SVG rendering
- High-resolution output
- Preserves aspect ratio

### Use Cases

**Design Verification:**
- Visual confirmation of document fit
- Margin and gutter validation
- Corner rounding preview

**Production Planning:**
- Cut line visualization
- Score/perforation positioning
- Hole drilling layout

**Client Communication:**
- Export visual mockups
- Print layout proofs
- Production specification sheets

---

## Metric / Imperial System

### Unit System Architecture

The application supports both imperial (inches) and metric (millimeters) unit systems with seamless switching and high precision.

### Core Conversion

**Conversion Constant:**
```javascript
MM_PER_INCH = 25.4
```

**Conversion Functions:**

```javascript
// Convert inches to millimeters
inchesToMillimeters(inches, precision = 2)
// Returns: 1.000 in → 25.40 mm

// Convert millimeters to inches
millimetersToInches(mm, precision = 3)
// Returns: 25.4 mm → 1.000 in
```

### Canonical Unit Storage

**Critical Design Decision:** All internal calculations use **inches as the canonical unit**.

**Rationale:**
- Prevents rounding errors during unit switching
- Maintains calculation accuracy
- Simplifies conversion logic

**Implementation:**
- User inputs are converted to inches on entry
- Calculations performed in inches
- Results converted to display units
- DOM elements store inch values (`data-inches` attribute)

**Example:**
```html
<!-- User sees: "88.90 mm" -->
<input type="text" value="3.5" data-inches="3.5">
<!-- Internally stored as 3.5 inches -->
```

### Precision Standards

**Display Precision:**
- **Inches:** 3 decimal places (0.001 in ≈ 0.025 mm)
- **Millimeters:** 2 decimal places (0.01 mm ≈ 0.0004 in)

**Formatting Functions:**

```javascript
// Format numeric value with unit-appropriate decimals
formatUnitsValue(value, units)
// Inches: "3.500"
// MM: "88.90"

// Format with unit label
formatMeasurement(value, units)
// Inches: "3.500 in"
// MM: "88.90 mm"
```

**Calculation Precision:**
- **Epsilon Tolerance:** 0.0001 inches for floating-point comparisons
- Prevents false inequalities from rounding
- Critical for document count calculations

### Unit System Switching

**User Controls:**
- Toggle button in app header
- Persists preference in localStorage
- Instant UI update without recalculation

**Switching Logic:**
```javascript
1. User clicks "mm" / "in" toggle
2. Read stored inch values from data-inches attributes
3. Convert to target units using formatMeasurement()
4. Update all input fields, labels, and readouts
5. Update SVG measurement annotations
6. Re-render tables and finishing measurements
```

**What Changes:**
- Input field values
- Measurement labels
- Table column headers
- SVG annotation text
- Export/print measurements

**What Doesn't Change:**
- Internal calculation values
- Layout geometry
- Document counts
- DOM structure

### Default Values by Unit System

**Imperial Defaults:**
```javascript
{
  sheet: { width: 12, height: 18 },        // Tabloid
  document: { width: 3.5, height: 2 },     // Business card
  gutter: { horizontal: 0.125, vertical: 0.125 },
  margins: { top: 0.25, right: 0.25, bottom: 0.25, left: 0.25 }
}
```

**Metric Defaults:**
```javascript
{
  sheet: { width: 297, height: 420 },      // A3
  document: { width: 85, height: 55 },     // Standard card
  gutter: { horizontal: 3, vertical: 3 },
  margins: { top: 6, right: 6, bottom: 6, left: 6 }
}
```

### Preset System Integration

**Preset Filtering:**
Presets are tagged with unit system applicability:
- `imperial-only` - US letter, tabloid, business card sizes
- `metric-only` - A4, A3, SRA3, DIN sizes
- `both` - Generic or converted sizes

**Example Presets:**

```javascript
// Imperial-only
{ name: "Letter", width: 8.5, height: 11, units: "imperial-only" }

// Metric-only
{ name: "A4", width: 210, height: 297, units: "metric-only" }

// Both (converted)
{ name: "Business Card", width: 3.5, height: 2, widthMM: 88.9, heightMM: 50.8 }
```

**Filtering Behavior:**
- When units = "in", show imperial-only and both
- When units = "mm", show metric-only and both
- Prevents mixing incompatible standards

### Edge Cases & Precision Handling

**Problem:** Floating-point arithmetic can cause precision issues

**Example:**
```javascript
// Without tolerance
(11.5 + 0.125) / (3.5 + 0.125) = 3.206896... → floor = 3

// With metric conversion and back
(11.5 * 25.4 / 25.4 + 0.125) / (3.5 * 25.4 / 25.4 + 0.125)
// May produce 3.206895999... or 3.207000001...
```

**Solution:** Epsilon-based comparisons

```javascript
const EPSILON = 0.0001; // 0.1 thousandths of an inch

function areEqual(a, b) {
  return Math.abs(a - b) < EPSILON;
}

function isGreaterThan(a, b) {
  return (a - b) > EPSILON;
}
```

**Application:**
- Document count calculations use tolerance-aware math
- Prevents off-by-one errors from rounding
- Ensures consistent results across unit switches

### User Experience Benefits

**Seamless Switching:**
- No data loss when toggling units
- Calculations remain accurate
- Instant visual feedback

**International Support:**
- Metric for European/Asian markets
- Imperial for US market
- Appropriate defaults per region

**Production Compatibility:**
- Measurements match local manufacturing standards
- Export in preferred units
- No manual conversion needed

### Technical Constraints

**Storage Format:**
Always store the inch value to prevent cumulative rounding:

```javascript
// GOOD: Store inches
element.dataset.inches = "3.5";
element.value = formatMeasurement(3.5, currentUnits);

// BAD: Store converted value
element.value = (3.5 * 25.4).toFixed(2); // Loses precision
```

**Conversion Timing:**
Convert at display time, not storage time:

```javascript
// GOOD: Convert when displaying
function updateDisplay(inches, units) {
  return units === 'mm'
    ? inchesToMillimeters(inches)
    : inches;
}

// BAD: Store converted and convert back
// Causes cumulative rounding errors
```

---

## Development Notes

### Testing Calculations

**Unit Tests:** Located in `tests/` directory using Vitest

**Key Test Coverage:**
- Document count edge cases
- Floating-point tolerance validation
- Metric/imperial conversion accuracy
- Layout area calculations
- Finishing operation positioning

**Run Tests:**
```bash
npm test
```

### Adding New Features

**Tab System:**
New features should be implemented as tabs:

1. Create HTML template in `html-partials/templates/`
2. Create tab controller in `js/tabs/`
3. Register in `js/init/register-tabs.js`
4. Implement `init()`, `onActivate()`, `onRegister()` hooks

**Calculation Extensions:**
Extend calculation functions in `js/calculations/`:
- Maintain inch-based calculations
- Add unit tests for new formulas
- Document precision requirements

### Performance Considerations

**Rendering Optimization:**
- SVG layer visibility via CSS (no DOM removal)
- Debounced input handlers
- Cached DOM element references

**Calculation Efficiency:**
- Calculations triggered only on input change
- No redundant recalculations
- Early exit for invalid inputs

---

## Glossary Reference

Quick reference for common terms:

| Term | Definition |
|------|------------|
| **Across** | Horizontal document count |
| **Down** | Vertical document count |
| **Gutter** | Space between documents |
| **Layout Area** | Printable region after margins |
| **Realized Margin** | Actual margin after fitting documents |
| **Trailing Margin** | Leftover space after documents |
| **Used Span** | Space consumed by documents + gutters |
| **Bifold** | Folding in half (2 panels) |
| **Trifold** | Folding in thirds (3 panels) |
| **SRA3** | Metric sheet size 320×450 mm |
| **Tabloid** | Imperial sheet size 11×17 in |

---

## Additional Resources

**Codebase Structure:** See `bootstrap.js` for application initialization flow

**Calculation Details:** See `js/calculations/layout-calculations.js` for core algorithms

**Rendering Pipeline:** See `js/rendering/svg-preview-renderer.js` for visualization

**Unit System:** See `js/utils/units.js` for conversion utilities

---

*This documentation is maintained for AI-assisted development with Claude Code. For user-facing documentation, see README.md.*
