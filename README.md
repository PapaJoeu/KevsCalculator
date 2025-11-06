# Kev's Calculator

A printable layout calculator prototype organized into a minimal static web project structure.

## Project Structure

```
.
├── docs/
│   ├── index.html        # UI markup that links to bundled assets in /docs
│   ├── css/
│   │   └── style.css     # Layout and presentation styles for the calculator
│   └── js/
│       └── app.js        # Calculator logic, rendering helpers, and event bindings
└── README.md             # Project overview
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
