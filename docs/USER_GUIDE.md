# User guide

AtelieRoot is a Markdown editor where every document is a `.md` file in a folder you choose.
You write in a formatted view; AtelieRoot saves plain Markdown automatically.

> The interface is in Spanish today. Labels below are shown as they appear in the app, with the
> English meaning. English interface: roadmap S2.

## 1. Opening a folder

| How you run AtelieRoot         | What happens                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------- |
| Desktop app (`AtelieRoot.exe`) | First start asks for a folder. It is remembered for next time.                                  |
| `AtelieRoot.html` (Chrome/Edge) | Same as browser only: double-click the file, then **"Abrir una carpeta..."**.                  |
| Browser only (Chrome/Edge)  | Click **"Abrir una carpeta..."** (Open a folder). The browser asks permission once per session. |
| No folder                   | **Temporary mode**: documents live only in this browser. Open a folder later to copy them over. |

## 2. Writing

Type Markdown and it turns into formatting as you write:

| You type                                                 | You get                                                            |
| -------------------------------------------------------- | ------------------------------------------------------------------ | ------------------ |
| `#`, `##`... `######` + space                            | Heading level 1-6                                                  |
| `-` or `*` + space                                       | Bullet list                                                        |
| Spaces before any shortcut (`   * `)                     | Same shortcut; right below a list, every 2 spaces (or Tab) nest one level |
| `1.` + space                                             | Numbered list (sub-levels use `a.`, `i.`, `A.`)                    |
| `[ ]` + space                                            | Task (click the box to complete it)                                |
| `>` + space                                              | Quote                                                              |
| ` ``` ` + Enter                                          | Code block with syntax highlight (pick the language in its header) |
| `---` + Enter                                            | Divider                                                            |
| `` `text` ``                                             | Inline code                                                        |
| `/command`                                               | Inline code automatically                                          |
| A URL + space                                            | A real link                                                        |
| A Windows/Unix path (`C:\Users\...`, `/usr/bin`, `src\app.js`) + space | Inline code automatically                          |
| A file name (`Fix.prompt.md`, `app.py`, `.gitignore`) + space            | Inline code automatically (known extensions only)                  |
| Text with `                                              | ` separators                                                       | Offered as a table |

Other blocks from the toolbar: tables, images, links.

Spelling and grammar: the browser's spell check is on. Writing assistant extensions work when
AtelieRoot is opened from `https` (<https://arphael.github.io/AtelieRoot/>); see the [FAQ](FAQ.md).

## 3. Keyboard shortcuts

On macOS use `Cmd` instead of `Ctrl`. The keyboard button in the toolbar (or `Ctrl+K Ctrl+S`, or
"Keyboard shortcuts" in the command palette) lists every shortcut, with a filter.

Like VS Code, `Ctrl+K` starts a two-key shortcut: `Ctrl+K` then `C` / `U` / `Z` / `S`. Pressed alone it
inserts a link after a short moment.

### Selection and multi-edit

| Shortcut                    | Action                                                                 |
| --------------------------- | ---------------------------------------------------------------------- |
| `Ctrl+D`                    | Select the word; press again to add the next match                     |
| `Ctrl+Shift+L`              | Select every match of the selection (or of the word)                   |
| `Shift+Alt+I`               | A cursor at the end of each selected line                              |
| `Ctrl+L`                    | Select the line; press again to add the next one                       |
| `Ctrl+Shift+Left` / `Right` | Select word by word                                                    |

With several places selected (**multi-edit**), what you type, delete or paste happens in all of them; one
`Ctrl+Z` undoes it. `Esc`, a click or an arrow key ends multi-edit. A browser editor has a single real
cursor, so the extra places are highlighted instead of blinking.

### Editing

| Shortcut                              | Action                                                         |
| ------------------------------------- | -------------------------------------------------------------- |
| `Ctrl+Z` / `Ctrl+Shift+Z`             | Undo / redo                                                    |
| `Ctrl+B` / `Ctrl+I`                   | Bold / italic                                                  |
| `Ctrl+Shift+X`                        | Strikethrough                                                  |
| `Ctrl+E`                              | Inline code                                                    |
| `Ctrl+K`                              | Link (`Ctrl+click` opens it)                                   |
| `Tab` / `Shift+Tab`                   | Indent / outdent list items                                    |
| `Alt+Up` / `Alt+Down`                 | Move the line or selected blocks                               |
| `Shift+Alt+Up` / `Shift+Alt+Down`     | Duplicate the line or selected blocks                          |
| `Ctrl+Shift+K` / `Shift+Del`          | Delete the current line                                        |
| `Alt+Z`                               | Word wrap in code blocks and the live Markdown (on by default) |
| `Ctrl+C` / `Ctrl+X` with no selection | Copy / cut the current line                                    |
| `Ctrl+F` / `Ctrl+H`                   | Find / find and replace (`Enter` next, `Shift+Enter` previous) |
| `Ctrl+Shift+F`                        | Search all documents (`Enter` opens the document at that match) |
| `F2`                                  | Rename the document (or the one a `[[link]]` points to); every `[[link]]` to it is updated |

### Comments

Select text and press `Ctrl+/` (or `Ctrl+K Ctrl+C`, or the speech bubble button) to add a comment, like in
Word or Notion. The **Comments** panel on the right lists them: reply, edit, resolve (hidden until you
show resolved ones) and delete. `Ctrl+K Ctrl+U` removes the comment from the selected text. The number
on the button counts open comments.

Comments live only in AtelieRoot: they are not written to the `.md`, and they are left out of copies,
exports and the live Markdown. With a folder open they are kept in `.atelieroot/state.json`; in temporary
mode, in the browser. If the commented text is deleted (here or in another editor) the comment stays,
marked "the commented text was deleted"; undo brings the text back with its comment.

### Navigation and view

On narrow windows and phones, the tools on the right of the toolbar (live Markdown, placeholders,
tidy, copy, export, language, theme) move to the **Tools** panel: the sliders button at the end of the
toolbar (or in the phone header) opens it from the right; Esc or a tap outside closes it.

The **EN/ES** button in the toolbar (or "Language" in the command palette) switches the interface
between English and Spanish; your documents do not change. The first time, AtelieRoot follows your
system language.


| Shortcut       | Action                                     |
| -------------- | ------------------------------------------ |
| `Ctrl+P`       | Go to document                             |
| `Ctrl+Shift+P` | Command palette (every action, searchable) |
| `Ctrl+.`       | Fold / unfold the current section          |
| `Ctrl+K Z`     | Focus mode                                 |
| `Ctrl+Shift+8` | Show line-break marks                      |

### Tables

| Shortcut                 | Action                                                  |
| ------------------------ | ------------------------------------------------------- |
| `Ctrl+A` inside a table  | Select the whole table                                  |
| `Alt+Left` / `Alt+Right` | Move columns                                            |
| Right click              | All table actions (insert, delete, align, column width) |

## 4. Organizing

- **Sidebar**: folders and documents of your folder. Drag to reorder or move; right click for rename, duplicate, move to, delete.
- **Search** (sidebar box): filters documents by name.
- **Links between documents**: `[[name]]`. Click to open; missing targets look dotted.
- **Outline** (toolbar): headings of the current document; the one you are in is highlighted.
- **Split view**: two documents side by side.
- **Placeholders** `[UPPERCASE_NAME]`: the `[ ]` button fills them all at once; values are saved per document.
- **"Ordenar"** (Tidy): normalizes spacing, bullets, numbering and tables.

## 5. Saving, outside changes and conflicts

- **Autosave**: every change is written to the `.md` shortly after you stop typing. Opening a document never rewrites it.
- **First edit normalizes** the file (e.g. `*` bullets become `-`, tables get aligned).
- **Changed outside** (VS Code, git, sync tools): AtelieRoot reloads it. If you had unsaved edits too, nothing is lost: one version is kept as a copy named `name (versión del disco hh:mm)` or `name (mi versión hh:mm)`.
- **Closing with unsaved work**: it is kept and recovered on next start.
- Full rules: [CONTRACT.md](CONTRACT.md#5-autosave-and-sync-rules).

## 6. Trash and backups

- Deleting moves items to `.atelieroot/trash/` inside your folder. **"Papelera"** (Trash) restores them; it empties itself after 30 days.
- **"Exportar respaldo"** (Export backup) downloads everything as one file.
- An automatic snapshot is taken before an app update.

## 7. Copy and export

- **"Copiar Markdown"**: the document as Markdown. **"Con formato"**: rich text for email or docs.
- **Export** (toolbar): HTML file with the current theme, or `.md`.
- **Theme**: light / dark (toolbar).

## 8. Where things are stored

```
My notes/
|-- Intro.md
|-- Projects/Plan.md
`-- .atelieroot/            <- order, open folders, folds, placeholder values, trash
```

Non-Markdown files in the folder are ignored and never touched. See [FAQ](FAQ.md) for common problems.
