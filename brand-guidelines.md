# Kev’s Bitchin’ Print Calculator

## Brand Guidelines

These notes describe the unified UI system now in use across the calculator. Reference them when introducing new components or updating existing templates.

---

## 🎨 Color Palette

| Token | Intent | Hex |
|-------|--------|-----|
| `--color-surface-0` | App background | `#0f1115` |
| `--color-surface-1` | Panels & cards | `#171a21` |
| `--color-surface-2` | Elevated controls | `#1a1f2a` |
| `--color-surface-3` | Overlays / stage chrome | `#11141b` |
| `--color-border` | Default border | `#222632` |
| `--color-border-strong` | Structural dividers | `#2c3446` |
| `--color-border-accent` | Focus & hover outline | `#1f8a8a` |
| `--color-accent` | Interactive accent | `#5eead4` |
| `--color-text-primary` | Primary text | `#e6e9ef` |
| `--color-text-secondary` | Secondary copy | `#b8c0cc` |
| `--color-text-muted` | Helper copy | `#8892a6` |
| `--color-success` | Positive state | `#22c55e` |
| `--color-warning` | Warning tone | `#f59e0b` |
| `--color-danger` | Destructive state | `#ef4444` |
| `--color-paper` | Print background | `#ffffff` |

Visualizer accents reuse dedicated tokens such as `--viz-line-cut`, `--viz-line-score`, and `--viz-layer-selected` so SVG rendering stays consistent with the UI theme.

---

## ✍️ Typography

* Font stack: `system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif`
* Base size / line height: `var(--font-md)` / `var(--line-height-base)`
* Scale tokens: `--font-xs` (0.8rem), `--font-sm` (0.9rem), `--font-md` (1rem), `--font-lg` (1.25rem), `--font-xl` (1.5rem)
* Heading weight: 600+; body copy 400.

Use `.text-muted`, `.text-secondary`, and `.text-metric` utilities to express hierarchy, captions, and tabular numerics.

---

## 📏 Spatial System

* Spacing tokens: `--space-1` (4px) through `--space-6` (32px)
* Radii: `--radius-sm` (6px), `--radius-md` (10px), `--radius-lg` (14px)
* Shadows: `--shadow-sm` and `--shadow-lg`
* Motion: `--motion-fast` (150ms), `--motion-slow` (300ms)

### Utilities

* `.layout-stack` + `data-gap="tight|snug|cozy|relaxed|spacious"`
* `.layout-grid` + `data-cols` / `data-min` for responsive grids
* `.layout-cluster` for inline groupings with optional `data-align`
* `.pad-*`, `.gap-*`, `.radius-*`, `.shadow-*` for quick tweaks
* `.layout-panel` and `.layout-card` standardize chrome across the app.

---

## 🧩 Components

### Buttons

```html
<button class="btn">Default</button>
<button class="btn btn-primary">Primary</button>
<button class="btn btn-ghost">Ghost</button>
<button class="btn btn-swap" aria-label="Swap">↔︎</button>
```

### Form Controls

```html
<label class="form-label">
  <span>Label</span>
  <input class="form-control" type="number" />
</label>

<select class="form-select">
  <option>Option</option>
</select>

<label class="form-choice">
  <input class="form-choice__control" type="checkbox" checked />
  <span class="form-choice__label">Printable layer</span>
</label>
```

`form-grid--dual`, `form-row[data-cols]`, `form-toolbar`, and `.form-choice` cover the majority of calculator inputs without bespoke CSS.

### Visualizer

```html
<section class="layout-panel viz-shell layout-stack" data-gap="cozy">
  <div class="viz-layout">
    <div class="viz-stage viz-theme"><svg id="svg"></svg></div>
    <aside class="viz-layers">
      <label class="viz-layer-toggle">
        <input class="viz-layer-input" type="checkbox" data-layer="layout" checked />
        <span class="viz-layer-label">
          <i class="viz-legend-swatch" data-layer="layout"></i>
          Layout Area
        </span>
      </label>
    </aside>
  </div>
</section>
```

### Summary Cards

```html
<article class="layout-card summary-card">
  <h3>Counts</h3>
  <dl class="summary-metrics">
    <div><dt>Across</dt><dd class="text-metric">12</dd></div>
    <div><dt>Down</dt><dd class="text-metric">18</dd></div>
  </dl>
</article>
```

---

## 🔄 Migration Map

| Old Class | New Class / Pattern |
|-----------|---------------------|
| `.layout-app-shell` | `.layout-shell` |
| `.layout-app-header` | `.layout-header` |
| `.content-section` | `.layout-panel` |
| `.data-card` | `.layout-card` |
| `.stack` | `.layout-stack` + `data-gap` |
| `.grid`, `.grid--columns-2`, `.grid--auto-fit` | `.layout-grid` + `data-cols` / `data-min` |
| `.control-toolbar` | `.form-toolbar layout-cluster` |
| `.input-2col-grid` | `.form-grid--dual` |
| `.input-field-row(-quad)` | `.form-row` (+ `data-cols="4"` where needed) |
| `.input-field-action` | `.form-row-actions` |
| `.action-button` | `.btn` |
| `.action-button-primary` | `.btn btn-primary` |
| `.action-button-ghost` | `.btn btn-ghost` |
| `.input-swap-button` | `.btn btn-swap` |
| `.sheet-preview-stage` | `.viz-stage` |
| `.layer-visibility-panel` | `.viz-layers` |
| `.layer-visibility-option` | `.viz-layer-toggle` |
| `.layer-visibility-toggle-input` | `.viz-layer-input` |
| `.sheet-preview-visualizer` | `.viz-shell` |
| `.measurement-row` | `.viz-measure-row` |
| `.output-tab-navigation` | `.tabs-nav` |
| `.output-tab-trigger` | `.tabs-trigger` |
| `.output-tabpanel-collection` | `.tabs-panels` |
| `.print-layer-panel` | `fieldset.layout-card.layout-stack` |
| `.print-layer-option` | `.form-choice` + `.print-layer-toggle` |

When migrating markup, prefer the utility-first structure shown above and remove obsolete modifiers (e.g., `stack--snug`).

---

## 🧾 Notes

* All color, spacing, and typography values are centralized in `docs/css/tokens.css`.
* Responsive adjustments lean on fluid grids and gap utilities; avoid bespoke media queries unless a layout truly requires them.
* The print experience uses `.print-stage` with `.form-choice` toggles—visibility still respects `.print-hidden` / `.print-only` helpers.
