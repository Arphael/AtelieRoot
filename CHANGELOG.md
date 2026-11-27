# Changelog

All notable changes to this project are documented here.
Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Versioning: [SemVer](https://semver.org/).

## [Unreleased]

## [2.2.1] - 2026-11-27

### Security
- **Pasting from a web page could run its code.** HTML copied from a page with a hidden `<img onerror=...>` ran that code in AtelieRoot while being pasted, and that code could then read and change the documents of the open folder. Pasted HTML is now read without ever being shown, so nothing in it runs.
- **A document could hide code in an address.** In a `.md` (one downloaded or from a cloned repository, for example) an address with quotes (`https://x.com/"onmouseover="...`, also as `<https://...>`) or a code block language with quotes added code that ran when the mouse passed over it. Quotes are now always kept inside the link.
- Names Windows cannot open or delete from the Explorer are refused by the dev server and the desktop app: a name ending in a space or a dot, or a device name before the first dot (`CON`, `NUL`, `COM1`...). When you create or rename, AtelieRoot already fixes the name for you (`nul.notas` -> `nul_.notas`).

### Changed
- Dependencies: Tauri 2.12.7, tauri-build 2.7.6, Tauri CLI 2.12.6, ESLint 10.15.0; CI: CodeQL action v4, Scorecard action 2.6.0.

### Tests
- A browser test tries to run code from a document (addresses, links, images, `<img>`, code blocks, tables, lists) and from pasted HTML (`<img onerror>`, `<svg onload>`, `<iframe srcdoc>`), and checks no event attribute ever reaches the page. Node and Rust tests for the refused Windows names.

## [2.2.0] - 2026-11-18

### Added
- **Change the shortcuts.** In the shortcut list (keyboard button, `Ctrl+K Ctrl+S` or the command palette) each command of the app has «Change» (press the new keys; `Ctrl+K` and another key works too) and «Reset»; «Reset all» brings every original back. A key that Windows or the browser uses (`Ctrl+Shift+V`, `Ctrl+W`, `Ctrl+T`, `Alt+F4`, `F5`, `Ctrl+Alt`, which is AltGr on many keyboards...), one of basic editing (copy, paste, undo, bold...) or one another command already uses is refused and the list says why. Changes are remembered.
- Reading mode: the **Guide** button shows or hides the marked word; the page still scrolls by itself with it hidden (`Space`, speed). Remembered.
- **Image tools.** Click an image: size (25/50/75/100 % or drag the corner), align left, centre or right, rotate 90°, flip and crop. Size and alignment are written as `<img src="…" width="…" align="…">` (GitHub and VS Code show them); rotate, flip and crop write a new image file, so the change is seen everywhere, and `Ctrl+Z` brings the previous one back.
- With a folder open, «Copy Markdown», `Ctrl+C` and the live Markdown's copy button write each image with its full path on the disk (`![](<C:\…\.atelieroot\assets\notas\x.png>)`), so pasting the text into Claude Code lets Claude open every image itself; the copy stays text only, because a chat keeps only the image when the clipboard has both. The document keeps its relative links. In the browser the folder's place is asked once, as for «Copy path».
- Right click on a document: «Open with its program» opens the `.md` in the program Windows uses for it (desktop app and dev server).
- In the browser, «Copy path» gives the full path too: the browser never tells a page where a folder is, so the first time it asks you to paste the folder's path (it must end in that folder's name) and remembers it. «Show in Explorer» in the browser copies the folder of the item to paste in the Explorer's address bar.

### Changed
- Reading mode leaves `Ctrl+Shift+V` to the system (paste as plain text); it is `Ctrl+K R`, or the key you choose.
- Reading and focus mode keep what you read or write in the middle of the screen; only in these modes there is half a screen of blank page above and below, so the first and last lines get there too.
- «Copy path» and «Copy relative path» copy the path as plain text, without quotes, for documents and folders.
- **Images live in `.atelieroot/assets/`**, in the same folders as their document (`notas/ideas.md` -> `.atelieroot/assets/notas/`), linked as `![](../.atelieroot/assets/notas/name.png)`. Images of v2.1 in an `assets/` folder next to the documents move there the first time the folder is opened; only their links change in the `.md`, and an `assets/` folder left empty is removed (one with other files stays).
- The shortcut list is wider: key, command and buttons in their own columns.
- **Images nobody uses are cleaned up.** A few seconds after a save, an image in `.atelieroot/assets/` that no document uses any more (in any open folder, nor in the undo steps of the document being edited) moves to `.atelieroot/trash/images/`, and it is deleted after the trash days (30 unless changed). Undoing the deletion later brings the file back from there. This includes the older versions left by rotate, flip and crop. Nothing outside `.atelieroot/assets/` is touched; in temporary mode (no folder) nothing changes.

### Fixed
- In the browser, «Copy path» asked for the folder's place again after other settings were saved; it is now kept apart and never asked twice. The path of a file inside the folder is also accepted.

### Tests
- Browser tests for changing, refusing, resetting and remembering shortcuts, the word guide switch, the text in the middle and the paths in the browser; a test fails if a default shortcut is one of Windows or the browser. Node test for «Open with its program» (only `.md` inside the folder).

## [2.1.0] - 2026-11-17

### Added
- **Several folders at once.** «Add another folder» (folder options, command palette, or the menu of an open folder) shows each folder as a top-level folder of the sidebar. Search, `[[links]]` and moving documents work across them; folders stay in their own open folder. Each folder keeps its own `.atelieroot/` (order, folds, comments, trash), so it is the same when opened alone later. «Remove from the workspace» stops showing one; nothing on disk changes. The open folders are remembered (desktop app and browser).
- **Reading mode** (`Ctrl+Shift+V` or `Ctrl+K R`, toolbar button, command palette). The document cannot be edited and the panels hide; it uses the editor's own scroll, so it starts where you are and you stay where you stopped. A **word guide** marks one word after another at the speed you choose (200 words per minute unless you change it, 60-600) and the page follows it slowly; `Space` starts and pauses it, and scrolling by hand moves it to the word at the reading height. The floating panel also has whole document or one paragraph at a time, text size and column width, and progress with the time left. `Esc` leaves.
- **Images.** Paste a screenshot, drop an image or use the image button: it is saved as a file in `assets/` next to the document and written as `![](assets/name.png)` (PNG, JPG, GIF, WebP, up to 10 MB). Copies and exports carry the image itself, so a chat such as Claude or Codex receives it; right click on an image: «Copy image».
- **Text that is not copied.** Select text and mark it «Do not copy» (`Ctrl+K N`, right click or the command palette; the same again removes the mark). It stays in the document and in the `.md`, shown with a soft dashed underline, but copies leave it out: `Ctrl+C` (with or without a selection), «Copy Markdown», «Copy formatted» and the live Markdown's copy button. Cut and exports keep it. With a folder open the marks are kept in `.atelieroot/state.json`.
- Right click on a document or folder: «Show in Explorer» (desktop app and dev server), «Copy path» and «Copy relative path».
- The full name and place of each document and folder show as a tooltip in the sidebar.
- Clicking below the end of a document (under a table, a code block or a list) adds an empty paragraph to write in, like Notion.

### Changed
- Undo is per document: after switching documents, `Ctrl+Z` still undoes what you did in the one you come back to (a change made outside clears that history).
- The outline follows the scroll: it marks the section on screen and scrolls itself to keep it visible.
- The logo has no dark background (tab icon and desktop app icons).

### Fixed
- Restoring a folder from the trash while a save was running could delete the trash copy with the files AtelieRoot does not show (images, PDF...) inside, instead of bringing them back. Seen in Safari's engine, where saves are slower; present since v1.0.
- Turning one item of a nested list into a task no longer takes the bullets away from the items around it, and new items keep their own kind. In Markdown such a task keeps its bullet (`- [ ] x`), so other readers do not join it to the line above.

### Tests
- Browser tests for all of the above, including two real browser folders open at once; Node and Rust tests for images, «Show in Explorer» and the absolute path.

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
