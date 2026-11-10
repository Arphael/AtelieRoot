# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

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
