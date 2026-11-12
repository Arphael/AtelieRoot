# Roadmap

Sprints from cleanup to a public, multi-platform release. Each sprint ends with
`npm test` and `npm run test:dist` green. Weights: Light < Medium < Heavy.

| Sprint | Goal                                            | Weight | Status      |
| ------ | ----------------------------------------------- | ------ | ----------- |
| S0     | Cleanup and documentation                       | Medium | Done        |
| S1     | Public repository, CI, security, community docs | Medium | Done        |
| S2     | Interface in English and Spanish                | Heavy  | Done        |
| S3     | Desktop app with Tauri (moved ahead of S2)      | Heavy  | Done        |
| S4     | Multi-platform releases                         | Medium | Skipped     |
| S5     | Quality and browser coverage                    | Heavy  | Done        |
| S6     | New features                                    | Medium | Backlog     |

## S0 - Cleanup and documentation (done)

- [x] Neutral welcome document (no artifact-era seed).
- [x] Portable `python` in npm scripts (Windows has no `python3`).
- [x] `.gitignore`: `release/`, `.env*`, local AI tooling, Tauri `target/`.
- [x] `package.json`: name `atelierroot`, author, private.
- [x] `docs/ARCHITECTURE.md`, `docs/CONTRACT.md`, `docs/ROADMAP.md`, `CONTRIBUTING.md`.
- [x] README in English + `README.es.md`, trademark notice.

## S1 - Public repository and CI

- [x] First commit and push to GitHub repo [`Arphael/AtelierRoot`](https://github.com/Arphael/AtelierRoot).
- [x] Product renamed to AtelierRoot everywhere (hidden folder `.atelierroot/`, app id `io.github.arphael.atelierroot`).
- [x] `repository`/`homepage` in `package.json`; real clone URL in both READMEs.
- [x] CI matrix: `ubuntu-latest`, `windows-latest`, `macos-latest`; server + e2e against `src/` and `dist/` on all three.
- [x] CI green on the 3 OSes (`504468a`): path-to-code regressions, UTF-8 output on Windows, Cmd+click on macOS and 8.3 short paths in the dev server fixed along the way.
- [x] Dependabot PRs #1-#5 (GitHub Actions) applied on `main` in one commit; the PRs close themselves.
- [x] Dependabot alert #1 (moderate, GHSA-wrw7-89jp-8q8g, `glib` < 0.20): reviewed. `glib` 0.18 comes only from Tauri's Linux stack (gtk3 / webkit2gtk) and is not compiled into the Windows executable; it cannot be bumped until Tauri moves off gtk 0.18. Dismissed as "vulnerable code is not used"; revisit with S4 (Linux builds) or the next Tauri release.
- [x] Pages enabled; `pages.yml` deploys to <https://arphael.github.io/AtelierRoot/>.
- [x] `CHANGELOG.md` (Keep a Changelog + SemVer), issue/PR templates, Dependabot for `github-actions`.
- [x] `SECURITY.md` (how to report vulnerabilities).
- [x] Security in the repo: CodeQL, OpenSSF Scorecard, actions pinned by commit SHA, least-privilege workflow permissions, Content-Security-Policy on the local server.
- [x] Community docs: `CODE_OF_CONDUCT.md`, `SUPPORT.md`, issue template config, `docs/README.md`, `USER_GUIDE.md`, `FAQ.md`, `BUILDING.md`, ADRs.
- [x] GitHub settings after the push: private vulnerability reporting, Dependabot alerts and security updates, secret scanning with push protection, code scanning, ruleset on `main`, read-only default `GITHUB_TOKEN`.

Done when: CI green on 3 OSes, Pages URL works, repo public, security settings on.

## S2 - Interface in English and Spanish (done, v1.1.0)

- [x] Test first: e2e switches language and asserts toolbar, sidebar, dialogs and palette change without reload; documents unchanged.
- [x] `src/js/05-i18n.js`: dictionaries, `T()`, `applyI18n()`, language detection, persistence in `atelierroot.ui`.
- [x] Replace hard-coded strings in `src/index.html` (`data-i18n*`) and in every `src/js/*.js` (`T()`), including toasts, `title`/`aria-label`, placeholders, command palette, `83-ws-ui.js` screens, server messages shown in UI.
- [x] Language selector in the UI and in the command palette.
- [x] `<html lang>` and export template follow the language.
- [x] Conflict copy names localized (`name (disk version hh:mm)` / `name (versión del disco hh:mm)`).
- [x] `npm run check` rule: no UI literal outside dictionaries (best effort).
- [x] Tools panel for small screens: right-hand tools, view tools and status bar move to a panel that slides in from the right when they do not fit.
- [x] File names with a known extension (`Fix.prompt.md`, `.gitignore`) become inline code after a space.

Done when: whole interface switches live; e2e green in both languages.

## S3 - Desktop app with Tauri (done, v1.1.0)

Moved ahead of S2 so a portable executable (`AtelierRoot.exe`, one file) can be tested before the first public release.

- [x] Contract tests: `tests/contract/scenarios.json` (24 cases) run by the Node server (`server/test/contract.test.mjs`) and the desktop backend (`src-tauri/src/contract_tests.rs`); it found that Node accepted `:` inside names (an NTFS stream on Windows), now refused like in Rust.
- [x] `src-tauri/` (Tauri v2), frontend = `dist/`, strict CSP, no remote URLs; portable `AtelierRoot.exe` (~3.4 MB).
- [x] Rust commands implementing [CONTRACT.md](CONTRACT.md) (path validation, writable rules, atomic write, `expect` conflict).
- [x] Outside changes detected by a 1.2 s poll that emits `ws-changed` (a `notify` watcher can replace it later).
- [x] `TauriBackend` in `81-ws-backends.js`; choose folder via dialog; remember last folder.
- [x] Rust unit tests for path safety (mirrors `server/test/server.test.mjs`), run in CI.
- [x] App icon and metadata (name "AtelierRoot"); the browser tab uses the same logo.
- [x] Dependabot for `cargo`.
- [x] The executable and `AtelierRoot.html` are built from the same `dist/index.html`, so they always behave the same.

Done when: the desktop app opens a folder, edits, autosaves and reloads external changes on Windows (verified live), and the shared contract runner exists.

## S4 - Multi-platform releases (skipped for now)

Skipped: the downloads stay `AtelierRoot.exe` (Windows) and `AtelierRoot.html`, and the web version
(<https://arphael.github.io/AtelierRoot/>) covers macOS and Linux in Chrome, Edge or Brave. Native macOS/Linux
builds need code signing to open without warnings, and an update checker would be the app's first internet access.

- [x] First release [`v1.0.0`](https://github.com/Arphael/AtelierRoot/releases/tag/v1.0.0) with `AtelierRoot.exe` + `AtelierRoot.html` attached.
- [x] Release text from the CHANGELOG section of each version (`scripts/release-notes.mjs`).
- [x] Release assets: `AtelierRoot.exe` + `AtelierRoot.html` (the Node ZIP was dropped; the server is for development only).
- [x] Unsigned builds: the release text and the FAQ explain the SmartScreen warning.
- Not planned now: installers (`.msi`, `.dmg`, `.AppImage`/`.deb`), code signing, automatic updates.

## S5 - Quality and browser coverage (done, v1.2.0)

- [x] Firefox and WebKit (Safari's engine) in the browser tests: `python tests/run.py --browser firefox|webkit`, own CI job on Linux. Tests that need Chromium-only APIs (folder access, DevTools protocol) declare `ENGINES`; Firefox differences (synthetic paste events, Enter at the end of a quote, a correction inside bold) are listed in the FAQ.
- [x] Fix: typing `[ ] ` key by key left a stray `]` in the new task (fixed in v1.0.1).
- [x] Writing assistant extensions: the editor accepts their corrections (Markdown, autosave, undo; e2e test). They load only on `http`/`https`, so the docs point to the web version for them.
- [x] Pinned actions moved to their Node 24 releases: `checkout` v7.0.1, `setup-node` v7.1.0, `upload-pages-artifact` v5.0.0.
- [x] Unit tests (`npm run test:unit`, `tests/unit/`) for pure functions: `urlAllowed`, `isCodeLike` / `isFileName`, `tidyMd`, `wsSafeName`, `wsHash` (`domFromMd` stays covered by the browser tests).
- [x] ESLint minimal (`npm run lint`: `no-undef`, `no-unused-vars`), part of `npm test`; it found one unused variable.
- [x] Large folders: 5 000 documents open in about 1.5-2 s (they took 10 s). Documents are read in batches (`POST /api/files`, `ws_read_many`, 500 per call) and converted to HTML the first time they are used, the rest in the background; `tests/e2e/test_large_folder.py` keeps the time and checks that an early edit is saved.
- [x] Fix: the word counter counted the zero-width space (`\u200b`) as a word.
- [x] Screenshot of the editor in the README.

## S6 - New features (backlog, by priority)

| Feature                                       | Complexity | Notes                                    |
| --------------------------------------------- | ---------- | ---------------------------------------- |
| Images as files (`assets/` next to the `.md`) | Medium     | New, reviewed write permission           |
| Search across all documents                   | Medium     | Needs a search index                     |
| Backlinks                                     | Low        | `[[name]]` already exists                |
| Export to PDF                                 | Low        | `window.print()` with a print stylesheet |
| PWA installable / offline                     | Low        | `manifest` + service worker over `dist/` |
| Git status in tree                            | Medium     | Read-only                                |
| ES modules + esbuild                          | High       | Gradual, leaves first                    |
| Collaborative editing                         | High       | CRDT; last                               |

## Known unverified areas

1. macOS and Linux desktop builds (not produced); Firefox and Safari are covered by automated tests only.
2. Real remembered `showDirectoryPicker` handle across browser restarts.
3. Folders with tens of thousands of files and network drives.
4. Sync tools (OneDrive, Dropbox, iCloud) rewriting files.
5. Browsers without folder access: Brave needs `brave://flags/#file-system-access-api`; Electron hosts (VS Code's integrated browser) are detected by user agent only.
