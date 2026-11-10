# Roadmap

Sprints from cleanup to a public, multi-platform release. Each sprint ends with
`npm test` and `npm run test:dist` green. Weights: Light < Medium < Heavy.

| Sprint | Goal                                            | Weight | Status      |
| ------ | ----------------------------------------------- | ------ | ----------- |
| S0     | Cleanup and documentation                       | Medium | Done        |
| S1     | Public repository, CI, security, community docs | Medium | In progress |
| S2     | Interface in English and Spanish                | Heavy  | Pending     |
| S3     | Desktop app with Tauri (moved ahead of S2)      | Heavy  | In progress |
| S4     | Multi-platform releases                         | Medium | Pending     |
| S5     | Quality and browser coverage                    | Medium | Pending     |
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

## S2 - Interface in English and Spanish

- [ ] Test first: e2e switches language and asserts toolbar, sidebar, dialogs and palette change without reload; documents unchanged.
- [ ] `src/js/05-i18n.js`: dictionaries, `t()`, `applyI18n()`, language detection, persistence in `atelierroot.ui`.
- [ ] Replace hard-coded strings in `src/index.html` (`data-i18n*`) and in every `src/js/*.js` (`t()`), including toasts, `title`/`aria-label`, placeholders, command palette, `83-ws-ui.js` screens, server messages shown in UI.
- [ ] Language selector in the UI and in the command palette.
- [ ] `<html lang>` and export template follow the language.
- [ ] Conflict copy names localized (`name (disk version hh:mm)` / `name (versión del disco hh:mm)`).
- [ ] `npm run check` rule: no UI literal outside dictionaries (best effort).

Done when: whole interface switches live; e2e green in both languages.

## S3 - Desktop app with Tauri

Moved ahead of S2 so a portable executable (`AtelierRoot.exe`, one file) can be tested before the first public release.

- [ ] Contract tests: extract backend scenarios into a runner usable by Node and Tauri.
- [x] `src-tauri/` (Tauri v2), frontend = `dist/`, strict CSP, no remote URLs; portable `AtelierRoot.exe` (~3.4 MB).
- [x] Rust commands implementing [CONTRACT.md](CONTRACT.md) (path validation, writable rules, atomic write, `expect` conflict).
- [x] Outside changes detected by a 1.2 s poll that emits `ws-changed` (a `notify` watcher can replace it later).
- [x] `TauriBackend` in `81-ws-backends.js`; choose folder via dialog; remember last folder.
- [x] Rust unit tests for path safety (mirrors `server/test/server.test.mjs`), run in CI.
- [x] App icon and metadata (name "AtelierRoot"); the browser tab uses the same logo.
- [x] Dependabot for `cargo`.
- [x] The executable and `AtelierRoot.html` are built from the same `dist/index.html`, so they always behave the same.

Done when: the desktop app opens a folder, edits, autosaves and reloads external changes on Windows (verified live), and the shared contract runner exists.

## S4 - Multi-platform releases

- [ ] `release.yml` with `tauri-apps/tauri-action`: `.msi`/`.exe` (Windows), `.dmg` (macOS universal), `.AppImage`/`.deb` (Linux) on tag `vX.Y.Z`.
- [ ] First release `v1.0.0` (tag) with `AtelierRoot.exe` + `AtelierRoot.html` attached.
- [x] Release assets: `AtelierRoot.exe` + `AtelierRoot.html` (the Node ZIP was dropped; the server is for development only).
- [ ] Optional code signing (Windows / Apple notarization) documented; unsigned builds warn the user in README.
- [ ] Manual smoke test checklist per OS in `CONTRIBUTING.md`.
- [ ] Auto-update (Tauri updater) - optional.

Done when: a tag produces installers for 3 OSes and each passes the smoke test.

## S5 - Quality and browser coverage

- [ ] Firefox and WebKit in e2e (server mode).
- [ ] Fix: typing `[ ] ` key by key leaves a stray `]` in the new task (`[] ` works).
- [ ] Move pinned actions (`checkout`, `setup-node`; `setup-python` done) to their Node 24 releases (CI warns that Node 20 is deprecated).
- [ ] Unit tests (`node --test`) for pure functions: `urlAllowed`, `wsSafeName`, `isCodeLike`, `domFromMd`, `tidyMd`, `wsHash`.
- [ ] ESLint minimal (`no-undef`, `no-unused-vars`).
- [ ] Lazy document loading for large folders (5 000 files open in < 2 s).
- [ ] Verify: remembered folder handle by hand, OneDrive/Dropbox folders, network drives.

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

1. macOS, Linux desktop, Firefox and Safari (only Windows/Linux + Chromium so far).
2. Real remembered `showDirectoryPicker` handle across browser restarts.
3. Folders with tens of thousands of files and network drives.
4. Sync tools (OneDrive, Dropbox, iCloud) rewriting files.
5. Browsers without folder access: Brave needs `brave://flags/#file-system-access-api`; Electron hosts (VS Code's integrated browser) are detected by user agent only.
