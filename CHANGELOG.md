# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [2.0.0] - 2026-11-11

### Changed
- **Renamed to AtelieRoot.** Downloads are `AtelieRoot.exe` and `AtelieRoot.html`; the repository is `Arphael/AtelieRoot` and the web version moved to https://arphael.github.io/AtelieRoot/ (the old address no longer works).
- The hidden folder is now `.atelieroot/`. A folder used by v1 is migrated the first time it is opened (`.atelierroot/` is renamed, nothing is lost; `.md` files are not touched). Browser settings move from `atelierroot.*` to `atelieroot.*` by themselves. Major version because a v1 app does not see the state of a migrated folder.
- Focus mode moved from `Ctrl+Shift+F` to `Ctrl+K Z`; `Ctrl+Shift+F` now searches all documents.
- `Ctrl+K` waits a moment for a second key (`C`, `U`, `Z`, `S`) before inserting a link.

### Added
- VS Code shortcuts: `Ctrl+D` (word, then next match), `Ctrl+Shift+L` (all matches) and `Shift+Alt+I` (end of each line) start **multi-edit**: typing, deleting or pasting happens in every place, one `Ctrl+Z` undoes it. Also `Ctrl+L` (select line), `Shift+Alt+Up/Down` (duplicate line), `Ctrl+Shift+K` (delete line), `Alt+Z` (word wrap in code and the live Markdown), `F2` (rename a document and update its `[[links]]`).
- Search in all documents (`Ctrl+Shift+F`): matches with context; `Enter` opens the document at that match.
- **Comments**, like in Word or Notion: select text, `Ctrl+/` (or `Ctrl+K Ctrl+C`); a panel to reply, edit, resolve and delete; `Ctrl+K Ctrl+U` removes one. They stay in the app: not in the `.md`, copies or exports; with a folder open they are kept in `.atelieroot/state.json`. If the commented text is deleted the comment stays.
- Keyboard shortcuts list: toolbar button, `Ctrl+K Ctrl+S` or the command palette; all shortcuts, with a filter.
- The installed version is shown next to «Saved»; it and the app name open «About» with links to the repository, changes, web version and issues (in the desktop app they open in the system browser, only the project's pages).

### Tests
- New browser tests for the shortcuts, multi-edit, search, comments (including a real folder through the local server) and the v1 -> v2 migration; Node and Rust tests for the hidden folder migration and the allowed links.

## [1.2.0] - 2026-11-11

### Changed
- Large folders open much faster: 5 000 documents in about 2 seconds instead of 10. Documents are read in batches and converted when first used (the rest in the background), so search and links still see every document.

### Fixed
- The word counter no longer counts invisible zero-width characters as words (an empty document showed 1 word).

### Added
- Screenshot of the editor in the README.
- Docs: Firefox and Safari notes in the FAQ.

### Tests
- Browser tests also run in Firefox and WebKit (Safari's engine), in their own CI job.
- Unit tests for pure functions (`npm run test:unit`) and a minimal ESLint (`npm run lint`), both part of `npm test`.
- Large folder test: time to open 5 000 documents, and an edit made right after opening is saved.
- Shared contract: batch reads (`read_many`) give the same results in the dev server and the desktop app.
- CI actions moved to their Node 24 releases (`checkout` v7.0.1, `setup-node` v7.1.0, `upload-pages-artifact` v5.0.0).

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
