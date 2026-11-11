# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [1.1.0] - 2026-11-10

### Added
- Interface in English and Spanish. It follows the system language the first time; the **EN/ES** toolbar button (or "Language" in the command palette) switches it live, without reloading, and the choice is remembered. `?lang=en` / `?lang=es` in the address forces a language for one visit.
- Everything is translated: toolbar, sidebar, menus, dialogs, messages, command palette, folder screens, table tools, status bar, and the buttons inside code blocks. Exported HTML carries the active language.
- `npm run check` rejects literal interface texts in messages and dialogs and `data-i18n` keys missing from the dictionary.
- Tools panel for small screens: when the right-hand tools (live Markdown, placeholders, tidy, copy, export, language, theme) do not fit, they move together to a panel that opens from the right (button at the end of the toolbar, and in the phone header). It also holds the view tools that do not fit and, on phones, the status bar. «More» keeps only formatting and insert tools.
- File names become inline code when you type a space after them, like paths: `Fix.prompt.md`, `app.py`, `.gitignore`. Only known file extensions count, so abbreviations (`p.ej.`), versions (`v1.2`) and domains stay text.

### Changed
- Names the app creates (conflict copies such as `name (disk version hh:mm)`, "Untitled", the welcome document) use the active language. Your documents are never translated.
- Errors from the folder backends are shown in the interface language.
- The `/` menu also finds blocks by their English names.
- Each GitHub release shows the changes of its version (taken from this file).

### Fixed
- Dev server: names with `:` inside (`nota:alt.md`) are refused, like in the desktop app (on Windows they would write a hidden NTFS stream).

### Tests
- Shared contract tests: one set of scenarios (`tests/contract/scenarios.json`) that both the Node server and the desktop backend must pass.

## [1.0.1] - 2026-11-09

### Added
- `docs/TEMPLATE.md`: template to request a fix or improvement, and the steps every change follows up to the release.
- Docs: writing assistant extensions (spelling/grammar) only run on `http`/`https` pages; use the web version for them.
- Browser test: corrections made by writing assistant extensions reach the Markdown, keep inline format and can be undone.

### Fixed
- Typing `[ ] ` key by key left a stray `]` in the new task.

## [1.0.0] - 2026-11-09

First public release. Downloads: `AtelierRoot.exe` (Windows desktop app) and `AtelierRoot.html` (the same app as one HTML file).

### Added
- Local-first Markdown editor: working folder via File System Access (browser) or the desktop app, temporary IndexedDB mode.
- Autosave with conflict-safe sync, external change reload, trash in `.atelierroot/trash/`.
- Tables, task lists, nested numbering, wikilinks, folding, split view, command palette, find and replace, placeholders, syntax highlight (vendored Prism).
- Desktop app `AtelierRoot.exe` (Tauri v2, Rust backend with the same contract as the dev server).
- Relative Windows paths (`src\app.js`, `docs\adr\`) become inline code like other paths; a path with spaces such as `C:\Program Files\Git\bin` stays one piece.
- Block shortcuts (`* `, `- `, `1. `, `# `, `> `, `[] `) also work after leading spaces; right below a list, every 2 spaces (or a Tab) nest the new item one level.
- Brave: the welcome screen explains how to enable folder access (`brave://flags/#file-system-access-api`).
- Folder picker errors are shown (only a real cancel stays silent); Electron hosts such as VS Code's integrated browser get an explanation instead of a button that cannot work. Long messages stay on screen longer.
- Browser tab icon uses the app logo.
- CI on Windows, macOS and Linux; GitHub Pages demo.
- Security: Content-Security-Policy on every local server response; CodeQL and OpenSSF Scorecard workflows; workflow actions pinned by commit SHA with least-privilege permissions.
- Docs: `README.es.md`, user guide, FAQ, building guide, architecture, contract, roadmap, architecture decision records, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`, issue and PR templates, Dependabot.

### Changed
- Renamed to **AtelierRoot** everywhere, including the hidden folder (`.atelierroot/`), local storage keys and the app identifier.
- The Node server is for development and tests only; it is not part of the downloads.
- GitHub Actions updated: `setup-python` v7.1.0, `configure-pages` v6.0.0, `deploy-pages` v5.0.1, `upload-artifact` v7.0.2, `action-gh-release` v3.0.4, Scorecard v2.5.0.

### Fixed
- Dev server: a folder opened through a Windows 8.3 short path (`C:\Users\RUNNER~1\...`) rejected every file as "outside the folder" (403).
