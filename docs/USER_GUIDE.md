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

**Several folders at once**: folder options (the folder chip at the bottom) -> **"Add another folder"**,
or the command palette. Each folder shows at the top of the sidebar with its documents inside; search,
`[[links]]` and moving documents work across them (folders stay in their own open folder). Each folder
keeps its own `.atelieroot/`, so it looks the same when you open it alone. Right click on an open folder ->
**"Remove from the workspace"** stops showing it; nothing on disk changes. The open folders are
remembered. (The development server opens one folder only.)

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

**Images**: paste a screenshot (`Ctrl+V`), drop an image file, or use the image button (from the
computer or from an address). The image is saved as a file in `.atelieroot/assets/`, in the same folders
as the document (`notas/ideas.md` -> `.atelieroot/assets/notas/`), and written as
`![](../.atelieroot/assets/notas/name.png)`, so other editors show it too (PNG, JPG, GIF, WebP, up to 10 MB).
With a folder open, «Copy Markdown» and `Ctrl+C` write each image with its full path on the disk, so
pasting the text into Claude Code (VS Code or terminal) lets Claude open the images itself; the copy is
text only (a chat that gets text and an image together keeps only the image). Right click on an image ->
**"Copy image"** copies only the image, to paste it on its own.

**Change an image**: click it. The bar above has size (25/50/75/100 %, or drag the corner), align left,
centre or right, rotate 90°, flip and crop (drag over the part to keep, then «Crop» or `Enter`). Size and
alignment are written as `<img src="…" width="…" align="…">`; rotate, flip and crop save a new image file.
`Ctrl+Z` undoes any of them.

Images that no document uses any more (you deleted them, or older versions after rotate or crop) move to
`.atelieroot/trash/images/` a few seconds after saving, and are deleted after the trash days (30 unless
changed). While you are still in that document `Ctrl+Z` keeps them; undoing later brings the file back.

Spelling and grammar: the browser's spell check is on. Writing assistant extensions work when
AtelieRoot is opened from `https` (<https://arphael.github.io/AtelieRoot/>); see the [FAQ](FAQ.md).

## 3. Keyboard shortcuts

On macOS use `Cmd` instead of `Ctrl`. The keyboard button in the toolbar (or `Ctrl+K Ctrl+S`, or
"Keyboard shortcuts" in the command palette) lists every shortcut, with a filter.

**Change a shortcut:** in that list, «Change» next to a command, then press the new keys (`Ctrl+K` and
another key works too; `Esc` cancels). «Reset» brings back the original one and «Reset all» every one.
Keys of Windows or the browser (`Ctrl+Shift+V` paste as plain text, `Ctrl+W`, `Ctrl+T`, `Alt+F4`, `F5`,
`Ctrl+Alt`, which is AltGr on many keyboards...), basic editing (copy, paste, undo, bold, arrows) and keys
another command uses are refused, and the list says why.

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
| `Ctrl+K R`     | Reading mode (`Space` starts or stops the word guide, `Esc` leaves) |
| `Ctrl+Shift+8` | Show line-break marks                      |

### Reading mode

`Ctrl+K R` (or the key you choose), the book button in the toolbar or "Reading mode" in the palette. The
document cannot be edited (the file is not touched) and the panels hide. It uses the same scroll as the
editor: it starts where you are, and when you leave you stay where you stopped. What you read stays in the
middle of the screen (focus mode does the same with the line you write). Move the mouse to the bottom of the
window for its panel:

| Tool                     | What it does                                                                          |
| ------------------------ | ------------------------------------------------------------------------------------- |
| Guide                    | Turns the word guide on or off (off: no word is marked), remembered                    |
| Play / pause (`Space`)   | The word guide: one word after another, and the page follows it slowly. Scrolling by hand moves the guide to the word at the reading height |
| Speed                    | Words per minute (200 unless you change it, 60-600), remembered                       |
| Whole / By paragraph     | By paragraph dims everything except the paragraph of the guide word                  |
| `A-` / `A+`, width       | Text size and column width for reading                                                |
| Progress                 | How far you are and the time left at the current speed                                |

`Esc` leaves.

### Tables

| Shortcut                 | Action                                                  |
| ------------------------ | ------------------------------------------------------- |
| `Ctrl+A` inside a table  | Select the whole table                                  |
| `Alt+Left` / `Alt+Right` | Move columns                                            |
| Right click              | All table actions (insert, delete, align, column width) |

## 4. Organizing

- **Sidebar**: folders and documents of your folder; hover a row to see its full name. Drag to reorder or move; right click for rename, duplicate, move to, delete, **Open with its program** (desktop app and dev server), **Show in Explorer**, **Copy path** (the full path, plain text) and **Copy relative path**. In the browser the first «Copy path» asks you to paste the folder's path once (the browser does not tell it), and «Show in Explorer» copies the folder's path to paste in the Explorer.
- **Click below the end** of a document (under a table, a code block or a list) to get an empty paragraph to write in.
- **Search** (sidebar box): filters documents by name.
- **Links between documents**: `[[name]]`. Click to open; missing targets look dotted.
- **Outline** (toolbar): headings of the current document; the one you are in is highlighted, and it follows as you scroll.
- **Split view**: two documents side by side.
- **Placeholders** `[UPPERCASE_NAME]`: the `[ ]` button fills them all at once; values are saved per document.
- **"Ordenar"** (Tidy): normalizes spacing, bullets, numbering and tables.

## 5. Saving, outside changes and conflicts

- **Autosave**: every change is written to the `.md` shortly after you stop typing. Opening a document never rewrites it.
- **Undo per document**: `Ctrl+Z` keeps the steps of each document while the app is open, so you can switch documents and still undo in the one you come back to.
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
- **Do not copy** (select text, then `Ctrl+K N`, right click or the palette): the text stays in the document and in the `.md` (soft dashed underline), but copies leave it out: `Ctrl+C` with or without a selection, "Copiar Markdown", "Con formato" and the live Markdown's copy button. Cut and exports keep it. The same action on a marked text removes the mark.

## 8. Where things are stored

```
My notes/
|-- Intro.md
|-- Projects/Plan.md
`-- .atelieroot/            <- order, open folders, folds, comments, «do not copy» marks, placeholder values, trash
    `-- assets/            <- images of the documents (same folders as the documents)
```

Non-Markdown files in the folder are ignored and never touched. See [FAQ](FAQ.md) for common problems.
