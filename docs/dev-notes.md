# Tab Template Reference

## HTML templates

- `tab-inputs-template` → hydrates the Inputs panel with the full set of measurement controls, preset pickers, and action buttons used to drive the calculator UI.【F:docs/index.html†L87-L186】
- `tab-presets-template` → provides the preset layout cards whose buttons call into the presets tab module for quick configuration presets.【F:docs/index.html†L190-L253】
- `tab-summary-template` → renders the summary metric cards and layer visibility toggles that are updated after each calculation.【F:docs/index.html†L254-L273】
- `tab-finishing-template` → supplies the tabular views for cut and slit measurements shown when the finishing tab is active.【F:docs/index.html†L274-L284】
- `tab-scores-template` → defines both the score configuration controls and the resulting measurement tables used in the Scores tab.【F:docs/index.html†L285-L339】
- `tab-perforations-template` → mirrors the score template for perforation planning, offering configuration inputs and result tables.【F:docs/index.html†L340-L419】
- `tab-warnings-template` → holds placeholder copy for future production warnings and notes.【F:docs/index.html†L420-L436】
- `tab-print-template` → provides the printable summary snapshot and container for generated print tables.【F:docs/index.html†L437-L458】

## JavaScript usage

- Each tab panel is empty in the static markup and advertises its template through the `data-tab-template` attribute (e.g., `<section id="tab-inputs" data-tab-template="tab-inputs-template">`).【F:docs/index.html†L72-L99】
- `tabs/registry.js` hydrates a panel the first time it is requested by cloning `template.content` into the matching section, marking it as hydrated, and memoizing the panel to avoid repeated DOM work.【F:docs/js/tabs/registry.js†L15-L38】
- Individual tab modules call `hydrateTabPanel(TAB_KEY)` from their `init`, `onActivate`, or `onRegister` hooks to ensure their panels receive the template fragment before wiring any tab-specific behavior.【F:docs/js/tabs/inputs.js†L400-L435】【F:docs/js/tabs/scores.js†L94-L161】【F:docs/js/tabs/presets.js†L73-L112】【F:docs/js/tabs/finishing.js†L1-L20】【F:docs/js/tabs/perforations.js†L92-L172】【F:docs/js/tabs/summary.js†L1-L29】【F:docs/js/tabs/warnings.js†L1-L20】【F:docs/js/tabs/print.js†L1-L20】

## Initialization order

- `app.js` registers the tab modules in a defined order—inputs, summary, finishing, scores, perforations, warnings, print, and presets—so that any inter-module dependencies (e.g., presets needing the scores/perforations APIs) are available when `module.init` executes immediately after registration.【F:docs/js/app.js†L567-L604】
- The tab registry is then initialized, which resolves the default active tab (`inputs`) and hydrates it on first activation, ensuring templates are present before user interaction begins.【F:docs/js/app.js†L606-L612】【F:docs/js/tabs/registry.js†L39-L66】
