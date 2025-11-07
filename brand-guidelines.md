# Kev’s Bitchin’ Print Calculator  
### Brand Guidelines

<!--
Context:
This document defines the visual language and token system for Kev’s Bitchin’ Print Calculator.
It standardizes colors, spacing, typography, and component naming so Codex or contributors can maintain visual consistency.
The palette is inspired by print-production logic — clear contrast, legible metrics, and cyan/magenta/black cues familiar in prepress environments.
-->

---

## 🎨 1. Color System

<!--
Purpose:
Colors are designed for readability in dark environments (like print shops) and to reflect prepress conventions:
- Cyan = layout guides
- Magenta/Purple = score/perf lines
- Red = cut/trim
- Orange = safety zones
-->

| Token | Role | Description | Hex | Notes |
|-------|------|--------------|------|-------|
| `--color-surface-0` | Background | Deep neutral background | `#0f1115` | Almost black, easy on eyes in dim rooms |
| `--color-surface-1` | Panel / Card | Slightly lighter than background | `#171a21` | Creates depth for cards and panels |
| `--color-surface-2` | Overlay / Elevated | Used for toolbars and modals | `#1a1f2a` | Subtle contrast from panels |
| `--color-border` | Neutral divider | For outlines, frames, and separators | `#222632` | Matches print-trim line tone |
| `--color-accent` | Accent / Focus | Used for highlights and hover | `#5eead4` | Teal/cyan, evokes press calibration blues |
| `--color-text-primary` | Main text | Default body color | `#e6e9ef` | Off-white, avoids harsh contrast |
| `--color-text-secondary` | Secondary text | Labels, helper text | `#b8c0cc` | Mid-gray for hierarchy |
| `--color-success` | Positive | Success or OK status | `#22c55e` | Vivid green, proof approval cue |
| `--color-warning` | Warning | Alerts, cautions | `#f59e0b` | Warm amber for visual pop |
| `--color-danger` | Error | Destructive or invalid state | `#ef4444` | Bright red for failures or deletions |

**Usage Guidelines**
- Dark mode by default — use `--color-surface-0` and `--color-surface-1` for depth.
- For print previews, invert text to black on white (`--color-paper: #ffffff;`).
- Avoid hex codes in components. Always reference tokens.

---

## 🧱 2. Spacing Scale

<!--
Purpose:
Spacing maintains a rhythm across components.
The 4px base unit mirrors print design grid precision.
-->

| Token | Value | Use Case |
|--------|--------|----------|
| `--space-1` | 4px | Hairline spacing, icon gaps |
| `--space-2` | 8px | Compact padding (buttons, labels) |
| `--space-3` | 12px | Default grid gap |
| `--space-4` | 16px | Card padding, stack gaps |
| `--space-5` | 24px | Section padding |
| `--space-6` | 32px | Page margins, full layout spacing |

**Rules**
- Use `.gap-sm`, `.gap-md`, `.gap-lg` utilities built from these tokens.
- Avoid hard-coded margins; rely on standardized space tokens.

---

## ✍️ 3. Typography

<!--
Purpose:
The typography mirrors production documentation — clear, readable, system-native fonts.
No branding flourishes, no webfonts, just functional, universally available families.
-->

| Token | Size | Weight | Role |
|--------|------|--------|------|
| `--font-xs` | 0.8rem | 400 | Footnotes, metadata |
| `--font-sm` | 0.9rem | 400 | Labels, secondary info |
| `--font-md` | 1rem | 400 | Default body text |
| `--font-lg` | 1.25rem | 600 | Section headings |
| `--font-xl` | 1.5rem | 700 | App titles |

**Font Family**
```
system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif
```
- Matches platform defaults for native clarity.
- Resembles UI text seen in production software (Adobe, RIP utilities).
- Line height: `1.45` for legibility in dense panels.

---

## 🧩 4. Radius, Shadow & Motion

<!--
Purpose:
Subtle shadows and radii emulate layered paper stacks — tactile but restrained.
-->

| Token | Value | Use |
|--------|--------|-----|
| `--radius-sm` | 6px | Inputs, small buttons |
| `--radius-md` | 10px | Cards, modals |
| `--radius-lg` | 14px | Panels, containers |
| `--shadow-sm` | `0 2px 4px rgba(0,0,0,0.3)` | Subtle inset depth |
| `--shadow-lg` | `0 12px 24px rgba(0,0,0,0.4)` | Elevated overlays |
| `--motion-fast` | 150ms | Hover or tap transitions |
| `--motion-slow` | 300ms | Panel expansion, modals |

---

## 🧱 5. Component Naming System

<!--
Purpose:
Classes should describe what something *is*, not how it’s laid out.
Prefixes group components by domain: layout, form, button, visualizer, etc.
-->

| Component | Old Class | New Class | Purpose |
|------------|------------|-----------|----------|
| App Shell | `.layout-app-shell` | `.layout-shell` | Main wrapper container |
| Header | `.layout-app-header` | `.layout-header` | Title area |
| Input Grid | `.input-2col-grid` | `.form-grid--dual` | Two-column form group |
| Swap Button | `.input-swap-button` | `.btn-swap` | Swap control button |
| Action Button | `.action-button-primary` | `.btn-primary` | Main action |
| Sheet Preview | `.sheet-preview-stage` | `.viz-stage` | Layout visualizer |
| Visibility Panel | `.layer-visibility-panel` | `.viz-layers` | Layer toggles |
| Summary Section | `.summary-calculator-section` | `.summary-section` | Output summary panel |

**Prefix Convention**
- `layout-` = structure  
- `form-` = inputs and controls  
- `btn-` = button styles  
- `viz-` = visualization elements  
- `summary-` = output and reporting  

---

## 🧮 6. Utility Classes

<!--
Purpose:
Lightweight utilities replace one-off declarations, making markup easier to compose.
-->

| Utility | Function |
|----------|-----------|
| `.layout-stack[data-gap="snug"]` | Vertical flex stack with adjustable spacing |
| `.layout-grid[data-cols="2"]` | Responsive grid with 2 columns |
| `.pad-sm`, `.pad-md`, `.pad-lg` | Padding utilities (use space tokens) |
| `.gap-sm`, `.gap-md`, `.gap-lg` | Gap utilities |
| `.text-muted`, `.text-secondary` | Text hierarchy helpers |
| `.radius-md`, `.shadow-lg` | Border radius and elevation helpers |

---

## 🖨️ 7. Print Mode

<!--
Purpose:
When printing a layout summary or measurement sheet, UI chrome should be hidden.
Maintain color and spacing but switch to light theme.
-->

**Rules**
- Background → `--color-paper: #ffffff`
- Text → `--color-text-inverse: #000000`
- Hide `.is-interactive`, `.print-hidden`
- Remove shadows and borders for accurate print dimensions.

---

## 📘 8. Example Component Usage

#### Button
```html
<button class="btn-primary">Calculate Layout</button>
```

#### Form Input
```html
<label class="form-label">
  Sheet Width
  <input class="form-control" type="number" value="12">
</label>
```

#### Visualizer
```html
<section class="viz-stage">
  <svg class="viz-canvas"></svg>
</section>
```

---

## ⚙️ 9. Migration Map

<!--
Purpose:
Links old class names to the new semantic system for easy find-and-replace.
-->

| Old Class | New Class |
|------------|-----------|
| `.input-2col-grid` | `.form-grid--dual` |
| `.action-button` | `.btn` |
| `.action-button-primary` | `.btn-primary` |
| `.sheet-preview-visualizer` | `.viz-container` |
| `.layer-visibility-option` | `.viz-layer-item` |
| `.summary-calculator-section` | `.summary-section` |

---

<!--
End Notes:
This brand system keeps the dark, production-ready feel of the current app but cuts redundancy.
All future UI additions (e.g., hole drilling, scoring tabs) should extend from these tokens and naming patterns.
-->