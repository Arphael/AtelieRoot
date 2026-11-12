# Building from source

Users only need the executable from Releases. This page is for developers who want to change
AtelierRoot and build it themselves.

## What lives where

| Path                | Role                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------- |
| `src/`              | The app (UI + editor logic), plain HTML/CSS/JS, no build needed for development        |
| `server/`           | Node.js backend for development and tests only (not shipped)                           |
| `src-tauri/`        | Rust backend and desktop shell (Tauri v2) that produces the executable                 |
| `scripts/build.mjs` | Builds `dist/` (one `index.html` + `vendor/`), the frontend embedded in the executable |

## 1. Web app and Node server

Requirements: Node.js 18+ (Python 3.9+ and Playwright only for browser tests).

```bash
npm start            # serves src/ with ./notas at http://localhost:4321
npm run build        # dist/
npm ci               # dev tools (ESLint)
npm test             # full test suite: check, lint, server, contract, unit and browser tests
npm run lint         # ESLint only
npm run test:unit    # unit tests only (no browser)
```

## 2. Desktop executable

### Requirements

| OS      | Install                                                                                                                                               |
| ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Windows | [Rustup](https://rustup.rs) (stable, MSVC), Visual Studio Build Tools 2022 with "Desktop development with C++", WebView2 (preinstalled on Windows 11) |
| macOS   | Rustup, Xcode Command Line Tools (`xcode-select --install`)                                                                                           |
| Linux   | Rustup, `libwebkit2gtk-4.1-dev`, `build-essential`, `libssl-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`                                      |

Windows with winget:

```powershell
winget install Rustlang.Rustup
winget install Microsoft.VisualStudio.2022.BuildTools --override "--passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended"
```

### Build

```bash
npm run build                 # frontend -> dist/
npm run tauri:build           # release executable
```

Output: `src-tauri/target/release/AtelierRoot.exe` (Windows) - one portable file.

Releases: pushing a `vX.Y.Z` tag runs `.github/workflows/release.yml`, which attaches `AtelierRoot.exe` and
`AtelierRoot.html` and uses the `## [X.Y.Z]` section of `CHANGELOG.md` as the release text
(`node scripts/release-notes.mjs vX.Y.Z` shows it locally). Without that section the release fails.
On macOS/Linux the binary is `src-tauri/target/release/atelierroot`. Installers (`.msi`, `.dmg`,
`.AppImage`, `.deb`) are produced in CI (roadmap S4).

### Develop with hot reload

```bash
npm run tauri:dev
```

### Test the Rust backend

```bash
cd src-tauri && cargo test
```

The Rust backend must pass the same rules as the Node server: see [CONTRACT.md](CONTRACT.md).
