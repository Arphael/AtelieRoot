# 3. Tauri for the desktop executable, Node server kept for development

- Status: accepted
- Date: 2026-11-08

## Context
Users need one small file that runs AtelierRoot on Windows (first), macOS and Linux, without
installing Node. Developers need a fast loop and the existing browser test suite.

## Options
- Electron: ~100 MB+, bundles Chromium.
- Node single executable: ~80 MB, still opens an external browser.
- **Tauri v2**: ~8-12 MB, uses the system WebView (WebView2 / WKWebView / WebKitGTK), Rust backend.

## Decision
Tauri produces the user executable. Its Rust backend implements the same contract as the Node
server. The Node server stays for development and automated tests only; it is not shipped to users.

## Consequences
- Two backends to keep in line: one contract document and mirrored security tests.
- Building the executable needs Rust and platform build tools; developing the UI does not.
- Rendering differences between WebView2, WebKit and WebKitGTK must be covered (roadmap S5).
