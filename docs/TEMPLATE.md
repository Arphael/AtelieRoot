# Change request template

Copy the block below, fill in what you know and send it to the maintainer (or to the AI assistant working on the repository). Only **What** is required; everything else is optional. One request may list several items; each keeps its number until it is closed.

```markdown
# AtelierRoot change request

Version where I saw it: v1.0.x (exe / HTML / web)
Browser and OS: e.g. Chrome 130, Windows 11

## 1. <short title>

Type: bug | change | new feature | visual
What: what happens now, or what is missing.
Expected: what should happen instead.
Steps: 1) ... 2) ... 3) ... (for bugs)
Where: screen, menu, shortcut or file, if known.
Attachments: screenshots, sample Markdown, links.

## 2. <short title>

...

## Do not change

Anything that must stay exactly as it is.

## Release

yes (default) | no, only commit
```

## What happens with a request

Every item goes through the same steps, so a request only has to describe the problem.

1. **Clarify.** If the request leaves the result open to more than one reading, up to 3 short questions come back before any change.
2. **Plan.** A short plan lists each item, the files it touches and how it will be checked. Work starts after it is approved.
3. **Test first.** A test that reproduces the bug (or fixes the new behavior) is written and seen failing before the change:
   - editor behavior: Playwright test in `tests/e2e/test_*.py`;
   - server and file access: `server/test/server.test.mjs` (Node) and the Rust unit tests in
     `src-tauri/src` (desktop), kept equivalent as described in [CONTRACT.md](CONTRACT.md).
4. **Change.**
   - Frontend: `src/js/NN-*.js`, `src/css/`, `src/index.html`.
   - Backend, when the change touches files or folders: the Node dev server (`server/atelierroot-server.js`) **and** the desktop backend (`src-tauri/src`), always both, following [CONTRACT.md](CONTRACT.md).
5. **Verify.**
   - `npm run check`, `npm test` and `npm run test:dist` (browser tests against `src/` and the built `dist/`), `cargo test` in `src-tauri/`.
   - `npm run tauri:build`: the executable embeds the same `dist/index.html` as `AtelierRoot.html`, so both always behave the same.
6. **Document.** User-visible changes go to [USER_GUIDE.md](USER_GUIDE.md) /
   [FAQ.md](FAQ.md) (and the Spanish README when it applies), the
   [ROADMAP](ROADMAP.md) and the [CHANGELOG](../CHANGELOG.md) (`[Unreleased]`).
7. **Version.** [SemVer](https://semver.org/): fix -> patch (`1.0.1`), new feature ->
   minor (`1.1.0`), incompatible change -> major. The number is updated in `package.json`,
   `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`,
   `src-tauri/tauri.conf.json` and `server/atelierroot-server.js`; `APP_VERSION` in
   `src/js/69-autobackup.js` gets the release date (it triggers a safety backup on update); the CHANGELOG section gets the version and date.
8. **Publish** (after explicit approval).
   1. Commit and push to `main`.
   2. Wait for CI green on Windows, macOS and Linux.
   3. Tag `vX.Y.Z` and push it. The release workflow attaches `AtelierRoot.exe` and `AtelierRoot.html` to the GitHub release; the web version updates by itself.
9. **Report.** What changed, where to see it (screen, menu, shortcut), the test evidence and the release link.

Security problems are not reported with this template; see [SECURITY.md](../SECURITY.md).
