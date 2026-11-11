# AtelierRoot

[![CI](https://github.com/Arphael/AtelierRoot/actions/workflows/ci.yml/badge.svg)](https://github.com/Arphael/AtelierRoot/actions/workflows/ci.yml)
[![CodeQL](https://github.com/Arphael/AtelierRoot/actions/workflows/codeql.yml/badge.svg)](https://github.com/Arphael/AtelierRoot/actions/workflows/codeql.yml)
[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/Arphael/AtelierRoot/badge)](https://scorecard.dev/viewer/?uri=github.com/Arphael/AtelierRoot)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

_[Leer en español](README.es.md)_

A **local-first** Markdown editor: **every document is a `.md` file in a folder on your computer**, and everything saves itself.
**No cloud, no accounts, no internet.** Nothing leaves your machine.

## Features

|                             |                                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| **Write as you type**       | Markdown shortcuts turn into formatting: headings, lists, tasks, quotes, code blocks, tables, dividers |
| **Plain files**             | Every document is a `.md` you can open with any editor or version with git                             |
| **Autosave**                | Changes are written automatically; unsaved work survives a crash or closed window                      |
| **Safe with outside edits** | Changes made in other programs are reloaded; on a conflict both versions are kept                      |
| **Organize**                | Folders, drag and drop, `[[name]]` links between documents, outline, split view, trash                 |
| **Write faster**            | Command palette, find and replace, focus mode, section folding, `[UPPERCASE]` placeholders             |
| **Code friendly**           | Syntax highlighting for ~45 languages, paths and URLs detected automatically                           |
| **Private**                 | No account, no telemetry, no network requests                                                          |

The interface is in English and Spanish: it follows your system language and switches live with the **EN/ES** button in the toolbar.

## Download

| Option                                                                                   | For                                              | Needs                                      |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------ |
| **Desktop app** - `AtelierRoot.exe` from [Releases](https://github.com/Arphael/AtelierRoot/releases) | Everyone (Windows first; macOS and Linux follow) | Nothing (WebView2, included in Windows 11) |
| **One HTML file** - `AtelierRoot.html` from Releases (or the GitHub Pages site)          | Any OS, nothing to install                       | Chrome or Edge to save to a folder         |

**Desktop app**: download `AtelierRoot.exe`, double-click it and choose the folder for your notes. One file, nothing to install; the folder is remembered.

**One HTML file**: double-click `AtelierRoot.html` (it opens in your browser) and click **"Abrir una carpeta..."**. The browser asks for permission once per session. Without a folder AtelierRoot runs in **temporary mode** (documents stay in that browser).

Both are the same app: the executable embeds exactly the `AtelierRoot.html` of the same release.

New here? Read the [user guide](docs/USER_GUIDE.md). Problems? See the [FAQ](docs/FAQ.md).

## How your documents are stored

```
My notes/
|-- Intro.md          <- one document (file name = document name)
|-- Projects/         <- an AtelierRoot folder is a disk folder
|   `-- Plan.md
`-- .atelierroot/         <- what Markdown cannot store (hidden, can be versioned)
    |-- state.json    <- order, open folders, column widths, folds, placeholder values
    `-- trash/        <- what you delete (restorable for 30 days)
```

- **Opening** never rewrites a file. **Editing** saves normalized Markdown (e.g. `*` becomes `-`).
- Non-`.md` files are ignored and **never touched**.
- Full format and sync rules: [docs/CONTRACT.md](docs/CONTRACT.md).

## Security

- The desktop app only reads and write `.md` files and `.atelierroot/` inside the folder you chose.
- The app makes no network requests and runs under a strict Content-Security-Policy.
- A foreign `.md` cannot run anything: raw HTML shows as text; links and images allow only `http(s)`, `mailto`, `tel`, `data:image` or relative paths.
- Report vulnerabilities privately: [SECURITY.md](SECURITY.md).

## For developers

The repository holds the whole source: the app (`src/`), a Node server used only for development and tests (`server/`, never downloaded by users) and the Rust backend of the desktop app (`src-tauri/`).

```bash
git clone https://github.com/Arphael/AtelierRoot.git && cd AtelierRoot
npm start            # serves src/ with ./notas at http://localhost:4321, no build
npm test             # check + server + browser tests
npm run build        # dist/ (~520 KB)
```

Building the executable: [docs/BUILDING.md](docs/BUILDING.md). Start reading at [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [CONTRIBUTING.md](CONTRIBUTING.md). All docs: [docs/](docs/README.md).

## Known limitations

- All documents are read at startup: thousands of large files will be slow.
- Browser-only mode detects outside changes by polling every 3 s.
- Not yet verified on macOS, Firefox or Safari.
- The HTML file opens folders in Chrome and Edge; in Brave only after enabling `brave://flags/#file-system-access-api`; never in VS Code's integrated browser (use the desktop app there).
- Pasted images are stored inside the `.md` as `data:` URLs.
- Early executables are not code-signed (Windows SmartScreen warns once).

## Community

[Contributing](CONTRIBUTING.md) · [Code of conduct](CODE_OF_CONDUCT.md) · [Support](SUPPORT.md) · [Changelog](CHANGELOG.md)

## License and trademarks

[MIT](LICENSE). Code highlighting bundles [Prism](https://prismjs.com) (MIT) in `src/vendor/prism/`.

AtelierRoot is an independent open-source project. It is not affiliated with, endorsed by or related to any other product or trademark with a similar name.
