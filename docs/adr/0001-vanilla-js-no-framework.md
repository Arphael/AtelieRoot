# 1. Vanilla JavaScript, no framework, no runtime dependencies

- Status: accepted
- Date: 2026-11-05

## Context
The editor is built on `contenteditable` with its own undo, selection and Markdown conversion.
It must run offline, from a single HTML file, in a browser, a local server or a desktop WebView.

## Decision
Plain classic scripts in `src/js/`, loaded in file-name order, sharing the global scope. No
framework, no bundler, no runtime dependencies. Prism is vendored. `scripts/build.mjs` only
concatenates.

## Consequences
- Zero install for development (`npm start` serves `src/`), tiny build (~520 KB), no supply-chain surface at runtime.
- No hoisting across files: forward references at load time fail (see CONTRIBUTING ground rules).
- A gradual move to ES modules + esbuild is in the backlog (roadmap S6), leaves first.
