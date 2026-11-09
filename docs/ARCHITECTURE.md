# Architecture

## Stack

| Layer                   | Technology                                                                          |
| ----------------------- | ----------------------------------------------------------------------------------- |
| UI / editor             | Vanilla JavaScript (classic scripts, no framework), CSS, `contenteditable`          |
| Syntax highlight        | Prism 1.29, vendored in `src/vendor/prism/` (no CDN)                                |
| Local server            | Node.js >= 18, single file `server/atelierroot-server.js`, zero dependencies            |
| Browser-only storage    | File System Access API (Chrome/Edge) or IndexedDB + `localStorage`                  |
| Desktop app             | Tauri v2: Rust backend in `src-tauri/`, system WebView, one portable file           |
| Build                   | `scripts/build.mjs` concatenates `src/` into `dist/` (~520 KB); no bundler          |
| Tests                   | `node --test` (server), `cargo test` (Rust), Python + Playwright (e2e)              |
| CI / release / security | GitHub Actions: `ci.yml`, `pages.yml`, `release.yml`, `codeql.yml`, `scorecard.yml` |

Runtime dependencies of the web app: none. The desktop app adds the Tauri crates (`src-tauri/Cargo.toml`).
The only npm package is `@tauri-apps/cli`, a development tool. The app never contacts the internet.

## Overview

```
 +------------------- UI (WebView or browser) -------------------+
 |  Editor and UI          src/js, src/css                       |
 |    state.tree / state.docs (HTML)                             |
 |        |                                                      |
 |  Folder core            82-ws-core.js  (queue, sync, journal) |
 |        |                                                      |
 |  Backends               81-ws-backends.js                     |
 |    +- HttpBackend  --HTTP+token-->  server/atelierroot-server.js  |---> your folder/*.md
 |    +- FsBackend    --File System Access API------------------ |---> your folder/*.md
 |    +- TauriBackend --invoke()-->    src-tauri (Rust)          |---> your folder/*.md
 |  Temporary mode         20-storage-local.js, 56-tab-sync.js   |---> IndexedDB
 +---------------------------------------------------------------+
```

At boot (`99-boot.js` -> `wsBoot()` in `83-ws-ui.js`) AtelierRoot picks one storage mode:

1. **Working folder** (normal): local server (page has `<meta name="atelierroot-token">`), a
   remembered browser folder handle, or the desktop app (`window.__TAURI__`). Every document is a `.md`.
2. **Temporary mode**: no folder and no server. IndexedDB + `localStorage`, per-document
   versions and cross-tab merge. Disabled (`Sync.ready = false`) when a folder is open.

The hook point is small: `runPersist()` and `flushNow()` in `56-tab-sync.js` divert to
`wsSchedule()` / `wsFlush()` when `Workspace.active`.

All backends obey [CONTRACT.md](CONTRACT.md).

## Distribution

| Audience               | Artifact                                                                                          | Needs     |
| ---------------------- | ------------------------------------------------------------------------------------------------- | --------- |
| End users              | Portable `AtelierRoot.exe` (and the same app as `AtelierRoot.html`) from GitHub Releases (installers `.msi`, `.dmg`, `.AppImage`/`.deb` in S4) | nothing   |
| Try without installing | GitHub Pages build (`dist/`), Chrome/Edge for folders                                             | a browser |
| Developers / headless  | Clone + `npm start` (Node server)                                                                 | Node 18+  |

The full repository lives on GitHub; users download only the executable.

## In-memory model

| Object            | What it is                                                                                            |
| ----------------- | ----------------------------------------------------------------------------------------------------- |
| `state.tree`      | Nodes `{ id, type:'doc'\|'folder', name, children?, open?, mod?, path? }`                             |
| `state.docs[id]`  | Internal HTML of each document (what `#ed` edits)                                                     |
| `state.trash`     | `{ id, node, docIds, parentId, at, docPaths? }`                                                       |
| `state.fills[id]` | Values of `[UPPERCASE]` placeholders                                                                  |
| `Dirty`           | Docs touched in this tab                                                                              |
| `History`         | Own undo stack (`21-history.js`), snapshots of `ed.innerHTML`                                         |
| `Workspace`       | Folder state: `known` (disk `{t,m,s}` per path), `text`, `saved`, `nodes`, trash info, `q` (op queue) |

The editor always works in HTML. Markdown is only the file format:
`domFromMd(tidyMd(md))` on read, `mdFromDom(div)` on write (`10-markdown.js`).

## Load order and global scope

`src/js/` files are classic scripts sharing the global scope, loaded **in file-name order**
by `src/index.html`:

- A function declared in a later file does not exist yet while an earlier file's top-level
  code runs. Inside functions (run after load) there is no problem.
- Every file starts with `"use strict";`.
- `npm run build` concatenates them into one `<script>` (with hoisting): a bug that appears
  only in `dist/` or only in `src/` is usually this.
- Section headers `/* ====== N. title ====== */` keep numbers from the original single file;
  they are history, not order.

## Modules (`src/js/`)

| File                           | Contents                                                               |
| ------------------------------ | ---------------------------------------------------------------------- |
| `00-base.js`                   | Global variables and helpers (`$`, `ed`, `scroll`, `esc`...)           |
| `10-markdown.js`               | DOM -> Markdown, Markdown -> DOM, normalizer                           |
| `20-storage-local.js`          | Temporary-mode storage (IndexedDB)                                     |
| `21-history.js`                | Own undo stack                                                         |
| `22-tree.js`                   | Document tree and sidebar search                                       |
| `23-document.js`               | Open, stash and refresh documents                                      |
| `30-blocks-cursor.js`          | Blocks and caret helpers                                               |
| `31-keyboard.js`               | Keyboard handling                                                      |
| `32-toolbar.js`                | Inline formatting and toolbar                                          |
| `33-code-blocks.js`            | Code blocks, table insertion                                           |
| `34-paste.js`                  | Paste                                                                  |
| `35-copy-sort-md.js`           | Copy, sort, live Markdown view                                         |
| `36-links-images.js`           | Links and images                                                       |
| `37-export-theme.js`           | Export, backup, theme                                                  |
| `38-menus-dialogs.js`          | Menus and dialogs                                                      |
| `40-lists.js`                  | Lists: toggle and exit                                                 |
| `41-syntax-highlight.js`       | Prism highlighting, text utilities                                     |
| `42-placeholders.js`           | `[UPPERCASE]` placeholders                                             |
| `43-find-replace.js`           | Find and replace                                                       |
| `44-toolbar-menu.js`           | Toolbar block menu                                                     |
| `45-outline-focus-switcher.js` | Outline, focus mode, quick switcher                                    |
| `46-import-md.js`              | Import `.md` files                                                     |
| `47-autopair-shortcuts.js`     | Auto-closing pairs, global shortcuts                                   |
| `48-responsive-ui.js`          | Adaptive toolbar ("Más" overflow), small screens                       |
| `49-tree-ui-trash.js`          | Tree: drop, row menu, duplicate, move to; trash                        |
| `50-wikilinks.js`              | `[[name]]` links between documents                                     |
| `51-block-selection.js`        | Block selection and dragging                                           |
| `52-folding.js`                | Fold sections                                                          |
| `53-split-view.js`             | Split view                                                             |
| `54-command-palette.js`        | Command palette                                                        |
| `55-enter-paragraphs.js`       | Enter in paragraphs                                                    |
| `56-tab-sync.js`               | Safe saving across tabs (temporary mode)                               |
| `57-scroll-position.js`        | Reading position per document                                          |
| `58-line-moves.js`             | Move lines with Alt+Up/Down                                            |
| `59-enter-shortcuts.js`        | Enter shortcuts (divider, quote); inline format exit                   |
| `60-numbering.js`              | Connected numbering                                                    |
| `61-linebreak-marks.js`        | Line-break marks                                                       |
| `62-format-selection.js`       | Formatting over the whole selection                                    |
| `63-delete-line.js`            | Delete line (Shift+Del); clean browser styles on block merge           |
| `64-copy-cut-line.js`          | Copy/cut the line without selection                                    |
| `65-text-to-table.js`          | Table-shaped text -> table                                             |
| `66-inline-code.js`            | Inline code without `<code>`                                           |
| `67-sidebar-context.js`        | Sidebar context menu; toggle bullet/numbered item                      |
| `68-move-sort.js`              | Move selection, sort, nested numbering in Markdown                     |
| `69-autobackup.js`             | Automatic snapshot before an update                                    |
| `70-normalize.js`              | Single-line headings, merge adjacent lists                             |
| `71-tables.js`                 | Tables                                                                 |
| `72-hr-pipes-selection.js`     | `---` + Enter, pipe rows, block selection while scrolling              |
| `73-table-extras.js`           | Table size on insert, numeric alignment, column width, alignment scope |
| `74-outline-current.js`        | Outline highlights the current heading                                 |
| `75-slash-code.js`             | `/command` becomes inline code                                         |
| `76-links-urls.js`             | URLs become real links                                                 |
| `77-exit-inline.js`            | Inline format ends with a space after paths, commands, URLs            |
| `80-enter-pushdown.js`         | Enter at the start of a format pushes it down                          |
| `81-ws-backends.js`            | Working folder: backends (HTTP, File System Access, Tauri)             |
| `82-ws-core.js`                | Working folder: load, sync, save, outside changes, journal             |
| `83-ws-ui.js`                  | Working folder: screens and boot                                       |
| `99-boot.js`                   | Boot                                                                   |
| `05-i18n.js` (S2, planned)     | Dictionaries and `t(key)`                                              |

CSS lives in `src/css/01-base.css` ... `21-workspace.css`, same ordering rule.

## i18n (roadmap S2)

- `src/js/05-i18n.js` loads before any UI code: `I18N = { es: {...}, en: {...} }`, `t(key, vars)`.
- Static HTML uses `data-i18n`, `data-i18n-title`, `data-i18n-aria`, `data-i18n-ph`;
  `applyI18n()` repaints them on switch. Dynamic strings call `t()` at render time.
- `<html lang>` and the export template follow the current language.

## Desktop app (`src-tauri/`)

| File                        | Role                                                                                                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/main.rs`               | Window, commands `ws_root`, `ws_pick`, `ws_clear`, `ws_list`, `ws_read`, `ws_write`, `ws_mkdir`, `ws_move`, `ws_remove`; remembered folder in the app config dir (`settings.json`); change poller (1.2 s) emitting `ws-changed` |
| `src/fsops.rs`              | The contract rules in Rust (path validation, writable rules, atomic write, `expect` conflict, trash restore) and their unit tests                                                                                               |
| `tauri.conf.json`           | Frontend = `dist/` (built by `beforeBuildCommand`), strict CSP, no bundling for the portable build                                                                                                                              |
| `capabilities/default.json` | Only `core:default`: the page gets no generic filesystem, shell or network permission                                                                                                                                           |

- `TauriBackend` in `81-ws-backends.js` is chosen when `window.__TAURI__` exists; errors arrive as `code:message`.
- `tests/e2e/test_workspace_tauri.py` checks the frontend wiring against a simulated `window.__TAURI__`; `cargo test` checks the Rust rules.

## Tests

- `server/test/` - `node --test`: API and every security rule.
- `tests/e2e/` - Python + Playwright. `browser.py` sets URL and browser; `ws_common.py` holds
  folder scenarios run against both backends via an abstract disk (`Disk` = real folder,
  `OpfsDisk` = OPFS).
- `tests/e2e/golden/` - reference values (`UPDATE_GOLDEN=1` regenerates; review the diff).
- `tests/run.py` - runs everything; `--dist` against the build.
