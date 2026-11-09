# Contract

The technical behavior every AtelierRoot Markdown backend must honor. Today there are three
implementations (Node server, File System Access in the browser, temporary IndexedDB mode);
the Tauri desktop backend (roadmap S3) must pass the same contract tests.

If you change anything in this file, the change is a breaking change: update the contract
tests first, then every backend.

## 1. Backend interface (`src/js/81-ws-backends.js`)

```
list()                       -> [{ p, t: 'f'|'d', s, m }]   paths relative, '/' separated
read(p)                      -> { text, m, s } | { missing: true }
write(p, text, expect?)      -> { m, s }                    expect = mtime last read
mkdir(p)                     -> {}
move(from, to)               -> {}
remove(p, recursive?)        -> {}
watch(onChange)              -> unsubscribe
```

Errors are `WsError` with `code`:

| code       | Meaning                                                                         |
| ---------- | ------------------------------------------------------------------------------- |
| `conflict` | `expect` given and the file changed on disk since it was read. Nothing written. |
| `exists`   | Move destination already exists.                                                |
| `missing`  | Path does not exist.                                                            |
| `denied`   | Path outside the folder, or a kind of file the backend may not touch.           |
| `offline`  | Backend unreachable (server stopped, permission revoked).                       |
| `io`       | Any other filesystem failure.                                                   |

## 2. HTTP API (`server/atelierroot-server.js`)

Every `/api/*` request needs header `X-AtelierRoot-Token: <token>` (or `?token=`). The token is
random per server start and injected only into the served `index.html` as
`<meta name="atelierroot-token">`.

| Method + route     | Params / body                              | Success                                                                      | Errors                      |
| ------------------ | ------------------------------------------ | ---------------------------------------------------------------------------- | --------------------------- |
| `GET /api/ping`    | -                                          | `{ name, version, server: true }`                                            |                             |
| `GET /api/events`  | -                                          | SSE stream; an event is sent when the listing signature changes (poll 1.2 s) |                             |
| `GET /api/list`    | `hidden=1` includes `.atelierroot/`        | `{ entries: [{p,t,s,m}] }` (max 50 000)                                      |                             |
| `GET /api/file`    | `p`, `optional=1`                          | `{ text, m, s }` or `{ missing: true }`                                      | 400, 403, 404               |
| `PUT /api/file`    | `p`, `expect`; body `{ text }` (max 25 MB) | `{ m, s }`                                                                   | 400, 403, 409 conflict, 413 |
| `DELETE /api/file` | `p`, `recursive=1`                         | `{}`                                                                         | 403                         |
| `POST /api/mkdir`  | `p`                                        | `{}`                                                                         | 400, 403                    |
| `POST /api/move`   | body `{ from, to }`                        | `{}`                                                                         | 400, 403, 404, 409 exists   |

Errors are JSON `{ error: "<message>" }`.

## 3. Security rules (all backends)

1. Listen on `127.0.0.1` only (Node) / no network listener at all (Tauri).
2. Reject requests whose `Host` is not `localhost|127.0.0.1|[::1]:<port>` (DNS rebinding).
3. Paths: relative, `/` separated; reject `..`, `.`, `\`, NUL, absolute or drive paths,
   segments > 255 chars, and anything whose real path (symlinks resolved) leaves the root.
4. Writable: `*.md`, `*.markdown` outside hidden folders, and anything inside `.atelierroot/`.
   Nothing else is ever written or deleted.
5. Restoring from `.atelierroot/trash/` may also move back common document/media files
   (images, PDF, office, text, audio/video); never scripts or executables.
6. Writes are atomic: temp file in the same folder, then rename.
7. Static responses carry `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
   `Referrer-Policy: no-referrer`, `Cache-Control: no-store`.
8. The app makes no internet requests (`npm run check` fails on network URLs).
9. Markdown is untrusted input: raw HTML renders as text; links/images allow only
   `http(s)`, `mailto`, `tel`, `data:image` and relative paths.

## 4. On-disk format

| Path                                                                  | Content                                                                                                                |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `**/*.md`, `**/*.markdown`                                            | One document. File name = document name.                                                                               |
| visible folders                                                       | AtelierRoot folders (empty ones too).                                                                                  |
| `.atelierroot/state.json`                                             | What Markdown cannot store (below).                                                                                    |
| `.atelierroot/.gitignore`                                             | `trash/`                                                                                                               |
| `.atelierroot/trash/<entry>/...`                                      | Deleted items with their original structure. Auto-emptied after 30 days.                                               |
| anything else (`.txt`, images, `.git/`, dot folders, `node_modules/`) | Ignored and never touched, unless inside a folder you delete (it goes to the trash with it and comes back on restore). |

`.atelierroot/state.json`:

```json
{
  "v": 1,
  "order": { "": ["Intro.md", "Projects"], "Projects": ["Plan.md"] },
  "open": ["Projects"],
  "fills": { "Intro.md": { "CLIENT": "ACME" } },
  "extras": { "Intro.md": { "tw": [[30, 70]], "folds": [1] } },
  "trash": [
    {
      "id": "...",
      "at": 1730000000000,
      "parentPath": "Projects",
      "base": "Sub",
      "node": { "id": "...", "type": "folder", "name": "Sub", "children": [] },
      "docIds": ["..."],
      "docPaths": { "...": "Sub/Deep.md" }
    }
  ],
  "current": "Intro.md"
}
```

- Keys are relative paths. Entries missing from `order` go last, alphabetically.
- Missing or corrupt `state.json` is not an error: alphabetical order, then regenerated.
- Document id = `'w' + hash(path)` at load time; stable for the session even across renames.

File names (`wsSafeName`): `\ / : * ? " < > |` and control chars become `-`; no leading dot,
no trailing dots/spaces; Windows reserved names (`CON`, `NUL`, `COM1`...) get a `_`; max 120
chars. Case-insensitive sibling clashes become `name (2)`.

## 5. Autosave and sync rules

Pipeline (`src/js/82-ws-core.js`), always serialized in one queue:
`wsSyncTree()` (declarative tree diff -> create/move/trash) -> `wsFlushDocs()` (only docs whose
Markdown changed, with `expect`) -> `wsWriteMeta()` (`state.json` if changed).

| Situation                                 | Result                                                                              |
| ----------------------------------------- | ----------------------------------------------------------------------------------- |
| Open a document without editing           | Nothing is written.                                                                 |
| Edit it                                   | Normalized Markdown is written. HTML change without Markdown change writes nothing. |
| File changes outside, no local edits      | Reloaded (editor refreshed if open).                                                |
| File changes outside, local unsaved edits | Local version kept; disk version saved as `name (versión del disco hh:mm)`.         |
| Save hits `conflict`                      | Local version saved as `name (mi versión hh:mm)`; document adopts disk content.     |
| File deleted outside                      | Removed from tree; if it had unsaved edits it is recreated with them.               |
| New `.md`/folder outside                  | Added at the end of the tree.                                                       |
| Tab hidden/closed with unsaved work       | Journaled to `localStorage`, recovered on next open.                                |

Copy labels are generated in Spanish today; S2 localizes them with the interface language.

External changes: SSE (server) or 3 s polling (browser folder).
Temporary mode (no folder): IndexedDB + `localStorage` with per-document versions and
cross-tab merge (`src/js/56-tab-sync.js`).

Markdown fidelity: `wsMdText(wsHtml(md))` is stable (round-trip changes nothing), but the
**first edit normalizes the whole file** (`*` -> `-`, aligned tables, numeric columns
right-aligned).

## 6. UI language (roadmap S2)

- Supported: `es`, `en`. Default: system language (`navigator.language`), fallback `en`.
- Switching is live (no reload) and persisted in `localStorage` `atelierroot.ui`.
- Changing the language never changes documents, file names or `state.json`.
