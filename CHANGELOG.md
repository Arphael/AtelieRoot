# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

### Added
- CI on Windows, macOS and Linux.
- `CHANGELOG.md`, `SECURITY.md`, issue and PR templates, Dependabot for GitHub Actions.
- Docs: `docs/ARCHITECTURE.md`, `docs/CONTRACT.md`, `docs/ROADMAP.md`, `CONTRIBUTING.md`, `README.es.md`.
- Docs: user guide, FAQ, building guide, architecture decision records, docs index, `CODE_OF_CONDUCT.md`, `SUPPORT.md`.
- Security: Content-Security-Policy on every local server response; CodeQL and OpenSSF Scorecard workflows.
- Desktop app `AtelierRoot.exe` (Tauri v2, Rust backend with the same contract).
- Relative Windows paths with a file extension (`src\app.js`) become inline code like other paths.
- Brave: the welcome screen explains how to enable folder access (`brave://flags/#file-system-access-api`).
- Browser tab icon uses the app logo.
- Folder picker errors are shown (only a real cancel stays silent); Electron hosts such as VS Code's integrated browser get an explanation instead of a button that cannot work. Long messages stay on screen longer.
- Block shortcuts (`* `, `- `, `1. `, `# `, `> `, `[] `) also work after leading spaces; right below a list, every 2 spaces (or a Tab) nest the new item one level.

### Changed
- Renamed to **AtelierRoot** everywhere, including the hidden folder (`.atelierroot/`), local storage keys and the app identifier.
- Release downloads are `AtelierRoot.exe` and `AtelierRoot.html` (same app); the Node ZIP was dropped and the server is for development only.
- Workflow actions pinned by commit SHA with least-privilege permissions.
- Neutral welcome document in temporary mode.
- npm test scripts call `python` instead of `python3` (works on Windows).

## [1.0.0] - 2026-11-05

### Added
- Local-first Markdown editor: working folder via local Node server or File System Access, temporary IndexedDB mode.
- Autosave with conflict-safe sync, external change reload, trash in `.atelierroot/trash/`.
- Tables, task lists, nested numbering, wikilinks, folding, split view, command palette, find and replace, placeholders, syntax highlight (vendored Prism).
