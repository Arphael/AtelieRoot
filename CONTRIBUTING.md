# Contributing

Thanks for helping. By taking part you agree to the [Code of Conduct](CODE_OF_CONDUCT.md).
Questions go to [SUPPORT.md](SUPPORT.md); vulnerabilities to [SECURITY.md](SECURITY.md), never to a public issue.

## Workflow

1. **Setup**: Node 18+, Python 3.9+, `pip install playwright && python -m playwright install chromium`.
   For the desktop app also Rust and Tauri: see [docs/BUILDING.md](docs/BUILDING.md).
2. **Branch** and work in `src/` (no build needed: `npm start` serves `src/` as is, with `./notas`, which git ignores).
3. **Test first** (follow `tests/e2e/test_enter_pushdown.py`) and check it fails for the right reason.
4. **Implement** the minimum.
5. **Before the PR**: `npm test` and `npm run test:dist` green.
6. **Document**: anything stored on disk or any backend behavior -> [docs/CONTRACT.md](docs/CONTRACT.md); new module -> [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md); user-visible change -> [CHANGELOG.md](CHANGELOG.md).

## Commands

| Command                             | What it does                                                                           |
| ----------------------------------- | -------------------------------------------------------------------------------------- |
| `npm run check`                     | Structure, syntax, strict mode, no network URLs (< 1 s)                                |
| `npm test`                          | check + lint + server, contract and unit (`node --test`) + browser (Playwright) against `src/` (~3 min) |
| `npm run lint`                      | ESLint: names that do not exist and names never used (`eslint.config.mjs`)             |
| `npm run test:unit`                 | Unit tests of pure functions (`tests/unit/`, no browser, < 1 s)                        |
| `python tests/run.py --browser firefox` | Browser tests in Firefox (or `webkit`); tests that need Chromium declare `ENGINES`   |
| `python tests/run.py --only <text>` | Only the tests whose name contains `<text>`                                            |
| `npm run test:dist`                 | Build and repeat browser tests against `dist/`. Required before calling something done |
| `npm start`                         | Local server with `./notas`                                                            |

Browser tests load the page with `?test=1` (no welcome screen).

## Ground rules

1. **Every JS file starts with `"use strict";`** (strict mode is per script).
2. **No forward references at load time.** Files share the global scope and load in file-name order, without hoisting between files. If top-level code names a function declared in a _later_ file, it fails. Use a lazy arrow (`run: () => myFunction()`) or move the declaration.
3. **The disk is the truth** (with a folder open). Never really delete: removed items go to `.atelierroot/trash`. Never rewrite a file whose Markdown did not change. If a file changed outside, never overwrite it: your version goes to a copy.
4. **Foreign content is hostile.** Everything coming from a `.md` goes through `esc()`, links and images through `urlAllowed()`. Never assign unescaped text to `innerHTML`.
5. **No network.** No `<script src="https://...">`, no web fonts, no external `fetch` (`npm run check` enforces it). Prism lives in `src/vendor/`.
6. **Minimal server.** It only writes `.md` and `.atelierroot/`. Any new permission in `server/atelierroot-server.js` (or the Tauri backend) needs a test and a written justification.
7. **Every fixed bug gets a test** in `tests/e2e/` or `server/test/` that fails without the fix.

## Known pitfalls

- **DOM changes that bypass `History` create a phantom pending change**, and Ctrl+Z only undoes them. It happened with Prism highlighting (also async, when the autoloader fetches a language); solved with `hlCleanHint` and the Prism hooks in `41-syntax-highlight.js`. Anything that touches the DOM after an edit must do the same.
- **`stash()` copies the editor to `state.docs[id]` only if `Dirty.has(id)`.** In tests, changing `state.docs` by hand without `refreshEditorsFor(id)` lets `stash()` overwrite it.
- **While a dialog is open (`#veil.show`) the app ignores several keys.** That is why tests use `?test=1`.
- **Playwright calls an `evaluate` expression whose value is a function**: end it with `; 0`.
- **Headless Chromium closes when reading a folder handle from IndexedDB.** `workspace_fs` tests replace `WsHandles` with `window.__WS_HANDLES`. Real Chrome works, but it is not covered by automated tests.
- **Every browser test must use `from browser import URL, LAUNCH`.** Old suites once read a fixed URL and silently tested another file.
- **Wait with `until`, never fixed `sleep`s**: typing (`caretInto(...)`), saving and polling are asynchronous.

## Recipes

- **New JS file**: `src/js/NN-name.js` (number = load order), starts with `"use strict";`, add its `<script>` to `src/index.html` in order, run `npm run check`.
- **New interface text**: add `'area.name': ['Texto', 'Text']` to `STR` in `src/js/05-i18n.js`; use `T('area.name', { n })` in code or `data-i18n*="area.name"` in HTML. If the module paints the text itself, repaint it on `langchange`.
- **New highlight language**: add it to `scripts/prism-languages.json`, run `npm run vendor:prism`.
- **New server permission**: add the case to `tests/contract/scenarios.json` first (both backends run it), then change `server/atelierroot-server.js` and `src-tauri/src/fsops.rs`; explain in the PR why it is safe.
- **Release**: add the `## [X.Y.Z] - date` section to `CHANGELOG.md`, bump the version, push, then tag `vX.Y.Z`; that section becomes the release text.
- **Working-folder test**: add the scene to `tests/e2e/ws_common.py` (runs against both backends).
- **Golden values** (`tests/e2e/golden/`): `UPDATE_GOLDEN=1 python tests/e2e/test_enter_pushdown.py`, review the diff.

## Review checklist

- Is there a test that fails without the change?
- Was the server or the Tauri backend touched? (security review)
- Does foreign content reach the DOM?
- Does anything really delete files?
- Does anything request the internet?

Do not change the on-disk format or conflict logic (`wsFlushDocs`, `wsRefreshOnce`) without discussion: mistakes there lose people's data.

## Style

- New docs and code comments in English; existing Spanish comments stay until touched.
- Interface text goes in `src/js/05-i18n.js` as `'key': [spanish, english]` and is used with `T('key')` (Spanish with informal "tú"). `npm run check` rejects literal texts in toasts and dialogs.
- No new dependencies without a strong reason.
- Small functions with a one-line comment that says _why_.
- Keep the numbered section headers `/* ====== N. title ====== */`: they act as each file's index.
- Commits in imperative present ("Add...", "Fix..."); one PR = one thing.
