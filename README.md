# Kev's Calculator

A printable layout calculator prototype organized into a minimal static web project structure.

## Project Structure

```
.
├── docs/
│   ├── index.html        # UI markup that pulls in compiled CSS/JS assets
│   ├── css/
│   │   └── style.css     # Layout and presentation styles for the calculator
│   └── js/
│       ├── bootstrap.js  # Loads HTML fragments/templates, then starts the controllers
│       ├── calculator-app-controller.js
│       │                   # Registers layout controllers and initializes tabs
│       ├── controllers/   # Shared layout controller modules (update, status, etc.)
│       └── tabs/          # Individual tab controllers plus the registry (tabs/registry.js)
└── README.md             # Project overview
```

### Boot sequence overview

```
docs/js/bootstrap.js
        │
        ├─▶ loadFragments()  ─┐
        ├─▶ loadTemplates()  ├─ prepares DOM partials/templates referenced by index.html
        │                    │
        └─▶ import('calculator-app-controller.js')
                               │
                               ├─ registerTabs({ update, status })
                               │        └─ tabs/registry.js wires per-tab controllers
                               │              and hydrates tab templates on activation
                               └─ update() kicks the layout controllers once everything is wired
```

Open `docs/index.html` in a browser to run the calculator.

## Deployment

GitHub Pages automatically serves content from the `docs/` directory, so
publishing the project only requires pushing the repository to GitHub with
Pages enabled for the repository. The `index.html` file remains at the root of
`docs/`, allowing all of the relative CSS and JavaScript asset paths to resolve
without modification.

For local previews, you can open `docs/index.html` directly in your browser or
serve the folder via any static file server (for example,
`npx serve docs`).
